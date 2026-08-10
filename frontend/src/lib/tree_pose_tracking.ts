/**
 * tree_pose_tracking.ts  – v3 (complete state-machine rewrite)
 *
 * ─── Phase machine ────────────────────────────────────────────────────────
 *   INVISIBLE  → torso landmarks not detected (< 40% confidence)
 *   STANDING   → both knees roughly level — user is standing normally
 *   ACTIVE     → one leg raised; per-leg timer running
 *   COMPLETE   → both legs have reached target
 *
 * ─── Timer behaviour ──────────────────────────────────────────────────────
 *   • Each leg has a completely independent accumulated-hold counter.
 *   • Switching legs NEVER touches the other leg's time.
 *   • Returning to a leg resumes from the previously accumulated time.
 *   • Timer only ticks while (isHolding && activePhase === ACTIVE).
 *   • If bad form persists beyond the grace period the CURRENT leg resets.
 *
 * ─── Voice feedback rules ─────────────────────────────────────────────────
 *   INVISIBLE  → "I can't see you clearly. Step back."
 *   STANDING   → "Raise one leg and place your foot on your inner thigh."
 *   ACTIVE, no errors, first frame holding → "Great! Hold that."
 *   ACTIVE, zero errors, every 10s while holding → "Perfect! Keep going."
 *   ACTIVE, critical error → priority-ordered correction cue
 *   (arm / head cues only fire if no balance feedback is already pending)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type TreePhase = 'invisible' | 'standing' | 'active' | 'complete';

export interface TreePoseResult {
  phase: TreePhase;
  activeLeg: 'left' | 'right' | null;
  leftLeg: { isHolding: boolean; holdSeconds: number; isComplete: boolean };
  rightLeg: { isHolding: boolean; holdSeconds: number; isComplete: boolean };
  isComplete: boolean;
  currentErrors: string[];
}

export interface TreePoseConfig {
  alignment_thresholds: {
    standing_knee_min_angle: number;
    hip_levelness_threshold: number;
    trunk_sway_threshold: number;
    wrist_height_symmetry_threshold: number | null;
    forward_head_threshold: number;
    min_hold_frames: number;
  };
  hold_config: {
    target_hold_seconds: number;
    foot_placement: string;
    foot_placement_landmark: string;
    grace_period_seconds: number;
  };
  voice_cues: Record<string, string>;
  voice_cue_priority: string[];
  cue_cooldown_seconds: number;
  postural_flags: Record<string, boolean>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function vis(lm: any, thr = 0.4): boolean {
  return lm != null && (lm.visibility === undefined || lm.visibility > thr);
}

function angle(a: any, b: any, c: any): number {
  const r = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let deg = Math.abs((r * 180) / Math.PI);
  if (deg > 180) deg = 360 - deg;
  return deg;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-leg independent state
// ─────────────────────────────────────────────────────────────────────────────

interface LegState {
  consecutive: number;        // consecutive frames with good balance
  isHolding: boolean;
  holdStartedAt: number | null;
  accumulated: number;        // seconds accumulated total for this leg
  lastGoodAt: number;         // ms timestamp of last good frame (0 = none)
  graceWarned: boolean;       // have we already announced grace expiry?
  everHeld: boolean;          // has this leg ever entered a hold?
}

function freshLeg(): LegState {
  return {
    consecutive: 0, isHolding: false, holdStartedAt: null,
    accumulated: 0, lastGoodAt: 0, graceWarned: false, everHeld: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

export function createTreePoseTracker(
  config: TreePoseConfig,
  speak: (text: string, key: string, cooldownMs: number) => void,
  fireError: (type: string, leg: string, ts: number) => void,
  getTimestamp: () => number,
) {
  const T = config.alignment_thresholds;
  const H = config.hold_config;
  const CD = config.cue_cooldown_seconds * 1000;

  const left = freshLeg();
  const right = freshLeg();

  // Phase-level state & debouncing counters
  let lastPhase: TreePhase = 'invisible';
  let lastActiveLeg: 'left' | 'right' | null = null;
  let consecutiveInvisibleFrames = 0;
  let consecutiveVisibleFrames = 0;
  let consecutiveStandingFrames = 0;
  let consecutiveLegFrames = 0;
  let pendingLeg: 'left' | 'right' | null = null;

  // ── helpers ──

  function pauseLeg(s: LegState) {
    s.holdStartedAt = null;
    s.isHolding = false;
  }

  function tickLeg(
    s: LegState,
    goodBalance: boolean,
    now: number,
    legLabel: 'left' | 'right',
  ) {
    if (goodBalance) {
      s.consecutive++;
      const wasHolding = s.isHolding;
      s.isHolding = s.consecutive >= 1;
      s.graceWarned = false;

      if (s.isHolding) {
        if (!wasHolding) {
          const msg = s.everHeld
            ? `Good, resuming ${legLabel} leg hold.`
            : `Great! Hold that position on your ${legLabel} leg.`;
          speak(msg, `tree_hold_${legLabel}`, 6000);
          s.everHeld = true;
        }
        s.lastGoodAt = now;

        if (s.holdStartedAt === null) {
          s.holdStartedAt = now;
        } else {
          const delta = (now - s.holdStartedAt) / 1000;
          if (delta > 0 && delta < 1.0) {
            s.accumulated = Math.min(s.accumulated + delta, H.target_hold_seconds);
          }
          s.holdStartedAt = now;
        }
      }
    } else {
      s.consecutive = 0;
      s.holdStartedAt = null;
      s.isHolding = false;

      if (s.lastGoodAt > 0) {
        const gap = (now - s.lastGoodAt) / 1000;
        if (gap > (H.grace_period_seconds || 3.0) && !s.graceWarned) {
          s.graceWarned = true;
          s.accumulated = 0;
          s.lastGoodAt = 0;
          s.everHeld = false;
          speak(
            `Balance lost on ${legLabel} leg. Timer reset.`,
            `tree_grace_${legLabel}`,
            3000,
          );
        }
      }
    }
  }

  // ── main processFrame ──

  return {
    processFrame(lm: any[], now: number): TreePoseResult {

      // ── 1. Visibility phase (requires head, shoulders, hips, knees, BOTH ankles) ──
      const headOk = vis(lm[0], 0.35);
      const shouldersOk = vis(lm[11], 0.35) && vis(lm[12], 0.35);
      const hipsOk = vis(lm[23], 0.35) && vis(lm[24], 0.35);
      const kneesOk = vis(lm[25], 0.35) && vis(lm[26], 0.35);
      const anklesOk = vis(lm[27], 0.30) && vis(lm[28], 0.30);
      const fullBodyOk = headOk && shouldersOk && hipsOk && kneesOk && anklesOk;

      if (!fullBodyOk) {
        consecutiveInvisibleFrames++;
        consecutiveVisibleFrames = 0;
        pauseLeg(left);
        pauseLeg(right);
        consecutiveLegFrames = 0;
        pendingLeg = null;

        if (consecutiveInvisibleFrames >= 2) {
          if (lastPhase !== 'invisible') {
            lastPhase = 'invisible';
            lastActiveLeg = null;
            speak(
              "Step back so your full body is in frame.",
              'tree_invisible',
              6000,
            );
          }
          return buildResult(left, right, null, 'invisible', H.target_hold_seconds, []);
        }
        return buildResult(left, right, null, lastPhase, H.target_hold_seconds, []);
      } else {
        consecutiveInvisibleFrames = 0;
        consecutiveVisibleFrames++;
      }

      // Require 6 consecutive full-body frames before leaving invisible phase
      if (lastPhase === 'invisible' && consecutiveVisibleFrames < 6) {
        pauseLeg(left);
        pauseLeg(right);
        return buildResult(left, right, null, 'invisible', H.target_hold_seconds, []);
      }

      // ── 2. Determine Tree Pose leg stance (distinguish from walking/standing) ────────
      const lKneeY = lm[25]?.y ?? 0.5;
      const rKneeY = lm[26]?.y ?? 0.5;
      const lAnkleY = lm[27]?.y ?? 0.5;
      const rAnkleY = lm[28]?.y ?? 0.5;

      const lKneeX = lm[25]?.x ?? 0.5;
      const rKneeX = lm[26]?.x ?? 0.5;
      const lAnkleX = lm[27]?.x ?? 0.5;
      const rAnkleX = lm[28]?.x ?? 0.5;

      // Tree Pose requires:
      // A) Raised ankle elevated above standing ankle by > 0.05
      // B) Raised ankle placed close to standing leg line horizontally (< 0.18)
      // C) Raised knee flared outward sideways (> 0.08)
      const lAnkleElevated = (rAnkleY - lAnkleY > 0.05);
      const lAnkleNearLeg = Math.abs(lAnkleX - rKneeX) < 0.18 || lAnkleY < rKneeY + 0.10;
      const lKneeFlared = Math.abs(lKneeX - rKneeX) > 0.08 || lKneeY < rKneeY - 0.02;

      const rAnkleElevated = (lAnkleY - rAnkleY > 0.05);
      const rAnkleNearLeg = Math.abs(rAnkleX - lKneeX) < 0.18 || rAnkleY < lKneeY + 0.10;
      const rKneeFlared = Math.abs(rKneeX - lKneeX) > 0.08 || rKneeY < lKneeY - 0.02;

      const isLeftTreeStance = lAnkleElevated && lAnkleNearLeg && lKneeFlared;
      const isRightTreeStance = rAnkleElevated && rAnkleNearLeg && rKneeFlared;

      let detectedStance: 'left' | 'right' | null = null;
      if (isLeftTreeStance && !isRightTreeStance) {
        detectedStance = 'left';
      } else if (isRightTreeStance && !isLeftTreeStance) {
        detectedStance = 'right';
      }

      // Debounce raised leg stance over 4 consecutive frames
      if (detectedStance !== null) {
        if (pendingLeg === detectedStance) {
          consecutiveLegFrames++;
        } else {
          pendingLeg = detectedStance;
          consecutiveLegFrames = 1;
        }
      } else {
        consecutiveLegFrames = 0;
        pendingLeg = null;
      }

      const activeLeg: 'left' | 'right' | null = consecutiveLegFrames >= 4 ? pendingLeg : null;

      // ── 3. STANDING phase (both feet on ground) ───────────────────────────
      if (activeLeg === null) {
        consecutiveStandingFrames++;
        if (consecutiveStandingFrames >= 3) {
          if (lastPhase === 'active') {
            // User dropped their leg down back to floor
            speak(
              "Place your foot back up on your inner thigh or calf.",
              'tree_both_legs_down',
              6000,
            );
            lastPhase = 'standing';
          } else if (lastPhase !== 'standing') {
            // User just stepped back into frame or initialized full body view
            lastPhase = 'standing';
            speak(
              "Perfect, let's start! Raise one leg and place your foot on your inner thigh or calf.",
              'tree_standing',
              8000,
            );
          }
          pauseLeg(left);
          pauseLeg(right);
          lastActiveLeg = null;
          return buildResult(left, right, null, 'standing', H.target_hold_seconds, []);
        }
        return buildResult(left, right, null, lastPhase, H.target_hold_seconds, []);
      } else {
        consecutiveStandingFrames = 0;
      }

      // ── 4. ACTIVE phase ─────────────────────────────────────────────────
      lastPhase = 'active';
      const currentLeg: 'left' | 'right' = activeLeg ?? 'left';

      // Pause the INACTIVE leg (preserves its accumulated time)
      const inactiveLeg = currentLeg === 'left' ? right : left;
      pauseLeg(inactiveLeg);

      // Announce leg switch
      if (lastActiveLeg !== currentLeg) {
        const remaining = H.target_hold_seconds -
          (currentLeg === 'left' ? left.accumulated : right.accumulated);
        if (remaining > 0) {
          speak(
            `${currentLeg.charAt(0).toUpperCase() + currentLeg.slice(1)} leg. ${Math.ceil(remaining)} seconds remaining.`,
            `tree_switch_${currentLeg}`,
            3000,
          );
        }
        lastActiveLeg = currentLeg;
      }

      // ── 5. Biomechanical checks ──────────────────────────────────────────
      const errors: string[] = [];

      // Standing-side landmarks
      const ss = currentLeg === 'left' ? 'right' : 'left';   // standing side
      const sHipIdx = ss === 'left' ? 23 : 24;
      const sKneeIdx = ss === 'left' ? 25 : 26;
      const sAnkleIdx = ss === 'left' ? 27 : 28;
      const rAnkleIdx = currentLeg === 'left' ? 27 : 28;   // raised-leg ankle

      // A. Standing knee angle
      if (vis(lm[sHipIdx]) && vis(lm[sKneeIdx]) && vis(lm[sAnkleIdx])) {
        const kAngle = angle(lm[sHipIdx], lm[sKneeIdx], lm[sAnkleIdx]);
        if (kAngle < 135) {
          errors.push('knee_bent');
        }
      }

      // B. Hip levelness
      if (vis(lm[23]) && vis(lm[24])) {
        const hipDiff = Math.abs(lm[23].y - lm[24].y);
        const torsoH = Math.abs((lm[11].y - lm[23].y)) || 0.001;
        if (hipDiff / torsoH > 0.40) errors.push('hip_unlevel');
      }

      // C. Trunk sway
      if (vis(lm[11]) && vis(lm[12]) && vis(lm[sAnkleIdx])) {
        const sMidX = (lm[11].x + lm[12].x) / 2;
        if (Math.abs(sMidX - lm[sAnkleIdx].x) > 0.35) {
          errors.push('trunk_sway');
        }
      }

      // D. Raised-foot height
      if (vis(lm[rAnkleIdx], 0.20) && vis(lm[sAnkleIdx], 0.20)) {
        if (lm[rAnkleIdx].y > lm[sAnkleIdx].y - 0.02) {
          errors.push('foot_too_low');
        }
      }

      // ── 6. Evaluate balance quality ──────────────────────────────────────
      const criticalErrors = errors.filter(e => ['knee_bent', 'foot_too_low'].includes(e));
      const goodBalance = criticalErrors.length === 0;

      // ── 7. Fire feedback ─────────────────────────────────────────────────
      if (goodBalance) {
        const activeState = currentLeg === 'left' ? left : right;
        if (errors.length === 0 && activeState.accumulated >= 3.0) {
          speak('Perfect! Keep holding.', 'tree_perfect', 15000);
        }
      } else {
        const DEFAULT_TREE_CUES: Record<string, string> = {
          knee_bent: "Straighten your standing leg.",
          hip_unlevel: "Keep your hips level.",
          trunk_sway: "Keep your torso vertical and centered.",
          foot_too_low: "Keep your foot placed on your calf or inner thigh.",
          arms_asymmetric: "Bring your hands together in prayer position.",
        };

        for (const key of ['knee_bent', 'foot_too_low', 'trunk_sway', 'hip_unlevel']) {
          if (errors.includes(key)) {
            const cueText = DEFAULT_TREE_CUES[key] || "Adjust your posture.";
            speak(cueText, `err_${key}`, CD);
            fireError(key, currentLeg, getTimestamp());
            break;
          }
        }
      }

      // ── 8. Tick the active leg's timer ───────────────────────────────────
      const activeState = currentLeg === 'left' ? left : right;
      tickLeg(activeState, goodBalance, now, currentLeg);

      // Check completion
      const leftDone = left.accumulated >= H.target_hold_seconds;
      const rightDone = right.accumulated >= H.target_hold_seconds;
      const phase: TreePhase = leftDone && rightDone ? 'complete' : 'active';

      return buildResult(left, right, activeLeg, phase, H.target_hold_seconds, errors);
    },

    getErrors: () => [],

    reset() {
      Object.assign(left, freshLeg());
      Object.assign(right, freshLeg());
      lastPhase = 'invisible';
      lastActiveLeg = null;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Build result object
// ─────────────────────────────────────────────────────────────────────────────

function buildResult(
  l: LegState,
  r: LegState,
  activeLeg: 'left' | 'right' | null,
  phase: TreePhase,
  target: number,
  errors: string[],
): TreePoseResult {
  return {
    phase,
    activeLeg,
    leftLeg: { isHolding: l.isHolding, holdSeconds: l.accumulated, isComplete: l.accumulated >= target },
    rightLeg: { isHolding: r.isHolding, holdSeconds: r.accumulated, isComplete: r.accumulated >= target },
    isComplete: l.accumulated >= target && r.accumulated >= target,
    currentErrors: errors,
  };
}
