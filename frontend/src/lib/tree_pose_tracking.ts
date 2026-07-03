/**
<<<<<<< HEAD
 * tree_pose_tracking.ts — Tree Pose (Vrksasana) static hold timer
 *
 * Replaces rep counting entirely with a dual-leg hold duration tracker.
 * Timer design:
 *   - Starts when all alignment checks pass for min_hold_frames consecutive frames
 *   - Pauses (grace period) when any check fails
 *   - Resumes if form restored within 3 seconds (grace_period_seconds from backend config)
 *   - Fully resets if form broken for > grace_period_seconds
 *   - Left and right leg tracked independently
 *   - Both legs must reach target_hold_seconds for a complete set
 *
 * Receives personalized config from backend once before hold starts.
 * Fires Web Speech API cues with priority ordering and per-key cooldown.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TreePoseThresholds {
    standing_knee_min_angle: number;
    hip_levelness_threshold: number;
    trunk_sway_threshold: number;
    wrist_height_symmetry_threshold: number | null;  // null = skip check (60+)
    forward_head_threshold: number;
    min_hold_frames: number;
}

export interface TreePoseHoldConfig {
    target_hold_seconds: number;
    foot_placement: string;
    foot_placement_landmark: string;
    standing_position: string;
    variant_name: string;
    safety_note: string | null;
    grace_period_seconds: number;
}

export interface TreePoseVoiceCues {
    trunk_sway: string;
    hip_unlevel: string;
    knee_bent: string;
    foot_too_low: string;
    arms_asymmetric: string;
    forward_head: string;
}

export interface TreePoseConfig {
    alignment_thresholds: TreePoseThresholds;
    hold_config: TreePoseHoldConfig;
    voice_cues: TreePoseVoiceCues;
    voice_cue_priority: string[];
    cue_cooldown_seconds: number;
    postural_flags: Record<string, boolean>;
}

export interface LegHoldState {
    holdSeconds: number;          // current accumulated hold time
    isHolding: boolean;           // currently in correct form
    isComplete: boolean;          // reached target
    graceFramesRemaining: number; // frames remaining in grace period
    consecutiveGoodFrames: number; // frames since last form correction
}

export interface TreePoseFrameResult {
    leftLeg: LegHoldState;
    rightLeg: LegHoldState;
    activeLeg: 'left' | 'right' | null;
    formErrors: string[];          // error keys that fired this frame
    isComplete: boolean;           // both legs done
}

export interface FormErrorLog {
    error_type: string;
    count: number;
    leg: 'left' | 'right' | 'both';
    timestamp_seconds: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Geometry helpers
// ─────────────────────────────────────────────────────────────────────────────

function computeAngle(a: {x:number,y:number}, b: {x:number,y:number}, c: {x:number,y:number}): number {
    const ab = { x: a.x - b.x, y: a.y - b.y };
    const cb = { x: c.x - b.x, y: c.y - b.y };
    const dot = ab.x * cb.x + ab.y * cb.y;
    const mag = Math.sqrt(ab.x**2 + ab.y**2) * Math.sqrt(cb.x**2 + cb.y**2);
    if (mag === 0) return 180;
    return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

export function createTreePoseTracker(
    config: TreePoseConfig,
    speak: (text: string, key: string, cooldownMs?: number) => void,
    logError: (errorType: string, leg: string, timestampSeconds: number) => void,
    getElapsedSeconds: () => number,
    frameRateFps: number = 30
) {
    const t = config.alignment_thresholds;
    const h = config.hold_config;
    const cues = config.voice_cues;
    const priority = config.voice_cue_priority;
    const COOLDOWN_MS = (config.cue_cooldown_seconds || 8) * 1000;
    const GRACE_FRAMES = Math.round(h.grace_period_seconds * frameRateFps); // 3s * 30fps = 90 frames
    const MIN_GOOD_FRAMES = t.min_hold_frames;

    // Per-leg hold state
    function makeLegState(): LegHoldState {
        return {
            holdSeconds: 0,
            isHolding: false,
            isComplete: false,
            graceFramesRemaining: 0,
            consecutiveGoodFrames: 0,
        };
    }

    const leftLeg = makeLegState();
    const rightLeg = makeLegState();

    // Error tracking
    const errorCounts: Record<string, { count: number; leg: string }> = {};
    const lastFireTime: Record<string, number> = {};
    let trunkSwayFiredOnce = false;

    // Last processed timestamp for delta-time hold calculation
    let lastFrameTimestamp: number | null = null;
    
    // Maintain a reference to the last returned state so it can be queried easily
    let lastResult: TreePoseFrameResult = {
        leftLeg: { ...leftLeg },
        rightLeg: { ...rightLeg },
        activeLeg: null,
        formErrors: [],
        isComplete: false
    };

    // ─── Per-leg hold timer logic ─────────────────────────────────────────

    function updateHoldTimer(leg: LegHoldState, formOk: boolean, deltaSeconds: number): void {
        if (leg.isComplete) return;

        if (formOk) {
            leg.consecutiveGoodFrames += 1;
            leg.graceFramesRemaining = 0;

            // Only accumulate hold time after the noise filter clears
            if (leg.consecutiveGoodFrames >= MIN_GOOD_FRAMES) {
                if (!leg.isHolding) {
                   speak("Holding...", "tree_holding", 2000);
                }
                leg.isHolding = true;
                leg.holdSeconds += deltaSeconds;
                if (leg.holdSeconds >= h.target_hold_seconds) {
                    leg.holdSeconds = h.target_hold_seconds;
                    leg.isComplete = true;
                    // Play completion sound/praise
                    speak("Great job, target reached! Switch legs if needed.", "tree_success", 5000);
                }
            }
        } else {
            // Form broke — start or continue grace period
            leg.consecutiveGoodFrames = 0;
            if (leg.isHolding) {
                leg.graceFramesRemaining = GRACE_FRAMES;
                leg.isHolding = false;
            }

            if (leg.graceFramesRemaining > 0) {
                // In grace period — hold time is paused but not reset
                leg.graceFramesRemaining -= 1;
            } else if (leg.graceFramesRemaining === 0 && leg.holdSeconds > 0) {
                // Grace expired — full reset
                leg.holdSeconds = 0;
                speak("Hold reset. Try again.", "tree_reset", 3000);
            }
        }
    }

    // ─── Form checks ──────────────────────────────────────────────────────

    function runFormChecks(lm: any[], standingLeg: 'left' | 'right'): string[] {
        const errors: string[] = [];

        const sl = standingLeg === 'left';
        
        // Ensure ALL required landmarks are available before checking form
        // Missing landmarks should just pause the timer, not crash.
        const requiredLms = [
            0, 11, 12, 15, 16, 23, 24, 25, 26, 27, 28
        ];
        
        for (const idx of requiredLms) {
             if (!lm[idx] || lm[idx].visibility < 0.5) { // Assuming MediaPipe visibility threshold
                 // If major landmarks are missing, we can't reliably assess form.
                 // Return a special error (or just normal form fail) so the timer pauses.
                 return ['landmarks_missing'];
             }
        }

        const standing_hip   = lm[sl ? 23 : 24];
        const standing_knee  = lm[sl ? 25 : 26];
        const standing_ankle = lm[sl ? 27 : 28];
        const raised_ankle   = lm[sl ? 28 : 27];
        // const raised_knee    = lm[sl ? 26 : 25]; // Not actively used currently
        // const raised_hip     = lm[sl ? 24 : 23]; // Not actively used currently

        // 1. Hip levelness
        const torso_height = Math.abs(lm[11].y - lm[23].y) || 0.001;
        const hip_diff_norm = Math.abs(lm[23].y - lm[24].y) / torso_height;
        if (hip_diff_norm > t.hip_levelness_threshold) errors.push('hip_unlevel');

        // 2. Raised foot too low
        // Determine minimum Y the raised foot must be ABOVE (MediaPipe: lower Y = higher body)
        let min_placement_y: number;
        switch (h.foot_placement_landmark) {
            case 'hip':   min_placement_y = standing_hip.y + 0.02; break;   // must be above hip
            case 'knee':  min_placement_y = standing_knee.y + 0.02; break;   // must be above knee
            case 'ankle': min_placement_y = standing_ankle.y + 0.02; break;  // just above ankle
            default:      min_placement_y = standing_ankle.y + 0.02;
        }
        // raised_ankle.y < min_placement_y means foot is TOO LOW (y too large = lower in frame)
        if (raised_ankle.y > min_placement_y + 0.05) errors.push('foot_too_low');

        // 3. Trunk sway — shoulder midpoint vs standing ankle X
        const shoulder_mid_x = (lm[11].x + lm[12].x) / 2;
        const sway = Math.abs(shoulder_mid_x - standing_ankle.x);
        if (sway > t.trunk_sway_threshold) errors.push('trunk_sway');

        // 4. Standing knee angle
        const knee_angle = computeAngle(standing_hip, standing_knee, standing_ankle);
        if (knee_angle < t.standing_knee_min_angle) errors.push('knee_bent');

        // 5. Arms asymmetric (skip for 60+ — threshold is null)
        if (t.wrist_height_symmetry_threshold !== null) {
            const wrist_diff = Math.abs(lm[15].y - lm[16].y);
            if (wrist_diff > t.wrist_height_symmetry_threshold) errors.push('arms_asymmetric');
        }

        // 6. Forward head (frontal view — nose X vs shoulder midpoint X)
        const forward_head_offset = Math.abs(lm[0].x - shoulder_mid_x);
        if (forward_head_offset > t.forward_head_threshold) errors.push('forward_head');

        return errors;
    }

    // ─── Voice cue firing with priority and cooldown ───────────────────────

    function fireCues(errors: string[], leg: 'left' | 'right'): void {
        const now = Date.now();

        // 0. Handle missing landmarks quietly (don't shout at them, just don't count)
        if (errors.includes('landmarks_missing')) {
            return;
        }

        // Find highest-priority error that has cooled down
        for (const errorKey of priority) {
            if (!errors.includes(errorKey)) continue;

            // Special rule: trunk_sway fires immediately on first occurrence (no cooldown)
            const isSafetyFirst = errorKey === 'trunk_sway' && !trunkSwayFiredOnce;
            const lastFire = lastFireTime[errorKey] ?? 0;
            const cooledDown = now - lastFire >= COOLDOWN_MS;

            if (isSafetyFirst || cooledDown) {
                const cueText = cues[errorKey as keyof TreePoseVoiceCues];
                if (cueText) {
                    speak(cueText, `tree_${errorKey}`, isSafetyFirst ? 0 : COOLDOWN_MS);
                    lastFireTime[errorKey] = now;
                    if (errorKey === 'trunk_sway') trunkSwayFiredOnce = true;

                    // Log the error
                    if (!errorCounts[errorKey]) errorCounts[errorKey] = { count: 0, leg };
                    errorCounts[errorKey].count += 1;
                    logError(errorKey, leg, getElapsedSeconds());
                }
                break; // Only one cue fires per frame
            }
        }
    }

    // ─── Determine active leg ─────────────────────────────────────────────

    function detectStandingLeg(lm: any[]): 'left' | 'right' | null {
        // Standing foot = foot with HIGHER Y value (lower in frame = closer to ground)
        // Raised foot = foot with LOWER Y value (higher in frame)
        const leftAnkleY = lm[27]?.y ?? 0;
        const rightAnkleY = lm[28]?.y ?? 0;

        // Must have a meaningful difference to confirm one foot is raised
        const diff = Math.abs(leftAnkleY - rightAnkleY);
        // Note: In 60+ (kickstand), the feet are very close together in Y. 
        // 0.05 might be too large a difference for kickstand. 
        // 0.02 or 0.03 is better for detecting a toe-touch.
        if (diff < 0.03) return null; // feet are at similar heights — not yet in pose

        return leftAnkleY > rightAnkleY ? 'left' : 'right';
    }

    // ─── Public API ───────────────────────────────────────────────────────

    return {
        /**
         * Call this once per MediaPipe frame.
         * @param lm - MediaPipe poseLandmarks array (33 items), normalized coords.
         * @param nowTimestamp - performance.now() or Date.now() in ms.
         */
        processFrame(lm: any[], nowTimestamp: number): TreePoseFrameResult {
            const deltaSeconds = lastFrameTimestamp !== null
                ? Math.min((nowTimestamp - lastFrameTimestamp) / 1000, 0.1) // cap at 100ms
                : 1 / frameRateFps;
            lastFrameTimestamp = nowTimestamp;

            // Determine which leg is standing
            const standingLeg = detectStandingLeg(lm);

            let formErrors: string[] = [];
            let activeLegState: LegHoldState | null = null;
            let activeLeg: 'left' | 'right' | null = null;

            if (standingLeg !== null) {
                // The RAISED leg's tracker accumulates hold time
                // (left leg hold = left foot is raised = standing on right leg)
                // Left leg hold means the person is actively balancing by raising their left leg.
                const raisedLeg = standingLeg === 'left' ? 'right' : 'left';
                activeLeg = raisedLeg;
                activeLegState = raisedLeg === 'left' ? leftLeg : rightLeg;
                
                formErrors = runFormChecks(lm, standingLeg);
                const formOk = formErrors.length === 0;

                updateHoldTimer(activeLegState, formOk, deltaSeconds);

                if (!formOk) fireCues(formErrors, raisedLeg);
            } else {
                 // Feet are together, not holding the pose.
                 // We should decay grace period for BOTH legs so they eventually reset
                 // if the person just puts their foot down.
                 
                 // Process missing form for left
                 if (!leftLeg.isComplete && leftLeg.holdSeconds > 0) {
                     leftLeg.isHolding = false;
                     leftLeg.consecutiveGoodFrames = 0;
                     if (leftLeg.graceFramesRemaining > 0) {
                         leftLeg.graceFramesRemaining -= 1;
                     } else {
                         leftLeg.holdSeconds = 0;
                     }
                 }
                 
                 // Process missing form for right
                 if (!rightLeg.isComplete && rightLeg.holdSeconds > 0) {
                     rightLeg.isHolding = false;
                     rightLeg.consecutiveGoodFrames = 0;
                     if (rightLeg.graceFramesRemaining > 0) {
                         rightLeg.graceFramesRemaining -= 1;
                     } else {
                         rightLeg.holdSeconds = 0;
                     }
                 }
            }

            lastResult = {
                leftLeg: { ...leftLeg },
                rightLeg: { ...rightLeg },
                activeLeg,
                formErrors,
                isComplete: leftLeg.isComplete && rightLeg.isComplete,
            };
            
            return lastResult;
        },

        getErrors(): FormErrorLog[] {
            return Object.entries(errorCounts).map(([type, data]) => ({
                error_type: type,
                count: data.count,
                leg: data.leg as 'left' | 'right' | 'both',
                timestamp_seconds: 0, // individual timestamps logged via logError
            }));
        },

        getLastResult(): TreePoseFrameResult {
            return lastResult;
        },

        reset(): void {
            Object.assign(leftLeg, makeLegState());
            Object.assign(rightLeg, makeLegState());
            Object.keys(errorCounts).forEach(k => delete errorCounts[k]);
            Object.keys(lastFireTime).forEach(k => delete lastFireTime[k]);
            trunkSwayFiredOnce = false;
            lastFrameTimestamp = null;
        },
    };
=======
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
>>>>>>> flexibility/exercise
}
