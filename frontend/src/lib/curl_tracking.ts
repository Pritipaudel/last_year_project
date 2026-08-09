/**
 * curl_tracking.ts  — Bicep Curl bilateral state machine (v3)
 *
 * Fixes vs v2:
 *  - Praise uses a single shared `curl_praise` key (not per-side) so both
 *    arms completing the same rep don't both shout "Perfect".
 *  - `incomplete_extension` no longer fires every frame during normal lowering.
 *    It now only fires when the user starts a SECOND curl before fully extending,
 *    detected by re-entering 'curling_up' from 'lowering_down'.
 *  - `curlAttempted` threshold matches actual elbow travel (35° from start).
 *  - Peak noise filter: elbowAngle must stay < peak_max for MIN_PEAK_FRAMES
 *    consecutive frames before peakReached becomes true.
 *  - All form-error checks only run when arm is in an active state (not extended).
 */

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface CurlAngleConfig {
    extended_threshold: number;   // arm must return above this to complete rep
    peak_max: number;             // angle must drop below this to count a peak
    peak_min: number;             // safety floor (below = excessive curl)
    min_peak_frames: number;      // noise filter: frames must stay in peak zone
    position: string;             // "standing" | "seated" — pre-session hint only
}

export interface CurlVoiceCues {
    body_swing: string;
    elbow_swing: string;
    shoulder_elevation: string;
    insufficient_curl: string;
    incomplete_extension: string;
}

export interface CurlConfig {
    angle_ranges: CurlAngleConfig;
    voice_cues: CurlVoiceCues;
    voice_cue_priority: string[];
    cue_cooldown_seconds: number;
}

export interface FormError {
    error_type: string;
    count: number;
    timestamp: string;
}

export interface CurlFrameResult {
    leftReps: number;
    rightReps: number;
    totalReps: number;   // min(leftReps, rightReps) — the bilateral rep count
}

// State machine for one arm
type ArmState = 'extended' | 'curling_up' | 'peak' | 'lowering_down';

interface ArmTracker {
    state: ArmState;
    reps: number;
    peakFrameCount: number;
    peakReached: boolean;
    curlAttempted: boolean;         // true once arm bends 35°+ — prevents flinch noise
    invalidRep: boolean;
    prevState: ArmState;            // track transitions for incomplete_extension detection
    restingElbowX: number | null;
    restingShoulderY: number | null;
    calibrated: boolean;
    calibrationFrames: number;
    calibrationElbowXs: number[];
    calibrationShoulderYs: number[];
}

// ------------------------------------------------------------------
// Factory
// ------------------------------------------------------------------

export function createCurlTracker(
    config: CurlConfig,
    speak: (text: string, key: string, cooldownMs?: number) => void,
    logError: (errorType: string, timestampSeconds: number) => void,
    getElapsedSeconds: () => number
) {
    const thresholds = config.angle_ranges;
    const cues = config.voice_cues;
    const COOLDOWN_MS = (config.cue_cooldown_seconds || 8) * 1000;
    const MIN_PEAK_FRAMES = thresholds.min_peak_frames || 3;

    const left: ArmTracker = makeArm();
    const right: ArmTracker = makeArm();

    // Body swing: store trunk angle at rep start, compare each frame
    let trunkAngleAtRepStart: number | null = null;
    let trunkSwingWarned = false;

    const errorCounts: Record<string, number> = {};

    // ------------------------------------------------------------------
    // Per-arm state machine
    // ------------------------------------------------------------------

    function processArm(
        arm: ArmTracker,
        elbowAngle: number | null,
        elbowX: number | null,
        shoulderY: number | null,
        side: 'left' | 'right'
    ): void {
        if (elbowAngle === null) return; // landmark not visible this frame

        const t = thresholds;

        // ---- Calibration phase ----
        // Requires 20 frames with arm clearly extended (angle near extended_threshold)
        // so noise or bent-arm positions don't corrupt the baseline.
        if (!arm.calibrated) {
            if (elbowAngle > t.extended_threshold - 10) {
                arm.calibrationFrames += 1;
                if (elbowX !== null) arm.calibrationElbowXs.push(elbowX);
                if (shoulderY !== null) arm.calibrationShoulderYs.push(shoulderY);
            } else {
                // Arm is NOT extended — reset calibration to prevent partial baseline
                arm.calibrationFrames = Math.max(0, arm.calibrationFrames - 2);
            }
            if (arm.calibrationFrames >= 20) {
                arm.restingElbowX = average(arm.calibrationElbowXs);
                arm.restingShoulderY = average(arm.calibrationShoulderYs);
                arm.calibrated = true;
            }
            return;
        }

        const prevState = arm.state;

        // ---- State Machine ----

        // STATE: extended — resting position, waiting for curl to start
        if (arm.state === 'extended') {
            // Only enter curling_up if arm bends past 15° from threshold (noise guard)
            if (elbowAngle < t.extended_threshold - 15) {
                arm.state = 'curling_up';
                arm.peakFrameCount = 0;
                arm.peakReached = false;
                arm.curlAttempted = false;
                arm.invalidRep = false;
                trunkSwingWarned = false;
                trunkAngleAtRepStart = null;
            }
        }

        // STATE: curling_up — arm bending toward peak contraction
        else if (arm.state === 'curling_up') {
            // Mark as "intentional curl" once arm bends 35°+ from extended threshold
            if (elbowAngle < t.extended_threshold - 35) {
                arm.curlAttempted = true;
            }

            if (elbowAngle < t.peak_max) {
                // Entered the peak zone
                arm.state = 'peak';
                arm.peakFrameCount = 1;
            } else if (elbowAngle > t.extended_threshold - 10) {
                // Arm returned to extended without reaching peak — flinch or abort
                if (arm.curlAttempted) {
                    // Real attempt, but insufficient — fire cue
                    fireError('insufficient_curl', cues.insufficient_curl, side);
                }
                // Reset cleanly
                arm.state = 'extended';
                arm.peakFrameCount = 0;
                arm.peakReached = false;
                arm.curlAttempted = false;
                arm.invalidRep = false;
            }
        }

        // STATE: peak — arm is at contraction, waiting for hold then lower
        else if (arm.state === 'peak') {
            if (elbowAngle < t.peak_max) {
                arm.peakFrameCount += 1;
                arm.peakReached = arm.peakFrameCount >= MIN_PEAK_FRAMES;
            } else {
                // Angle increased past peak zone — start lowering
                arm.state = 'lowering_down';
            }
        }

        // STATE: lowering_down — arm returning to extended position
        else if (arm.state === 'lowering_down') {
            if (elbowAngle > t.extended_threshold - 10) {
                // Fully extended — rep cycle complete
                if (arm.peakReached) {
                    if (arm.invalidRep) {
                        speak("Form broken, no rep.", "curl_invalid", 3000);
                    } else {
                        arm.reps += 1;
                        const praises = ['Perfect!', 'Great curl!', 'Nice work!', 'Keep it up!', 'Excellent!'];
                        speak(praises[arm.reps % praises.length]!, 'curl_praise', 3500);
                    }
                } else if (arm.curlAttempted) {
                    // They tried a real curl but didn't hold the peak long enough
                    fireError('insufficient_curl', cues.insufficient_curl, side);
                }
                arm.state = 'extended';
                arm.peakFrameCount = 0;
                arm.peakReached = false;
                arm.curlAttempted = false;
                arm.invalidRep = false;
                trunkAngleAtRepStart = null;
            } else if (elbowAngle < t.peak_max) {
                // Arm went back INTO peak zone before fully extending — incomplete extension
                // This is the correct place to detect it: they started a second curl
                // without lowering all the way.
                if (arm.peakReached) {
                    // Only fire if the previous rep was valid (avoid noise on first reps)
                    fireError('incomplete_extension', cues.incomplete_extension, side);
                }
                // Treat as a new peak attempt
                arm.state = 'peak';
                arm.peakFrameCount = 0;
                arm.peakReached = false;
            }
        }

        arm.prevState = prevState;
    }

    // ------------------------------------------------------------------
    // Form error checks — only run when actively curling
    // ------------------------------------------------------------------

    function checkBodySwing(
        trunkAngleLeft: number | null,
        trunkAngleRight: number | null
    ): void {
        const isActive = left.state !== 'extended' || right.state !== 'extended';
        if (!isActive) {
            // Reset at rest — don't carry stale value into next rep
            trunkAngleAtRepStart = null;
            trunkSwingWarned = false;
            return;
        }

        const trunkAngle = (trunkAngleLeft ?? trunkAngleRight) ?? null;
        if (trunkAngle === null) return;

        if (trunkAngleAtRepStart === null) {
            trunkAngleAtRepStart = trunkAngle;
            return;
        }

        // 15° delta = obvious body momentum, not just natural sway
        const delta = Math.abs(trunkAngle - trunkAngleAtRepStart);
        if (delta > 15 && !trunkSwingWarned) {
            fireError('body_swing', cues.body_swing, 'both');
            trunkSwingWarned = true;
            left.invalidRep = true;
            right.invalidRep = true;
        }
    }

    function checkElbowSwing(
        arm: ArmTracker,
        elbowX: number | null,
        side: 'left' | 'right'
    ): void {
        if (!arm.calibrated || arm.restingElbowX === null || elbowX === null) return;
        if (arm.state === 'extended') return; // Only check during active movement

        // 0.12 units (12% of normalised frame width) = obvious forward movement of elbow
        const drift = Math.abs(elbowX - arm.restingElbowX);
        if (drift > 0.12) {
            fireError('elbow_swing', cues.elbow_swing, side);
            arm.invalidRep = true;
        }
    }

    function checkShoulderElevation(
        arm: ArmTracker,
        shoulderY: number | null,
        side: 'left' | 'right'
    ): void {
        if (!arm.calibrated || arm.restingShoulderY === null || shoulderY === null) return;
        if (arm.state === 'extended') return;

        // MediaPipe Y: 0 = top. Rising shoulder = smaller Y value.
        // 0.08 units = obvious shrug, not just posture variation
        const rise = arm.restingShoulderY - shoulderY;
        if (rise > 0.08) {
            fireError('shoulder_elevation', cues.shoulder_elevation, side);
            arm.invalidRep = true;
        }
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    const DEFAULT_CURL_CUES: Record<string, string> = {
        insufficient_curl: "Curl higher up to full contraction.",
        incomplete_extension: "Fully extend your arms at the bottom.",
        body_swing: "Keep your body still, avoid swinging.",
        elbow_swing: "Keep your elbows tucked into your sides.",
        shoulder_elevation: "Keep your shoulders down, do not shrug.",
    };

    function fireError(type: string, cueText: string | undefined, _side: string): void {
        const text = cueText || DEFAULT_CURL_CUES[type] || "Adjust your form and angle.";
        speak(text, `curl_${type}`, COOLDOWN_MS);
        errorCounts[type] = (errorCounts[type] || 0) + 1;
        logError(type, getElapsedSeconds());
    }

    function makeArm(): ArmTracker {
        return {
            state: 'extended',
            prevState: 'extended',
            reps: 0,
            peakFrameCount: 0,
            peakReached: false,
            curlAttempted: false,
            invalidRep: false,
            restingElbowX: null,
            restingShoulderY: null,
            calibrated: false,
            calibrationFrames: 0,
            calibrationElbowXs: [],
            calibrationShoulderYs: [],
        };
    }

    function average(arr: number[]): number | null {
        if (!arr.length) return null;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    return {
        processFrame(poseResults: any): CurlFrameResult {
            const {
                elbow_angle_left,
                elbow_angle_right,
                landmark_left_elbow,
                landmark_right_elbow,
                landmark_left_shoulder,
                landmark_right_shoulder,
                trunk_angle_left,
                trunk_angle_right,
            } = poseResults;

            const leftElbowX = landmark_left_elbow?.x ?? null;
            const rightElbowX = landmark_right_elbow?.x ?? null;
            const leftShoulderY = landmark_left_shoulder?.y ?? null;
            const rightShoulderY = landmark_right_shoulder?.y ?? null;

            processArm(left, elbow_angle_left, leftElbowX, leftShoulderY, 'left');
            processArm(right, elbow_angle_right, rightElbowX, rightShoulderY, 'right');

            // Form checks only run when at least one arm is calibrated and active
            if (left.calibrated || right.calibrated) {
                checkBodySwing(trunk_angle_left, trunk_angle_right);
            }
            if (left.calibrated && left.state !== 'extended') {
                checkElbowSwing(left, leftElbowX, 'left');
                checkShoulderElevation(left, leftShoulderY, 'left');
            }
            if (right.calibrated && right.state !== 'extended') {
                checkElbowSwing(right, rightElbowX, 'right');
                checkShoulderElevation(right, rightShoulderY, 'right');
            }

            return {
                leftReps: left.reps,
                rightReps: right.reps,
                totalReps: Math.min(left.reps, right.reps),
            };
        },

        /** True when at least one arm calibrated. */
        isCalibrated(): boolean {
            return left.calibrated || right.calibrated;
        },

        /** True when BOTH arms calibrated — required before "let's start". */
        bothCalibrated(): boolean {
            return left.calibrated && right.calibrated;
        },

        getCounts(): { left: number; right: number; total: number } {
            return {
                left: left.reps,
                right: right.reps,
                total: Math.min(left.reps, right.reps),
            };
        },

        getErrors(): Record<string, number> {
            return { ...errorCounts };
        },

        reset(): void {
            Object.assign(left, makeArm());
            Object.assign(right, makeArm());
            Object.keys(errorCounts).forEach(k => delete errorCounts[k]);
            trunkAngleAtRepStart = null;
            trunkSwingWarned = false;
        },
    };
}
