import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, CheckCircle2, Upload } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageTransition } from "@/components/common/PageTransition";
import { useOnboardingStore } from "@/store/onboardingStore";
import { initializeCamera, processPose, processPoseOnImage, stopCamera } from "@/lib/camera_mediapipe";
import { biometricService } from "@/lib/api";
import { useUIStore } from "@/store/uiStore";

export function BodyPhotoPage() {
  const navigate = useNavigate();
  const { setField } = useOnboardingStore();
  const { addToast } = useUIStore();
  const [photoCaptured, setPhotoCaptured] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mode, setMode] = useState<"choice" | "camera" | "upload">("choice");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastAssessmentRef = useRef<any>(null);

  // Refs to avoid stale closures in processPose callback
  const isAnalyzingRef = useRef(isAnalyzing);
  const photoCapturedRef = useRef(photoCaptured);

  // Update refs when state changes
  useEffect(() => {
    isAnalyzingRef.current = isAnalyzing;
  }, [isAnalyzing]);
  useEffect(() => {
    photoCapturedRef.current = photoCaptured;
  }, [photoCaptured]);

  // Keep a fresh reference to handleCapture
  const handleCaptureRef = useRef<() => void>();

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

          if (!photoCapturedRef.current && !isAnalyzingRef.current && results.landmarks && results.landmarks.length >= 33) {
            const isFullyVisible = results.landmarks.every((l: any) => l.visibility && l.visibility > 0.65);
            if (isFullyVisible) {
              if (handleCaptureRef.current) {
                handleCaptureRef.current();
              }
            }
          }
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
    if (isAnalyzingRef.current || photoCapturedRef.current) return;

    if (!lastAssessmentRef.current) {
      addToast({ title: "Analysis Active", description: "Please wait for landmarks to position correctly.", type: "warning" });
      return;
    }

    const landmarks = lastAssessmentRef.current.landmarks;
    if (!landmarks || landmarks.length < 33) {
      addToast({ title: "Full Body Required", description: "Could not detect your body. Step into the frame.", type: "warning" });
      return;
    }

    // Require all 33 landmarks to be visible (visibility > 0.65)
    // The user requested: "when our whole body all 33 landmarks are visible than only the image should be accepted"
    const isFullBodyVisible = (landmarks: any) =>
      !!landmarks && landmarks.length >= 33 && landmarks.every((l: any) => l.visibility && l.visibility > 0.65);

    // Same payload shape for both the live camera capture and the uploaded photo:
    // the browser does all pose extraction, the backend contract is unchanged.
    const submitAssessment = async (assessment: any, dataUrl: string) => {
      setIsAnalyzing(true);
      await syncProfile();

      try {
        await biometricService.submitAssessment({
          image: dataUrl,
          raw_landmarks: assessment.landmarks,
          joint_angles: {
            knee: assessment.knee_angle,
            knee_right: assessment.kneeAngleRight,
            hip: assessment.hip_angle,
            hip_right: assessment.hipAngleRight,
            shoulder: assessment.shoulder_angle,
            shoulder_right: assessment.shoulderAngleRight,
            elbow: assessment.elbow_angle,
            elbow_right: assessment.elbowAngleRight,
            ankle: assessment.ankle_angle,
            ankle_right: assessment.ankleAngleRight,
            spine: assessment.spine_angle
          },
          deviations: assessment.deviations || {}
        });
        setPhotoCaptured(true);
        setField("photoTaken", true);
        addToast({ title: "Scan Complete", description: "Pose data and image stored safely.", type: "success" });
      } catch (e) {
        console.error("Assessment save failed", e);
        addToast({ title: "Storage Error", description: "Failed to persist scan data. Try again.", type: "error" });
      } finally {
        setIsAnalyzing(false);
      }
    };

    const handleCapture = async () => {
      if (!lastAssessmentRef.current) {
        addToast({ title: "Analysis Active", description: "Please wait for landmarks to position correctly.", type: "warning" });
        return;
      }

      if (!isFullBodyVisible(lastAssessmentRef.current.landmarks)) {
        addToast({ title: "Full Body Required", description: "Please ensure your entire body (head to toes) is clearly visible in the frame.", type: "warning" });
        return;
      }

      if (!videoRef.current || !canvasRef.current) return;

      // Capture current frame from canvas as base64 data URL, then release the camera
      const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.8);
      stopCamera(videoRef.current);

      await submitAssessment(lastAssessmentRef.current, dataUrl);
    };

    const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !canvasRef.current) return;

      setIsAnalyzing(true);
      const objectUrl = URL.createObjectURL(file);
      try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error("Image could not be decoded."));
          el.src = objectUrl;
        });

        const assessment = await processPoseOnImage(image, canvasRef.current);
        if (!assessment || !isFullBodyVisible(assessment.landmarks)) {
          addToast({ title: "Full Body Required", description: "This photo must show your entire body (head to toes) clearly.", type: "warning" });
          return;
        }

        lastAssessmentRef.current = assessment;
        await submitAssessment(assessment, canvasRef.current.toDataURL('image/jpeg', 0.8));
      } catch (e) {
        console.error("Photo analysis failed", e);
        addToast({ title: "Analysis Error", description: "Could not analyse that photo. Try another one.", type: "error" });
      } finally {
        URL.revokeObjectURL(objectUrl);
        setIsAnalyzing(false);
      }
    };

    const handleRetake = () => {
      setPhotoCaptured(false);
      setField("photoTaken", false);
      lastAssessmentRef.current = null;
      setMode("choice");
    };

    useEffect(() => {
      handleCaptureRef.current = handleCapture;
    }, [handleCapture]);

    useEffect(() => {
      startAnalysis();
      return () => {
        if (videoRef.current) stopCamera(videoRef.current);
      };
    }, [mode]);

    return (
      <PageTransition variant="slide" className="flex flex-col h-full overflow-y-auto pb-10 bg-[var(--bg-dashboard)]">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-[var(--text-main)] text-center">Posture Scan</h2>
          <p className="text-[var(--text-muted)] text-center">
            Stand centered in the frame. We will capture your alignment to build your custom plan.
          </p>
        </div>

        <div className="flex-1 space-y-6">
          <Card
            className="relative flex min-h-[400px] flex-col items-center justify-center border-2 overflow-hidden bg-black rounded-2xl shadow-xl"
            style={{
              borderStyle: photoCaptured ? "solid" : "dashed",
              borderColor: photoCaptured ? "#4682B4" : "#cbd5e1",
            }}
          >
            {!photoCaptured && (
              <>
                {mode === "camera" && (
                  <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-60" />
                )}
                <canvas
                  ref={canvasRef}
                  className={`absolute inset-0 w-full h-full object-cover z-10 ${mode === "choice" ? "hidden" : ""}`}
                  width={640}
                  height={480}
                />
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
              <div className="relative z-0 flex flex-col items-center text-white/40">
                {mode === "camera" ? (
                  <div className="flex flex-col items-center animate-pulse">
                    <Camera className="h-14 w-14 mb-3" />
                    <p className="text-sm font-semibold tracking-wide">Initializing AI Posture Engine...</p>
                  </div>
                ) : mode === "upload" ? (
                  <div className="flex flex-col items-center animate-pulse">
                    <Upload className="h-14 w-14 mb-3" />
                    <p className="text-sm font-semibold tracking-wide">Analysing your photo...</p>
                  </div>
                ) : (
                  <p className="text-sm font-semibold tracking-wide">Choose how to capture your posture</p>
                )}
              </div>
            )}
          </Card>

          {photoCaptured ? (
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" onClick={handleRetake} className="h-12 rounded-xl border-black-200 hover:bg-[var(--primary-light)]">Retake Scan</Button>
              <Button onClick={() => navigate("/onboarding/goal-selection")} className="h-12 rounded-xl bg-[var(--primary-solid)] hover:bg-[var(--primary-hover)] shadow-lg shadow-green-200">Continue</Button>
            </div>
          ) : (
            <div className="w-full">
              <Button onClick={handleCapture} className="w-full h-12 rounded-xl bg-[var(--primary-solid)] hover:bg-[var(--primary-hover)] shadow-sm shadow-green-200" isLoading={isAnalyzing}>
                {isAnalyzing ? "Capturing..." : "Auto-Capturing when full body visible..."}
              </Button>
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
