/**
 * MediaPipe Activation Script with Full Body Detection
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

function calculateAngle(p1: any, p2: any, p3: any) {
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
        modelComplexity: 1, // High accuracy for full-body exercise
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
            // SQUAT ANALYSIS (Hips, Knees, Ankles)
            const rh = landmarks[24]; const rk = landmarks[26]; const ra = landmarks[28];
            const lh = landmarks[23]; const lk = landmarks[25]; const la = landmarks[27];
            const rs = landmarks[12]; // Right shoulder for spine angle

            let kneeAngle = null;
            if (rk && rh && ra && lk && lh && la) {
                const angleR = calculateAngle(rh, rk, ra);
                const angleL = calculateAngle(lh, lk, la);
                kneeAngle = (angleR + angleL) / 2;
            }

            const spineAngle = (rs && rh) ? calculateAngle(rs, rh, { x: rh.x, y: rh.y - 1 }) : null;

            onResults({
                landmarks,
                knee_angle: kneeAngle,
                spine_angle: spineAngle,
                image: results.image
            });

            // DRAW FULL BODY LANDMARKS (RESTORED)
            // @ts-ignore
            if (window.drawConnectors && window.POSE_CONNECTIONS) {
                // @ts-ignore
                window.drawConnectors(ctx, landmarks, window.POSE_CONNECTIONS, { color: '#ffffff', lineWidth: 2 });
                // @ts-ignore
                window.drawLandmarks(ctx, landmarks, { color: '#3b82f6', lineWidth: 1, radius: 2 });
            }

            // PERFORMANCE HUD: Draw Angle directly to Canvas (bypass React Render lag)
            ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
            ctx.fillRect(10, 10, 130, 45);
            ctx.strokeStyle = "#3b82f6";
            ctx.lineWidth = 2;
            ctx.strokeRect(10, 10, 130, 45);

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 14px Arial";
            ctx.fillText("LIVE ANGLE", 20, 28);
            
            ctx.fillStyle = kneeAngle && kneeAngle < 100 ? "#fbbf24" : "#ffffff";
            ctx.font = "bold 20px Courier New";
            ctx.fillText(`${kneeAngle ? Math.round(kneeAngle) : '--'}°`, 20, 48);
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
        cameraInstance.start().catch((err:any) => console.error("Camera start error:", err));
    }

    return () => {
        stopCamera(videoElement);
    };
}
