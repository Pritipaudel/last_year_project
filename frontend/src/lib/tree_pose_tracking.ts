/**
 * tree_pose_tracking.ts
 *
 * Implements real-time biomechanical tracking for Tree Pose (Vrksasana).
 * Features:
 *   - Independent hold timers for left and right leg stances.
 *   - Grace period handling for form breaks.
 *   - Voice cue triggers based on prioritize-gated thresholds.
 *   - 0.5s stability filter to prevent jitter from starting/stopping hold.
 */

export interface TreePoseResult {
  leftLeg: {
    isHolding: boolean;
    holdSeconds: number;
    isComplete: boolean;
  };
  rightLeg: {
    isHolding: boolean;
    holdSeconds: number;
    isComplete: boolean;
  };
  activeLeg: 'left' | 'right' | null;
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

export function createTreePoseTracker(
  config: TreePoseConfig,
  speak: (text: string, key: string, cooldown: number) => void,
  fireError: (type: string, leg: string, timestamp: number) => void,
  getTimestamp: () => number
) {
  const t = config.alignment_thresholds;
  const h = config.hold_config;

  let leftHoldStartedAt: number | null = null;
  let rightHoldStartedAt: number | null = null;
  let leftAccumulatedSeconds = 0;
  let rightAccumulatedSeconds = 0;

  // Track the last time form was "good" to handle grace periods
  let lastGoodFormTimestamp = 0;

  // Stability counters (require N consecutive frames of good form)
  let consecutiveGoodFrames = 0;

  return {
    processFrame: (landmarks: any[], now: number): TreePoseResult => {
      // 1. Identify which leg is standing
      // We look for the knee with the largest y-value (bottom of screen) as the standing leg
      const leftKneeY = landmarks[25].y;
      const rightKneeY = landmarks[26].y;
      const activeLeg: 'left' | 'right' | null = Math.abs(leftKneeY - rightKneeY) < 0.05 ? null : (leftKneeY > rightKneeY ? 'left' : 'right');

      if (!activeLeg) {
        consecutiveGoodFrames = 0;
        return getResult(activeLeg, leftAccumulatedSeconds, rightAccumulatedSeconds, false, false);
      }

      // 2. Biomechanical Checks
      const errors: string[] = [];

      // A. Standing Knee (Must be relatively straight)
      const standingKneeIdx = activeLeg === 'left' ? 25 : 26;
      const hipIdx = activeLeg === 'left' ? 23 : 24;
      const ankleIdx = activeLeg === 'left' ? 27 : 28;
      const kAngle = calculateAngle(landmarks[hipIdx], landmarks[standingKneeIdx], landmarks[ankleIdx]);
      if (kAngle < t.standing_knee_min_angle) errors.push('knee_bent');

      // B. Hip Levelness
      const hipDiff = Math.abs(landmarks[23].y - landmarks[24].y);
      const torsoHeight = Math.abs(landmarks[11].y - landmarks[23].y);
      if (hipDiff / torsoHeight > t.hip_levelness_threshold) errors.push('hip_unlevel');

      // C. Trunk Sway (Shoulder midpoint relative to standing ankle)
      const shoulderMidX = (landmarks[11].x + landmarks[12].x) / 2;
      const ankleX = landmarks[ankleIdx].x;
      if (Math.abs(shoulderMidX - ankleX) > t.trunk_sway_threshold) errors.push('trunk_sway');

      // D. Hands in Prayer (Namaste) - Checking if wrists are together and near chest
      const leftWrist = landmarks[15];
      const rightWrist = landmarks[16];
      const wristDist = Math.sqrt(Math.pow(leftWrist.x - rightWrist.x, 2) + Math.pow(leftWrist.y - rightWrist.y, 2));
      const shoulderYMid = (landmarks[11].y + landmarks[12].y) / 2;
      const hipYMid = (landmarks[23].y + landmarks[24].y) / 2;
      const isInChestArea = leftWrist.y > shoulderYMid && leftWrist.y < hipYMid;

      if (wristDist > 0.1 || !isInChestArea) {
         // Optionally cue for arms, though not strictly required for "balance" it is for "Tree Pose"
         // If we have a cue for it:
         if (config.voice_cues['arms_asymmetric']) errors.push('arms_asymmetric');
      }

      // E. Foot Placement (Raised foot should be near the target landmark)
      const raisedAnkleIdx = activeLeg === 'left' ? 28 : 27;
      const targetLandmarkIdx = h.foot_placement_landmark === 'hip' ? (activeLeg === 'left' ? 23 : 24) :
                                h.foot_placement_landmark === 'knee' ? (activeLeg === 'left' ? 25 : 26) :
                                h.foot_placement_landmark === 'ankle' ? (activeLeg === 'left' ? 27 : 28) : null;

      if (targetLandmarkIdx !== null) {
         const raisedFootY = landmarks[raisedAnkleIdx].y;
         const targetY = landmarks[targetLandmarkIdx].y;
         // Allow a 10% vertical tolerance
         if (raisedFootY > targetY + 0.1) errors.push('foot_too_low');
      }

      // 3. Evaluate Hold State
      const hasErrors = errors.length > 0;
      if (!hasErrors) {
        consecutiveGoodFrames++;
      } else {
        consecutiveGoodFrames = 0;
        // Fire voice cues based on priority
        for (const cueKey of config.voice_cue_priority) {
          if (errors.includes(cueKey)) {
            speak(config.voice_cues[cueKey], cueKey, config.cue_cooldown_seconds * 1000);
            fireError(cueKey, activeLeg, getTimestamp());
            break; // Only speak the highest priority error
          }
        }
      }

      const isHolding = consecutiveGoodFrames >= t.min_hold_frames;
      if (isHolding) {
        lastGoodFormTimestamp = now;
        if (activeLeg === 'left') {
          if (!leftHoldStartedAt) leftHoldStartedAt = now;
          leftAccumulatedSeconds += (now - leftHoldStartedAt) / 1000;
          leftHoldStartedAt = now;
        } else {
          if (!rightHoldStartedAt) rightHoldStartedAt = now;
          rightAccumulatedSeconds += (now - rightHoldStartedAt) / 1000;
          rightHoldStartedAt = now;
        }
      } else {
        // Form broken. Check grace period.
        const timeSinceGoodForm = (now - lastGoodFormTimestamp) / 1000;
        if (timeSinceGoodForm > h.grace_period_seconds) {
           // Fully reset the timer for the active leg if gone for too long
           if (activeLeg === 'left') leftAccumulatedSeconds = 0;
           else rightAccumulatedSeconds = 0;
        }
        leftHoldStartedAt = null;
        rightHoldStartedAt = null;
      }

      return getResult(activeLeg, leftAccumulatedSeconds, rightAccumulatedSeconds, isHolding && activeLeg === 'left', isHolding && activeLeg === 'right');
    },

    getResult: (activeLeg: 'left' | 'right' | null, l: number, r: number, lh: boolean, rh: boolean): TreePoseResult => {
      const leftComplete = l >= h.target_hold_seconds;
      const rightComplete = r >= h.target_hold_seconds;
      return {
        leftLeg: { isHolding: lh, holdSeconds: l, isComplete: leftComplete },
        rightLeg: { isHolding: rh, holdSeconds: r, isComplete: rightComplete },
        activeLeg,
        isComplete: leftComplete && rightComplete
      };
    },

    getErrors: () => {
        // Return a list of error objects for the session log
        // This would be populated by the fireError callback
        return [];
    }
  };
}

function calculateAngle(a: any, b: any, c: any): number {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) angle = 360 - angle;
  return angle;
}
