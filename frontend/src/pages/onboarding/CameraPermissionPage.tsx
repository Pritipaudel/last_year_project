import { useNavigate } from "react-router-dom";
import { Camera, Shield, Eye } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { PageTransition } from "@/components/common/PageTransition";
import { useOnboardingStore } from "@/store/onboardingStore";

export function CameraPermissionPage() {
  const navigate = useNavigate();
  const { setField } = useOnboardingStore();

  const handleAllow = () => {
    setField("cameraAllowed", true);
    navigate("/onboarding/body-photo");
  };

  const handleSkip = () => {
    setField("cameraAllowed", false);
    navigate("/onboarding/body-photo");
  };

  return (
    <PageTransition variant="slide" className="flex flex-col h-full">
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
        {/* Camera illustration */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
          className="mb-8"
        >
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto"
            style={{
              background: "linear-gradient(135deg, #DCEEFF 0%, #EBF4FF 100%)",
              border: "2px solid #B8D8F8",
            }}
          >
            <Camera size={40} strokeWidth={1.8} style={{ color: "#4682B4" }} />
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-2xl font-bold mb-3 text-foreground"
        >
          Camera Access
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-muted-foreground max-w-sm mb-8 leading-relaxed"
        >
          We use your camera to provide real-time exercise guidance. Your photos and videos are never uploaded to any server.
        </motion.p>

        {/* Usage cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="space-y-3 w-full max-w-sm mb-10"
        >
          {[
            { icon: Eye, title: "Posture Detection", desc: "Analyzes your form in real-time" },
            { icon: Camera, title: "Movement Tracking", desc: "Counts reps and tracks exercise range" },
            { icon: Shield, title: "Privacy First", desc: "All processing happens on your device" },
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="flex items-start gap-4 p-4 rounded-xl border text-left"
                style={{ background: "#FFFFFF", borderColor: "#E2E8F0" }}
              >
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "#EBF4FF" }}
                >
                  <Icon size={18} style={{ color: "#4682B4" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Actions */}
      <div className="pt-4 pb-2 space-y-3">
        <Button
          onClick={handleAllow}
          className="w-full h-14 text-base"
          leftIcon={<Camera size={18} />}
        >
          Allow Camera
        </Button>
      </div>
    </PageTransition>
  );
}
