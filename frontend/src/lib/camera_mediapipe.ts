/**
 * Live Browser Camera & MediaPipe Activation Script
 */

let poseInstance: any = null;
let cameraInstance: any = null;

export async function initializeCamera(videoElement: HTMLVideoElement): Promise<boolean> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error("❌ Browser does not support camera access.");
        return false;
    }

    try {
        console.log("📹 Requesting camera access...");
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                width: { ideal: 640 }, 
                height: { ideal: 480 }, 
                facingMode: "user" 
            },
            audio: false
        });
        
        videoElement.srcObject = stream;
        console.log("✅ Camera stream attached to video element");
        
        // Wait for video to be ready
        return new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                console.log("✅ Video metadata loaded, playing...");
                videoElement.play().then(() => {
                    console.log("✅ Video playing successfully");
                    resolve(true);
                }).catch((err) => {
                    console.error("❌ Error playing video:", err);
                    resolve(false);
                });
            };
        });
    } catch (err: any) {
        console.error("❌ Error accessing camera:", err);
        if (err.name === "NotAllowedError") {
            console.error("❌ Camera permission denied by user");
        } else if (err.name === "NotFoundError") {
            console.error("❌ No camera device found");
        }
        return false;
    }
}

export function stopCamera(videoElement: HTMLVideoElement) {
    console.log("🛑 Closing camera and cleaning up MediaPipe...");
    
    if (cameraInstance) {
        try {
            cameraInstance.stop();
        } catch (e) {
            console.error("Error stopping MediaPipe camera:", e);
        }
        cameraInstance = null;
    }

    if (poseInstance) {
        try {
            poseInstance.close();
        } catch (e) {
            console.error("Error closing Pose instance:", e);
        }
        poseInstance = null;
    }

    if (videoElement && videoElement.srcObject) {
        const stream = videoElement.srcObject as MediaStream;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            videoElement.srcObject = null;
        }
    }
}

export function processPose(
    videoElement: HTMLVideoElement, 
    canvasElement: HTMLCanvasElement, 
    onResults: (data: any) => void
) {
    const ctx = canvasElement.getContext('2d');
    if (!ctx) {
        console.error("❌ Canvas context not available");
        return;
    }

    // Check if Pose is available
    // @ts-ignore
    if (!window.Pose) {
        console.error("❌ MediaPipe Pose library not loaded. Check if scripts are loaded in index.html");
        return;
    }

    console.log("✅ MediaPipe Pose library detected");

    // Use MediaPipe Pose from window object
    // @ts-ignore
    poseInstance = new window.Pose({
        locateFile: (file: string) => {
            const url = `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
            console.log(`📦 Loading: ${file}`);
            return url;
        }
    });

    poseInstance.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    let frameCount = 0;
    let landmarkDetectedCount = 0;

    poseInstance.onResults((results: any) => {
        frameCount++;
        
        if (!results.poseLandmarks) {
            if (frameCount % 30 === 0) {
                console.warn(`⏳ Frame ${frameCount}: No pose landmarks detected yet...`);
            }
            return;
        }

        landmarkDetectedCount++;
        if (landmarkDetectedCount === 1) {
            console.log("✅ Landmarks detected! Drawing...");
        }

        // Clear and Draw video frame
        ctx.save();
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        ctx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
        
        // DRAW LANDMARKS with better error handling
        try {
            // @ts-ignore
            if (window.drawConnectors && window.drawLandmarks) {
                // @ts-ignore
                window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS,
                    { color: '#FFFFFF', lineWidth: 3 });
                // @ts-ignore
                window.drawLandmarks(ctx, results.poseLandmarks,
                    { color: '#4682B4', lineWidth: 2, radius: 3 });
            } else {
                console.warn("⚠️ Drawing utilities not available");
            }
        } catch (e) {
            console.error("❌ Error drawing landmarks:", e);
        }
        ctx.restore();
        
        // Calculate joint angles
        const landmarks = results.poseLandmarks;
        const angles = calculateAllAngles(landmarks);
        
        onResults({
            landmarks: landmarks,
            knee_angle: angles.kneeAngle,
            kneeAngleRight: angles.kneeAngleRight,
            hip_angle: angles.hipAngle,
            hipAngleRight: angles.hipAngleRight,
            shoulder_angle: angles.shoulderAngle,
            shoulderAngleRight: angles.shoulderAngleRight,
            elbow_angle: angles.elbowAngle,
            elbowAngleRight: angles.elbowAngleRight,
            ankle_angle: angles.ankleAngle,
            ankleAngleRight: angles.ankleAngleRight,
            spine_angle: angles.spineAngle,
            deviations: {
                knee_hyperextension: angles.kneeAngle !== null && angles.kneeAngle > 185,
                knee_valgus: false, // Placeholder for external validation
                forward_head: angles.shoulderAngle !== null && angles.shoulderAngle < 45,
                rounded_shoulders: false // Placeholder
            },
            timestamp: new Date().toISOString()
        });
    });

    // Initialize and start processing
    console.log("🚀 Initializing MediaPipe Pose...");
    
    // Use the official MediaPipe Camera utility which is more robust
    // @ts-ignore
    if (window.Camera) {
        // @ts-ignore
        cameraInstance = new window.Camera(videoElement, {
            onFrame: async () => {
                try {
                    await poseInstance.send({ image: videoElement });
                } catch (e) {
                    console.error("❌ Error processing pose frame:", e);
                }
            },
            width: 640,
            height: 480
        });
        cameraInstance.start().then(() => {
            console.log("✅ MediaPipe Camera utility started");
        }).catch((err: any) => {
            console.error("❌ Error starting MediaPipe Camera utility:", err);
        });
    } else {
        // Fallback if camera_utils isn't loaded
        console.warn("⚠️ MediaPipe Camera utility not found. Falling back to manual frame loading.");
        async function sendFrame() {
            if (videoElement.srcObject && !videoElement.paused && !videoElement.ended) {
                try {
                    await poseInstance.send({ image: videoElement });
                } catch (e) {
                    console.error("❌ Error processing pose frame:", e);
                }
                requestAnimationFrame(sendFrame);
            }
        }
        
        if (poseInstance.initialize) {
            poseInstance.initialize().then(() => {
                console.log("✅ MediaPipe Pose initialized successfully");
                sendFrame();
            }).catch((err: any) => {
                console.error("❌ Error initializing MediaPipe Pose:", err);
            });
        } else {
            sendFrame();
        }
    }
}

function calculateAngle(p1: any, p2: any, p3: any): number | null {
    try {
        if (!p1 || !p2 || !p3) return null;
        
        // MediaPipe guesses off-screen coordinates. We must strictly filter by visibility.
        const VISIBILITY_THRESHOLD = 0.5;
        if (
            p1.visibility < VISIBILITY_THRESHOLD || 
            p2.visibility < VISIBILITY_THRESHOLD || 
            p3.visibility < VISIBILITY_THRESHOLD
        ) {
            return null; // Joint is not captured clearly in the frame
        }
        
        const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
        let angle = Math.abs(radians * 180.0 / Math.PI);
        if (angle > 180.0) angle = 360 - angle;
        return Math.round(angle * 10) / 10; // Round to 1 decimal place
    } catch (e) {
        console.error("❌ Error calculating angle:", e);
        return null;
    }
}

function calculateAllAngles(landmarks: any[]): any {
    return {
        // Knee angle (left and right) (Hip -> Knee -> Ankle)
        kneeAngle: calculateAngle(landmarks[23], landmarks[25], landmarks[27]),
        kneeAngleRight: calculateAngle(landmarks[24], landmarks[26], landmarks[28]),
        
        // Hip angle (Shoulder -> Hip -> Knee)
        hipAngle: calculateAngle(landmarks[11], landmarks[23], landmarks[25]),
        hipAngleRight: calculateAngle(landmarks[12], landmarks[24], landmarks[26]),
        
        // Shoulder angle (Hip -> Shoulder -> Elbow)
        shoulderAngle: calculateAngle(landmarks[23], landmarks[11], landmarks[13]),
        shoulderAngleRight: calculateAngle(landmarks[24], landmarks[12], landmarks[14]),
        
        // Elbow angle (Shoulder -> Elbow -> Wrist)
        elbowAngle: calculateAngle(landmarks[11], landmarks[13], landmarks[15]),
        elbowAngleRight: calculateAngle(landmarks[12], landmarks[14], landmarks[16]),
        
        // Ankle angle (Knee -> Ankle -> Foot Index)
        ankleAngle: calculateAngle(landmarks[25], landmarks[27], landmarks[31]),
        ankleAngleRight: calculateAngle(landmarks[26], landmarks[28], landmarks[32]),
        
        // Spine/Neck angle (Ear -> Shoulder -> Hip)
        spineAngle: calculateAngle(landmarks[3], landmarks[11], landmarks[23])
    };
}
