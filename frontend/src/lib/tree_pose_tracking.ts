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
  leftLeg:  { isHolding: boolean; holdSeconds: number; isComplete: boolean };
  rightLeg: { isHolding: boolean; holdSeconds: number; isComplete: boolean };
  isComplete: boolean;
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

  const left  = freshLeg();
  const right = freshLeg();

  // Phase-level state & debouncing counters
  let lastPhase: TreePhase = 'invisible';
  let lastActiveLeg: 'left' | 'right' | null = null;
  let consecutiveInvisibleFrames = 0;
  let consecutiveStandingFrames = 0;

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
      s.isHolding = s.consecutive >= T.min_hold_frames;
      s.graceWarned = false;

      if (s.isHolding) {
        if (!wasHolding) {
          const msg = s.everHeld
            ? `Good, resuming ${legLabel} leg hold.`
            : `Great! Hold that position on your ${legLabel} leg.`;
          speak(msg, `tree_hold_${legLabel}`, 3000);
          s.everHeld = true;
        }
        s.lastGoodAt = now;

        if (s.holdStartedAt === null) {
          s.holdStartedAt = now;
        } else {
          const delta = (now - s.holdStartedAt) / 1000;
          if (delta > 0) {
            s.accumulated = Math.min(s.accumulated + delta, H.target_hold_seconds);
          }
          s.holdStartedAt = now;
        }
      }
    } else {
      s.consecutive = 0;
      s.holdStartedAt = null;
      const wasHolding = s.isHolding;
      s.isHolding = false;

      if (s.lastGoodAt > 0) {
        const gap = (now - s.lastGoodAt) / 1000;
        if (gap > H.grace_period_seconds && !s.graceWarned) {
          s.graceWarned = true;
          s.accumulated = 0;
          s.lastGoodAt  = 0;
          s.everHeld    = false;
          speak(
            `Balance lost on ${legLabel} leg. Timer has been reset.`,
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

      // ── 1. Visibility phase with frame debouncing ──────────────────────
      const fullBodyOk =
        vis(lm[0], 0.35) &&
        vis(lm[11], 0.40) &&
        vis(lm[12], 0.40) &&
        vis(lm[23], 0.40) &&
        vis(lm[24], 0.40) &&
        vis(lm[25], 0.30) &&
        vis(lm[26], 0.30) &&
        vis(lm[27], 0.30) &&
        vis(lm[28], 0.30);

      if (!fullBodyOk) {
        consecutiveInvisibleFrames++;
        if (consecutiveInvisibleFrames >= 8) {
          if (lastPhase !== 'invisible') {
            speak(
              "I can't see you clearly. Step back so your full body is in frame.",
              'tree_invisible',
              7000,
            );
            lastPhase = 'invisible';
            lastActiveLeg = null;
          }
          pauseLeg(left);
          pauseLeg(right);
          return buildResult(left, right, null, 'invisible', H.target_hold_seconds);
        }
      } else {
        consecutiveInvisibleFrames = 0;
      }

      // ── 2. Determine which leg is raised ────────────────────────────────
      const lKneeY = lm[25]?.y ?? 0.5;
      const rKneeY = lm[26]?.y ?? 0.5;
      const lAnkleY = lm[27]?.y ?? 0.5;
      const rAnkleY = lm[28]?.y ?? 0.5;

      const lAnkleRaised = (rAnkleY - lAnkleY) > 0.05;
      const rAnkleRaised = (lAnkleY - rAnkleY) > 0.05;
      const kneeGap = Math.abs(lKneeY - rKneeY);

      let detectedLeg: 'left' | 'right' | null = null;
      if (lAnkleRaised || (kneeGap > 0.035 && lKneeY < rKneeY)) {
        detectedLeg = 'left';
      } else if (rAnkleRaised || (kneeGap > 0.035 && rKneeY < lKneeY)) {
        detectedLeg = 'right';
      }

      const activeLeg: 'left' | 'right' | null = detectedLeg;

      // ── 3. STANDING phase (both feet on ground) with debouncing ────────
      if (activeLeg === null) {
        consecutiveStandingFrames++;
        if (consecutiveStandingFrames >= 5) {
          if (lastPhase !== 'standing') {
            lastPhase = 'standing';
            speak(
              "Perfect, let's start! Raise one leg and place your foot on your inner thigh.",
              'tree_standing',
              8000,
            );
          }
          pauseLeg(left);
          pauseLeg(right);
          lastActiveLeg = null;
          return buildResult(left, right, null, 'standing', H.target_hold_seconds);
        }
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
      const sHipIdx    = ss === 'left' ? 23 : 24;
      const sKneeIdx   = ss === 'left' ? 25 : 26;
      const sAnkleIdx  = ss === 'left' ? 27 : 28;
      const rAnkleIdx  = currentLeg === 'left' ? 27 : 28;   // raised-leg ankle

      // A. Standing knee angle
      if (vis(lm[sHipIdx]) && vis(lm[sKneeIdx]) && vis(lm[sAnkleIdx])) {
        const kAngle = angle(lm[sHipIdx], lm[sKneeIdx], lm[sAnkleIdx]);
        if (kAngle < T.standing_knee_min_angle) errors.push('knee_bent');
      }

      // B. Hip levelness
      if (vis(lm[23]) && vis(lm[24])) {
        const hipDiff = Math.abs(lm[23].y - lm[24].y);
        const torsoH  = Math.abs((lm[11].y - lm[23].y)) || 0.001;
        if (hipDiff / torsoH > T.hip_levelness_threshold) errors.push('hip_unlevel');
      }

      // C. Trunk sway
      if (vis(lm[11]) && vis(lm[12]) && vis(lm[sAnkleIdx])) {
        const sMidX = (lm[11].x + lm[12].x) / 2;
        if (Math.abs(sMidX - lm[sAnkleIdx].x) > T.trunk_sway_threshold)
          errors.push('trunk_sway');
      }

      // D. Raised-foot height (only if raised ankle is visible)
      const tgtLmIdx =
        H.foot_placement_landmark === 'hip'   ? sHipIdx
        : H.foot_placement_landmark === 'knee'  ? sKneeIdx
        : H.foot_placement_landmark === 'ankle' ? sAnkleIdx
        : null;

      if (tgtLmIdx !== null && vis(lm[rAnkleIdx], 0.35) && vis(lm[tgtLmIdx], 0.35)) {
        const threshold = H.foot_placement_landmark === 'hip' ? 0.22 : 0.15;
        if (lm[rAnkleIdx].y > lm[tgtLmIdx].y + threshold) errors.push('foot_too_low');
      }

      // E. Arm / prayer hands (advisory — does NOT stop the timer)
      if (T.wrist_height_symmetry_threshold !== null && vis(lm[15]) && vis(lm[16])) {
        const wDist = Math.hypot(lm[15].x - lm[16].x, lm[15].y - lm[16].y);
        const sYMid = (lm[11].y + lm[12].y) / 2;
        const hYMid = (lm[23].y + lm[24].y) / 2;
        if (wDist > 0.25 || lm[15].y < sYMid - 0.1 || lm[15].y > hYMid + 0.1) {
          if (config.voice_cues['arms_asymmetric']) errors.push('arms_asymmetric');
        }
      }

      // ── 6. Evaluate balance quality ──────────────────────────────────────
      const criticalErrors = errors.filter(e =>
        ['knee_bent', 'hip_unlevel', 'trunk_sway', 'foot_too_low'].includes(e),
      );
      const goodBalance = criticalErrors.length === 0;

      // ── 7. Fire feedback ─────────────────────────────────────────────────
      if (goodBalance) {
        const activeState = currentLeg === 'left' ? left : right;
        if (errors.length === 0 && activeState.accumulated >= 3.0) {
          speak('Perfect! Keep holding.', 'tree_perfect', 15000);
        }
      } else {
const DEFAULT_TREE_CUES: Record<string, string> = {
  knee_bent: "Keep your standing leg straight.",
  hip_unlevel: "Keep your hips level and square.",
  trunk_sway: "Keep your torso vertical and centered.",
  foot_too_low: "Place your raised foot higher on your inner thigh.",
  arms_asymmetric: "Bring your hands together in prayer position.",
  forward_head: "Keep your head up and neck straight.",
};

        // Fire highest-priority correction cue
        for (const key of config.voice_cue_priority) {
          if (errors.includes(key)) {
            const cueText = config.voice_cues[key] || DEFAULT_TREE_CUES[key] || "Adjust your posture.";
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
      const leftDone  = left.accumulated  >= H.target_hold_seconds;
      const rightDone = right.accumulated >= H.target_hold_seconds;
      const phase: TreePhase = leftDone && rightDone ? 'complete' : 'active';

      return buildResult(left, right, activeLeg, phase, H.target_hold_seconds);
    },

    getErrors: () => [],

    reset() {
      Object.assign(left,  freshLeg());
      Object.assign(right, freshLeg());
      lastPhase    = 'invisible';
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
): TreePoseResult {
  return {
    phase,
    activeLeg,
    leftLeg:  { isHolding: l.isHolding, holdSeconds: l.accumulated,  isComplete: l.accumulated  >= target },
    rightLeg: { isHolding: r.isHolding, holdSeconds: r.accumulated, isComplete: r.accumulated >= target },
    isComplete: l.accumulated >= target && r.accumulated >= target,
  };
}
