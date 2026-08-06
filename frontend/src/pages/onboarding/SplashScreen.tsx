import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";

export function SplashScreen() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("Initializing...");

  useEffect(() => {
    // Simulated loading progress
    const steps = [
      { at: 300, progress: 30, text: "Loading core modules..." },
      { at: 800, progress: 60, text: "Preparing your experience..." },
      { at: 1400, progress: 90, text: "Almost ready..." },
      { at: 1800, progress: 100, text: "Ready!" },
    ];

    const timers = steps.map((step) =>
      setTimeout(() => {
        setProgress(step.progress);
        setStatusText(step.text);
      }, step.at)
    );

    const navTimer = setTimeout(() => {
      if (isAuthenticated) {
        if (user?.onboardingComplete === false) {
          navigate("/onboarding/physiological-profile");
        } else {
          navigate("/dashboard");
        }
      } else {
        navigate("/welcome");
      }
    }, 2200);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(navTimer);
    };
  }, [isAuthenticated, user, navigate]);

  return (
    <div
      className="flex h-screen w-full flex-col items-center justify-center overflow-hidden relative"
      style={{
        background: "linear-gradient(135deg, #1A3A5C 0%, #2F5F8A 40%, #4682B4 70%, #5BA3D0 100%)",
      }}
      role="status"
    >
      {/* Background glow orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-20 -left-20 w-96 h-96 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, #DCEEFF 0%, transparent 70%)" }}
        />
        <motion.div
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, #5BA3D0 0%, transparent 70%)" }}
        />
      </div>

      {/* Center content */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col items-center relative z-10"
      >
        {/* Pulsing Logo */}
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="mb-6 relative"
        >
          <div className="absolute inset-0 blur-xl opacity-40 rounded-2xl" style={{ background: "#DCEEFF" }} />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 shadow-lg">
            <svg
              width="56"
              height="56"
              viewBox="0 0 80 80"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="40" cy="15" r="8" stroke="white" strokeWidth="3" fill="none" opacity="0.9" />
              <path
                d="M40 23 C32 26, 28 32, 28 40 L28 55 C28 62, 32 68, 38 71 L42 73 C48 70, 52 64, 52 57 L52 42 C52 35, 48 29, 42 26 Z"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                opacity="0.9"
              />
              <path
                d="M28 55 L22 68 M52 57 L58 70 M38 71 L35 78 M42 73 L45 80"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.9"
              />
            </svg>
          </div>
        </motion.div>

        {/* App Name */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-4xl font-bold tracking-tight text-white"
        >
          PoseFit
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="mt-2 text-lg font-medium text-white/80"
        >
          Exercise that adapts to you
        </motion.p>

        {/* Progress Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-10 w-48"
        >
          <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden backdrop-blur-sm">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #DCEEFF, #ffffff)" }}
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          <p className="text-xs text-white/60 text-center mt-3 font-medium">{statusText}</p>
        </motion.div>
      </motion.div>

      {/* Screen reader announcement */}
      <div aria-live="polite" className="sr-only">
        {statusText}
      </div>
    </div>
  );
}
