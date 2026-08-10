/**
 * butterfly_tracking.ts
 *
 * Bilateral seated static hold tracker for Butterfly Pose (Baddha Konasana).
 */

import { TreePhase, TreePoseResult, TreePoseConfig } from './tree_pose_tracking';

// Internal helpers
function vis(lm: any, thr = 0.4): boolean {
  return lm != null && (lm.visibility === undefined || lm.visibility > thr);
}

function angle(a: any, b: any, c: any): number {
  const r = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let deg = Math.abs((r * 180) / Math.PI);
  if (deg > 180) deg = 360 - deg;
  return deg;
}

export function createButterflyTracker(
  config: TreePoseConfig,
  speak: (text: string, key: string, cooldownMs: number) => void,
  fireError: (type: string, leg: string, ts: number) => void,
  getTimestamp: () => number,
) {
  const T = config.alignment_thresholds as any;
  const H = config.hold_config;
  const CD = config.cue_cooldown_seconds * 1000;

  // Single bilateral hold state (we use 'left' to store the generic hold, and 'right' remains 0)
  let isHolding = false;
  let accumulated = 0;
  let holdStartedAt: number | null = null;
  let consecutive = 0;
  let lastGoodAt = 0;
  let graceWarned = false;
  let everHeld = false;

  let lastPhase: TreePhase = 'invisible';

  return {
    processFrame(lm: any[], now: number): TreePoseResult {
      // 1. Visibility phase
      const torsoOk =
        vis(lm[11], 0.45) &&
        vis(lm[12], 0.45) &&
        vis(lm[23], 0.45) &&
        vis(lm[24], 0.45);

      if (!torsoOk) {
        if (lastPhase !== 'invisible') {
          speak(
            "I can't see you clearly. Make sure your upper body is visible.",
            'butterfly_invisible',
            5000,
          );
          lastPhase = 'invisible';
        }
        holdStartedAt = null;
        isHolding = false;
        return {
          phase: 'invisible',
          activeLeg: 'left',
          leftLeg: { isHolding: false, holdSeconds: accumulated, isComplete: accumulated >= H.target_hold_seconds },
          rightLeg: { isHolding: false, holdSeconds: 0, isComplete: true },
          isComplete: accumulated >= H.target_hold_seconds,
          currentErrors: [],
        };
      }

      // 2. Seated phase check
      // Only require at least one knee to be visible.
      const kneesVis = vis(lm[25], 0.3) || vis(lm[26], 0.3);

      const lHipY = lm[23]?.y || lm[24]?.y || 0;
      const rHipY = lm[24]?.y || lm[23]?.y || 0;
      const hipMidY = (lHipY + rHipY) / 2;

      let kneeY = hipMidY;
      if (vis(lm[25]) && vis(lm[26])) kneeY = (lm[25].y + lm[26].y) / 2;
      else if (vis(lm[25])) kneeY = lm[25].y;
      else if (vis(lm[26])) kneeY = lm[26].y;

      // We expect knee to not be aggressively higher than hips for seated
      const isSeated = kneeY > hipMidY - 0.2;

      if (!isSeated || !kneesVis) {
        if (lastPhase !== 'standing') {
          lastPhase = 'standing';
          speak(
            'Sit on the floor and bring the soles of your feet together.',
            'butterfly_standing',
            8000,
          );
        }
        holdStartedAt = null;
        isHolding = false;
        return {
          phase: 'standing',
          activeLeg: 'left',
          leftLeg: { isHolding: false, holdSeconds: accumulated, isComplete: accumulated >= H.target_hold_seconds },
          rightLeg: { isHolding: false, holdSeconds: 0, isComplete: true },
          isComplete: accumulated >= H.target_hold_seconds,
          currentErrors: [],
        };
      }

      // 3. active Phase
      lastPhase = 'active';
      const errors: string[] = [];

      const shoulderMidY = (lm[11].y + lm[12].y) / 2;
      const torsoH = Math.abs(hipMidY - shoulderMidY) || 0.001;
      const shoulderW = Math.abs(lm[11].x - lm[12].x) || 0.001;

      // A. Trunk lean / spine rounded
      // Normal torso height is ~1.5x shoulder width. If we see much less, they are leaning forward.
      const expectedTorsoH = shoulderW * 1.5;
      const leanRatio = 1 - (torsoH / expectedTorsoH);
      if (leanRatio > T.trunk_lean_max) {
        errors.push('spine_rounded');
      }

      // B. Shoulders raised & C. Head dropped (only if nose is clearly visible)
      if (vis(lm[0], 0.5)) {
        const noseY = lm[0].y;
        const shoulderToNose = shoulderMidY - noseY;

        if (shoulderToNose < T.shoulder_elevation_threshold * expectedTorsoH) {
          errors.push('shoulders_raised');
        }
        if (noseY > shoulderMidY - (T.head_drop_threshold * expectedTorsoH)) {
          errors.push('head_dropped');
        }
      }

      // D. Knees too high
      if (vis(lm[25]) && vis(lm[26])) {
        // Drop ratio measured as fraction of torso height to be distance-invariant
        const leftDrop = (lm[25].y - lm[23].y) / torsoH;
        const rightDrop = (lm[26].y - lm[24].y) / torsoH;
        const avgDrop = (leftDrop + rightDrop) / 2;

        if (avgDrop < T.knee_drop_ratio_min) {
          errors.push('knees_too_high');
        }
      }

      // E. Feet apart (only if both ankles firmly visible)
      if (vis(lm[27], 0.5) && vis(lm[28], 0.5)) {
        // distance between feet relative to shoulder width to be distance invariant
        const footDist = Math.abs(lm[27].x - lm[28].x);
        if ((footDist / shoulderW) > T.feet_apart_threshold) {
          errors.push('feet_apart');
        }
      }


      const criticalErrors = errors.filter((e) => ['spine_rounded', 'shoulders_raised', 'knees_too_high'].includes(e));
      const goodBalance = criticalErrors.length === 0;

      // Fire feedback
      if (goodBalance) {
        if (errors.length === 0 && accumulated >= 3.0) {
          speak('Perfect! Keep holding.', 'butterfly_perfect', 15000);
        }
      } else {
        const DEFAULT_BUTTERFLY_CUES: Record<string, string> = {
          spine_rounded: "Sit up straight and lengthen your spine.",
          shoulders_raised: "Relax your shoulders down away from your ears.",
          knees_too_high: "Lower your knees toward the floor.",
          feet_apart: "Bring the soles of your feet together.",
          head_dropped: "Keep your gaze forward and head up.",
        };

        for (const key of config.voice_cue_priority) {
          if (errors.includes(key)) {
            const cueText = config.voice_cues[key] || DEFAULT_BUTTERFLY_CUES[key] || "Adjust your posture.";
            speak(cueText, `err_${key}`, CD);
            fireError(key, "both", getTimestamp());
            break;
          }
        }
      }

      // Timer Logic
      if (goodBalance) {
        consecutive++;
        const wasHolding = isHolding;
        isHolding = consecutive >= T.min_hold_frames;
        graceWarned = false;

        if (isHolding) {
          if (!wasHolding) {
            const msg = everHeld
              ? `Good, resuming hold.`
              : `Great! Relax into the stretch and hold.`;
            speak(msg, `butterfly_hold`, 3000);
            everHeld = true;
          }
          lastGoodAt = now;

          if (holdStartedAt === null) {
            holdStartedAt = now;
          } else {
            const delta = (now - holdStartedAt) / 1000;
            if (delta > 0) {
              accumulated = Math.min(accumulated + delta, H.target_hold_seconds);
            }
            holdStartedAt = now;
          }
        }
      } else {
        consecutive = 0;
        holdStartedAt = null;
        const wasHolding = isHolding;
        isHolding = false;

        if (lastGoodAt > 0) {
          const gap = (now - lastGoodAt) / 1000;
          if (gap > H.grace_period_seconds && !graceWarned) {
            graceWarned = true;
            accumulated = 0;
            lastGoodAt = 0;
            everHeld = false;
            speak(
              `Form lost. Timer has been reset.`,
              `butterfly_grace`,
              3000,
            );
          }
        }
      }

      const isComplete = accumulated >= H.target_hold_seconds;

      return {
        phase: isComplete ? 'complete' : 'active',
        activeLeg: 'left',
        leftLeg: { isHolding, holdSeconds: accumulated, isComplete },
        rightLeg: { isHolding: false, holdSeconds: 0, isComplete: true },
        isComplete,
        currentErrors: errors,
      };
    },

    getErrors: () => [],
    reset() {
      isHolding = false;
      accumulated = 0;
      holdStartedAt = null;
      consecutive = 0;
      lastGoodAt = 0;
      graceWarned = false;
      everHeld = false;
      lastPhase = 'invisible';
    },
  };
}
