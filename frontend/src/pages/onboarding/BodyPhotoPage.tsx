import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Upload, CheckCircle2, RotateCcw, ThumbsUp } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageTransition } from "@/components/common/PageTransition";
import { useOnboardingStore } from "@/store/onboardingStore";

export function BodyPhotoPage() {
  const navigate = useNavigate();
  const { setField } = useOnboardingStore();
  const [photoCaptured, setPhotoCaptured] = useState(false);

  const handleCapture = () => {
    // In a real app, this would open device camera API
    setTimeout(() => {
      setPhotoCaptured(true);
      setField("photoTaken", true);
    }, 500);
  };

  const handleRetake = () => {
    setPhotoCaptured(false);
    setField("photoTaken", false);
  };

  const handleContinue = () => {
    navigate("/onboarding/goal-selection");
  };

  return (
    <PageTransition variant="slide" className="flex flex-col h-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Body Photo</h2>
        <p className="text-muted-foreground">
          Take a quick photo to help us track your posture and form. This is securely stored on your device.
        </p>
      </div>

      <div className="flex-1 space-y-6">
        {/* Camera preview / Capture area */}
        <Card
          className="flex h-64 flex-col items-center justify-center border-2 overflow-hidden"
          style={{
            borderStyle: photoCaptured ? "solid" : "dashed",
            borderColor: photoCaptured ? "#4682B4" : "#E2E8F0",
            background: photoCaptured ? "rgba(70, 130, 180, 0.04)" : "#F8FAFC",
          }}
        >
          {photoCaptured ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center"
            >
              <CheckCircle2 className="mb-4 h-16 w-16" style={{ color: "#10B981" }} />
              <p className="font-medium text-foreground">Photo captured successfully</p>
              <p className="text-xs text-muted-foreground mt-1">Pose landmarks detected</p>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center text-muted-foreground">
              {/* Silhouette overlay hint */}
              <div className="relative mb-4">
                <Camera className="h-12 w-12 opacity-40" />
              </div>
              <p className="text-sm font-medium">Position yourself within the frame</p>
              <div className="mt-3 space-y-1 text-xs text-center opacity-70">
                <p>• Stand sideways</p>
                <p>• Wear fitted clothes</p>
                <p>• Full body visible</p>
              </div>
            </div>
          )}
        </Card>

        {/* Action buttons */}
        {photoCaptured ? (
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              onClick={handleRetake}
              className="w-full"
              leftIcon={<RotateCcw className="h-4 w-4" />}
            >
              Retake
            </Button>
            <Button
              onClick={handleContinue}
              className="w-full"
              leftIcon={<ThumbsUp className="h-4 w-4" />}
            >
              Looks Good
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={handleCapture}
              className="w-full"
              leftIcon={<Camera className="h-4 w-4" />}
            >
              Take Photo
            </Button>
            <Button
              variant="outline"
              className="w-full"
              leftIcon={<Upload className="h-4 w-4" />}
            >
              Upload
            </Button>
          </div>
        )}

        {/* Privacy note */}
        <p className="text-xs text-center text-muted-foreground px-4">
          🔒 Your photo is processed locally and never leaves your device.
        </p>
      </div>

      <div className="pt-8 flex justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Back
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate("/onboarding/goal-selection")}
          className="text-muted-foreground"
        >
          Skip for now
        </Button>
      </div>
    </PageTransition>
  );
}
