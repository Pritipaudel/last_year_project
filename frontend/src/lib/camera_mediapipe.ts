/**
 * MediaPipe Activation Script with Full Body Detection
 *
 * Algorithm 1 (calculateAngle): Joint Angle Calculation using Vector Dot Product.
 *   - Replaces the previous Math.atan2 approach with the named dot-product formula.
 *   - Time: O(1), Space: O(1). See full explanation in the function JSDoc.
 *
 * Algorithm 2 (ema): Exponential Moving Average smoothing applied per joint
 *   - Applied after angle calculation, before onResults callback fires.
 *   - Time: O(1)/call, Space: O(k). See ema_smoothing.ts.
 */

import { ExponentialMovingAverage } from './ema_smoothing';

let poseInstance: any = null;
let cameraInstance: any = null;

// Algorithm 2: Single shared EMA instance for the entire camera session.
// Tracks smoothed angle history for all named joints.
// alpha = 0.3 chosen for ~15fps: smooths ~2-frame noise window (133ms lag),
// within ACSM's 200ms feedback window for effective form cueing.
const ema = new ExponentialMovingAverage(0.3);

export async function initializeCamera(videoElement: HTMLVideoElement): Promise<boolean> {
    if (cameraInstance) {
        cameraInstance.stop();
        cameraInstance = null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return false;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 30 }
            },
            audio: false
        });

        videoElement.srcObject = stream;

        return new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                videoElement.play().then(() => resolve(true)).catch(() => resolve(false));
            };
        });
    } catch (err) {
        return false;
    }
}

export function stopCamera(videoElement?: HTMLVideoElement | null) {
    if (cameraInstance) {
        try {
            cameraInstance.stop();
            console.log("Camera instance stopped");
        } catch (e) {
            console.error("Error stopping camera", e);
        }
        cameraInstance = null;
    }
    if (poseInstance) {
        try {
            poseInstance.close();
            console.log("Pose instance closed");
        } catch (e) {
            console.error("Error closing pose", e);
        }
        poseInstance = null;
    }
    if (videoElement && videoElement.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
    }
}

/**
 * Algorithm 1: Joint Angle Calculation — Vector Dot Product Formula.
 *
 * NAME: Joint Angle Calculation (Vector Dot Product)
 * TIME COMPLEXITY:  O(1) — fixed arithmetic operations regardless of input.
 * SPACE COMPLEXITY: O(1) — only scalar variables; no arrays or objects allocated.
 *
 * WHY DOT PRODUCT (not atan2):
 *   The atan2 approach computes the angle of each ray from origin and subtracts.
 *   This can give inconsistent signs when the angle wraps past 180°. The dot
 *   product formula directly computes the cosine of the angle between two vectors,
 *   then applies acos — always giving a value in [0°, 180°] with no wrap-around.
 *
 * LINE-BY-LINE (for viva):
 *   1. Build vector BA = A - B  (from vertex B toward point A).
 *   2. Build vector BC = C - B  (from vertex B toward point C).
 *   3. dot = BAx*BCx + BAy*BCy  (dot product = |BA||BC|cos(θ)).
 *   4. Compute magnitudes: |BA| = sqrt(BAx²+BAy²), same for |BC|.
 *   5. Edge case: zero magnitude → return 0 (coincident landmarks).
 *   6. cosAngle = dot / (|BA| * |BC|).
 *   7. Clamp cosAngle to [-1, 1] — guards against floating-point drift
 *      that would make Math.acos return NaN.
 *   8. angleRad = Math.acos(clamped)  → angle in radians.
 *   9. Return angleRad * (180 / Math.PI)  → degrees in [0, 180].
 *
 * UNIT TEST:
 *   calculateAngle({x:0,y:1},{x:0,y:0},{x:1,y:0}) === 90.0  (right angle)
 */
export function calculateAngle(p1: any, p2: any, p3: any): number {
    // Step 1: Vector BA (from vertex p2 toward p1)
    const baX = p1.x - p2.x;
    const baY = p1.y - p2.y;

    // Step 2: Vector BC (from vertex p2 toward p3)
    const bcX = p3.x - p2.x;
    const bcY = p3.y - p2.y;

    // Step 3: Dot product  dot(BA, BC) = BAx*BCx + BAy*BCy
    const dotProduct = baX * bcX + baY * bcY;

    // Step 4: Magnitudes (Euclidean norm)
    const magBA = Math.sqrt(baX * baX + baY * baY);
    const magBC = Math.sqrt(bcX * bcX + bcY * bcY);

    // Step 5: Edge case — zero-length vector means coincident landmarks
    if (magBA === 0 || magBC === 0) return 0;

    // Step 6: Cosine of the angle between the two vectors
    const cosAngle = dotProduct / (magBA * magBC);

    // Step 7: Clamp to [-1, 1] to guard against floating-point drift
    // (e.g., 1.0000000003 would make Math.acos return NaN)
    const clamped = Math.max(-1, Math.min(1, cosAngle));

    // Step 8: Inverse cosine gives angle in radians
    const angleRad = Math.acos(clamped);

    // Step 9: Convert to degrees and return
    return angleRad * (180 / Math.PI);
}

export function processPose(
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement,
    onResults: (data: any) => void
) {
    const ctx = canvasElement.getContext('2d');
    if (!ctx) return () => { };

    // @ts-ignore
    if (!window.Pose) return () => { };

    // @ts-ignore
    if (!window.Pose) return () => { };

    // Reuse existing Pose instance to prevent expensive model reloading
    if (!poseInstance) {
        // @ts-ignore
        poseInstance = new window.Pose({
            locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
        });

        poseInstance.setOptions({
            useCpuInference: false,
            modelComplexity: 1,
            smoothLandmarks: true,
            minDetectionConfidence: 0.55,
            minTrackingConfidence: 0.55
        });
    }

    // Clear previous results callback to avoid memory leaks/double-firing
    poseInstance.onResults(() => { });

    poseInstance.onResults(buildFrameHandler(canvasElement, ctx, onResults));

    // @ts-ignore
    if (window.Camera) {
        // @ts-ignore
        cameraInstance = new window.Camera(videoElement, {
            onFrame: async () => {
                if (poseInstance) {
                    await poseInstance.send({ image: videoElement });
                }
            },
            width: 640,
            height: 480
        });
        cameraInstance.start().catch((err: any) => console.error("Camera start error:", err));
    }

    return () => {
        stopCamera(videoElement);
    };
}

/**
 * Runs the exact same landmark extraction / angle / EMA / drawing pipeline used by the
 * live camera loop on a single still image (e.g. a user-uploaded photo).
 *
 * Inputs:  imageElement — a fully loaded HTMLImageElement.
 *          canvasElement — canvas the annotated frame is drawn onto (same size as the live one).
 * Output:  the same results object shape the live `processPose` callback receives, or null
 *          if MediaPipe is unavailable or no body was detected in the image.
 * Assumes: the MediaPipe Pose UMD bundle is already loaded on `window`.
 */
export async function processPoseOnImage(
    imageElement: HTMLImageElement,
    canvasElement: HTMLCanvasElement
): Promise<any | null> {
    const ctx = canvasElement.getContext('2d');
    // @ts-ignore
    if (!ctx || !window.Pose) return null;

    // Dedicated single-shot instance: a still frame must not share smoothing/tracking
    // state with the live session, and it is closed immediately after use.
    // @ts-ignore
    const pose = new window.Pose({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });
    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    const detection = await new Promise<any | null>((resolve) => {
        const handleFrame = buildFrameHandler(canvasElement, ctx, resolve);
        pose.onResults((results: any) => {
            if (!results.poseLandmarks) {
                resolve(null);
                return;
            }
            handleFrame(results);
        });
        pose.send({ image: imageElement }).catch(() => resolve(null));
    });

    try {
        pose.close();
    } catch (e) {
        console.error("Error closing single-shot pose", e);
    }
    return detection;
}

function buildFrameHandler(
    canvasElement: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    onResults: (data: any) => void
) {
    return (results: any) => {
        if (!ctx) return;
        ctx.save();
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        // Draw video frame
        ctx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

        const landmarks = results.poseLandmarks;
        if (landmarks) {
            // ---- SQUAT LANDMARKS (unchanged) ----
            const rh = landmarks[24]; const rk = landmarks[26]; const ra = landmarks[28];
            const lh = landmarks[23]; const lk = landmarks[25]; const la = landmarks[27];
            const rs = landmarks[12]; // Right shoulder for spine angle
            const ls = landmarks[11]; // Left shoulder

            let kneeAngle: number | null = null;
            if (rk && rh && ra && lk && lh && la) {
                const confR = ((rh.visibility || 0) + (rk.visibility || 0) + (ra.visibility || 0)) / 3;
                const confL = ((lh.visibility || 0) + (lk.visibility || 0) + (la.visibility || 0)) / 3;
                const angleR = calculateAngle(rh, rk, ra);
                const angleL = calculateAngle(lh, lk, la);

                if (confR > 0.7 && confL > 0.7) {
                    kneeAngle = (angleR + angleL) / 2;
                } else if (confR > confL && confR > 0.4) {
                    kneeAngle = angleR;
                } else if (confL > 0.4) {
                    kneeAngle = angleL;
                }
            }

            const spineAngle = (rs && rh) ? calculateAngle(rs, rh, { x: rh.x, y: rh.y - 1 }) : null;

            // ---- CURL / UPPER BODY LANDMARKS ----
            // Elbow landmarks: 11=L_shoulder, 13=L_elbow, 15=L_wrist
            //                  12=R_shoulder, 14=R_elbow, 16=R_wrist
            const lElbow = landmarks[13]; const lWrist = landmarks[15];
            const rElbow = landmarks[14]; const rWrist = landmarks[16];

            let elbowAngleLeft: number | null = null;
            let elbowAngleRight: number | null = null;

            if (ls && lElbow && lWrist) {
                elbowAngleLeft = calculateAngle(ls, lElbow, lWrist);
            }
            if (rs && rElbow && rWrist) {
                elbowAngleRight = calculateAngle(rs, rElbow, rWrist);
            }

            // Trunk angle for body swing detection: angle at hip formed by shoulder-hip-vertical
            // Vertical reference point: directly below hip
            let trunkAngleLeft: number | null = null;
            let trunkAngleRight: number | null = null;
            if (ls && lh) {
                trunkAngleLeft = calculateAngle(ls, lh, { x: lh.x, y: lh.y + 1 });
            }
            if (rs && rh) {
                trunkAngleRight = calculateAngle(rs, rh, { x: rh.x, y: rh.y + 1 });
            }

            // ---- ALGORITHM 2: EMA SMOOTHING ----
            // Applied AFTER landmark extraction and angle calculation,
            // BEFORE values are fed to the state machine / rep counter.
            // Each joint angle is smoothed independently via the shared EMA instance.
            // First call per joint bootstraps with the raw value (no lag).
            // Subsequent calls blend: smoothed = 0.3 * raw + 0.7 * previous_smoothed
            let smoothKneeAngle: number | null = null;
            if (kneeAngle !== null) {
                smoothKneeAngle = ema.smooth('knee', kneeAngle);
            }

            let smoothSpineAngle: number | null = null;
            if (spineAngle !== null) {
                smoothSpineAngle = ema.smooth('spine', spineAngle);
            }

            let smoothElbowLeft: number | null = null;
            if (elbowAngleLeft !== null) {
                smoothElbowLeft = ema.smooth('elbow_left', elbowAngleLeft);
            }

            let smoothElbowRight: number | null = null;
            if (elbowAngleRight !== null) {
                smoothElbowRight = ema.smooth('elbow_right', elbowAngleRight);
            }

            let smoothTrunkLeft: number | null = null;
            if (trunkAngleLeft !== null) {
                smoothTrunkLeft = ema.smooth('trunk_left', trunkAngleLeft);
            }

            let smoothTrunkRight: number | null = null;
            if (trunkAngleRight !== null) {
                smoothTrunkRight = ema.smooth('trunk_right', trunkAngleRight);
            }

            onResults({
                landmarks,
                // Squat fields — EMA-smoothed
                knee_angle: smoothKneeAngle,
                spine_angle: smoothSpineAngle,
                image: results.image,
                // Curl fields — EMA-smoothed
                elbow_angle_left: smoothElbowLeft,
                elbow_angle_right: smoothElbowRight,
                // Raw landmark objects for positional form checks (unchanged)
                landmark_left_shoulder: ls,
                landmark_right_shoulder: rs,
                landmark_left_elbow: lElbow,
                landmark_right_elbow: rElbow,
                landmark_left_hip: lh,
                landmark_right_hip: rh,
                trunk_angle_left: smoothTrunkLeft,
                trunk_angle_right: smoothTrunkRight,
            });

            // DRAW FULL BODY LANDMARKS
            // @ts-ignore
            if (window.drawConnectors && window.POSE_CONNECTIONS) {
                // @ts-ignore
                window.drawConnectors(ctx, landmarks, window.POSE_CONNECTIONS, { color: '#ffffff', lineWidth: 2 });
                // @ts-ignore
                window.drawLandmarks(ctx, landmarks, { color: '#3b82f6', lineWidth: 1, radius: 2 });
            }

        }
        ctx.restore();
    };
}
