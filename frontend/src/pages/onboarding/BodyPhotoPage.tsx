import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Upload, CheckCircle2, RotateCcw, ThumbsUp } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageTransition } from "@/components/common/PageTransition";
import { useOnboardingStore } from "@/store/onboardingStore";
import { initializeCamera, processPose, stopCamera } from "@/lib/camera_mediapipe";
import { biometricService } from "@/lib/api";
import { useUIStore } from "@/store/uiStore";

export function BodyPhotoPage() {
  const navigate = useNavigate();
  const { setField } = useOnboardingStore();
  const { addToast } = useUIStore();
  const [photoCaptured, setPhotoCaptured] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastAssessmentRef = useRef<any>(null);

  const startAnalysis = async () => {
    console.log("🎬 Starting camera analysis...");
    if (videoRef.current && canvasRef.current) {
      console.log("✅ Video and Canvas refs available");
      const active = await initializeCamera(videoRef.current);
      if (active) {
        console.log("✅ Camera initialized, starting pose detection...");
        processPose(videoRef.current, canvasRef.current, (results) => {
          console.log("📊 Pose results received:", {
            hasLandmarks: !!results.landmarks,
            kneeAngle: results.knee_angle,
            shoulderAngle: results.shoulder_angle,
            hipAngle: results.hip_angle
          });
          lastAssessmentRef.current = results;
        });
      } else {
        console.error("❌ Camera initialization failed");
        addToast({ title: "Camera Error", description: "Could not access camera. Check permissions.", type: "error" });
      }
    } else {
      console.error("❌ Video or Canvas refs not available");
    }
  };

  const syncProfile = async () => {
     try {
       // Ensure user has a profile first (this triggers get_or_create on backend)
       await biometricService.saveProfile({ goal: 'assessment_init' });
     } catch (e) {
       console.error("Profile sync failed", e);
     }
  };

  const handleCapture = async () => {
    if (!lastAssessmentRef.current) {
      addToast({ title: "Analysis Active", description: "Please wait for landmarks to position correctly.", type: "warning" });
      return;
    }

    setIsAnalyzing(true);
    await syncProfile();

    if (videoRef.current && canvasRef.current) {
      // Capture current frame from canvas as base64 data URL
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);

      const payload = {
        image: dataUrl,
        raw_landmarks: lastAssessmentRef.current.landmarks,
        joint_angles: {
          knee: lastAssessmentRef.current.knee_angle,
          knee_right: lastAssessmentRef.current.kneeAngleRight,
          hip: lastAssessmentRef.current.hip_angle,
          hip_right: lastAssessmentRef.current.hipAngleRight,
          shoulder: lastAssessmentRef.current.shoulder_angle,
          shoulder_right: lastAssessmentRef.current.shoulderAngleRight,
          elbow: lastAssessmentRef.current.elbow_angle,
          elbow_right: lastAssessmentRef.current.elbowAngleRight,
          ankle: lastAssessmentRef.current.ankle_angle,
          ankle_right: lastAssessmentRef.current.ankleAngleRight,
          spine: lastAssessmentRef.current.spine_angle
        },
        deviations: lastAssessmentRef.current.deviations
      };

      try {
        // Stop camera before showing "Captured" UI
        stopCamera(videoRef.current!);
        
        await biometricService.submitAssessment(payload);
        setPhotoCaptured(true);
        setField("photoTaken", true);
        addToast({ title: "Scan Complete", description: "Pose data and image stored safely.", type: "success" });
      } catch (e) {
        console.error("Assessment save failed", e);
        addToast({ title: "Storage Error", description: "Failed to persist scan data. Try again.", type: "error" });
      } finally {
        setIsAnalyzing(false);
      }
    }
  };


  const handleRetake = () => {
    setPhotoCaptured(false);
    setField("photoTaken", false);
    setTimeout(() => startAnalysis(), 100);
  };

  useEffect(() => {
    startAnalysis();
    return () => {
      if (videoRef.current) stopCamera(videoRef.current);
    };
  }, []);

  return (
    <PageTransition variant="slide" className="flex flex-col h-full overflow-y-auto pb-10">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Posture Scan</h2>
        <p className="text-muted-foreground">
          Stand centered in the frame. We will capture your alignment to build your custom plan.
        </p>
      </div>

      <div className="flex-1 space-y-6">
        <Card
          className="relative flex min-h-[400px] flex-col items-center justify-center border-2 overflow-hidden bg-black rounded-2xl shadow-2xl"
          style={{
            borderStyle: photoCaptured ? "solid" : "dashed",
            borderColor: photoCaptured ? "#4682B4" : "#cbd5e1",
          }}
        >
          {!photoCaptured && (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-60" />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover z-10" width={640} height={480} />
            </>
          )}

          {photoCaptured ? (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center z-20 bg-white/95 p-10 rounded-3xl shadow-2xl backdrop-blur-md border border-white">
              <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Scan Complete</h3>
              <p className="text-sm text-slate-500 mt-2 text-center">Biomechanical markers extracted and stored securely.</p>
            </motion.div>
          ) : (
            <div className="relative z-0 flex flex-col items-center text-white/40 animate-pulse">
              <Camera className="h-14 w-14 mb-3" />
              <p className="text-sm font-semibold tracking-wide">Initializing AI Posture Engine...</p>
            </div>
          )}
        </Card>

        {photoCaptured ? (
          <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" onClick={handleRetake} className="h-12 rounded-xl">Retake Scan</Button>
            <Button onClick={() => navigate("/onboarding/goal-selection")} className="h-12 rounded-xl shadow-lg shadow-blue-200">Continue</Button>
          </div>
        ) : (
          <div className="w-full">
            <Button onClick={handleCapture} className="w-full h-12 rounded-xl bg-primary hover:bg-primary-hover shadow-lg shadow-blue-300" isLoading={isAnalyzing}>Capture Pose</Button>
          </div>
        )}

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
           <p className="text-xs text-slate-500 leading-relaxed text-center">
             <span className="font-bold">Privacy Guarantee:</span> Your image is analyzed in the browser. 
             Calculated skeletal data is stored securely for your coach to review.
           </p>
        </div>
      </div>
    </PageTransition>
  );
}
