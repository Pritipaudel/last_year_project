/**
 * MediaPipe Activation Script with Full Body Detection
 *
 * Exports calculateAngle so curl_tracking.ts can reuse it without duplicating code.
 * Results callback now includes elbow angles (bilateral), shoulder Y coords,
 * trunk angle and hip landmark positions for form error detection.
 */

let poseInstance: any = null;
let cameraInstance: any = null;

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
        } catch(e) {
            console.error("Error stopping camera", e);
        }
        cameraInstance = null;
    }
    if (poseInstance) {
        try {
            poseInstance.close();
            console.log("Pose instance closed");
        } catch(e) {
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
 * Calculate the interior angle at point p2 (vertex) formed by p1–p2–p3.
 * Returns a value in degrees between 0 and 180.
 * Exported so curl_tracking.ts can reuse without duplicating.
 */
export function calculateAngle(p1: any, p2: any, p3: any): number {
    const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
}

export function processPose(
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement,
    onResults: (data: any) => void
) {
    const ctx = canvasElement.getContext('2d');
    if (!ctx) return () => {};

    // @ts-ignore
    if (!window.Pose) return () => {};

    // Cleanup previous if exists
    if (poseInstance || cameraInstance) {
        stopCamera(null);
    }

    // @ts-ignore
    poseInstance = new window.Pose({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    poseInstance.setOptions({
        modelComplexity: 1,     // High accuracy for full-body exercise
        smoothLandmarks: true,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55
    });

    poseInstance.onResults((results: any) => {
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
                const angleR = calculateAngle(rh, rk, ra);
                const angleL = calculateAngle(lh, lk, la);
                kneeAngle = (angleR + angleL) / 2;
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

            onResults({
                landmarks,
                // Squat fields (unchanged)
                knee_angle: kneeAngle,
                spine_angle: spineAngle,
                image: results.image,
                // Curl fields — null if landmarks not visible
                elbow_angle_left: elbowAngleLeft,
                elbow_angle_right: elbowAngleRight,
                // Raw landmark objects for form checks in curl_tracking.ts
                landmark_left_shoulder: ls,
                landmark_right_shoulder: rs,
                landmark_left_elbow: lElbow,
                landmark_right_elbow: rElbow,
                landmark_left_hip: lh,
                landmark_right_hip: rh,
                trunk_angle_left: trunkAngleLeft,
                trunk_angle_right: trunkAngleRight,
            });

            // DRAW FULL BODY LANDMARKS
            // @ts-ignore
            if (window.drawConnectors && window.POSE_CONNECTIONS) {
                // @ts-ignore
                window.drawConnectors(ctx, landmarks, window.POSE_CONNECTIONS, { color: '#ffffff', lineWidth: 2 });
                // @ts-ignore
                window.drawLandmarks(ctx, landmarks, { color: '#3b82f6', lineWidth: 1, radius: 2 });
            }

            // PERFORMANCE HUD: Draw angle to Canvas (bypass React render lag)
            // Show whichever angle is most relevant (elbow if available, else knee)
            const displayAngle = elbowAngleLeft ?? elbowAngleRight ?? kneeAngle;
            const displayLabel = (elbowAngleLeft !== null || elbowAngleRight !== null) ? "ELBOW" : "KNEE";
            const hudColor = displayAngle && displayAngle < 100 ? "#fbbf24" : "#ffffff";

            ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
            ctx.fillRect(10, 10, 140, 45);
            ctx.strokeStyle = "#3b82f6";
            ctx.lineWidth = 2;
            ctx.strokeRect(10, 10, 140, 45);
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 14px Arial";
            ctx.fillText(`LIVE ${displayLabel}`, 20, 28);
            ctx.fillStyle = hudColor;
            ctx.font = "bold 20px Courier New";
            ctx.fillText(`${displayAngle ? Math.round(displayAngle) : '--'}°`, 20, 48);
        }
        ctx.restore();
    });

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
