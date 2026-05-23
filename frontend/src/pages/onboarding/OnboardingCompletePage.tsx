import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useOnboardingStore } from "@/store/onboardingStore";
import { useUIStore } from "@/store/uiStore";
import { useAuth } from "@/hooks/useAuth";

// Confetti particle component
function ConfettiParticle({ delay, x, color }: { delay: number; x: number; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 1, y: -20, x, rotate: 0, scale: 1 }}
      animate={{
        opacity: [1, 1, 0],
        y: [0, 300, 500],
        x: [x, x + (Math.random() - 0.5) * 120, x + (Math.random() - 0.5) * 200],
        rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
        scale: [1, 0.8, 0.4],
      }}
      transition={{
        duration: 2.5 + Math.random(),
        delay,
        ease: "easeOut",
      }}
      className="absolute top-0 w-2.5 h-2.5 rounded-sm pointer-events-none"
      style={{ background: color, left: "50%" }}
    />
  );
}

const CONFETTI_COLORS = ["#4682B4", "#5BA3D0", "#DCEEFF", "#F59E0B", "#10B981", "#A78BFA"];

export function OnboardingCompletePage() {
  const navigate = useNavigate();
  const { reset } = useOnboardingStore();
  const { addToast } = useUIStore();
  const { user, setUser } = useAuth();

  const handleStart = () => {
    if (user) {
      setUser({ ...user, onboardingComplete: true });
    }
    
    addToast({
      title: "Setup Complete!",
      description: "Your personalized dashboard is ready.",
      type: "success",
    });
    reset();
    navigate("/dashboard");
  };

  // Generate confetti particles
  const confettiParticles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.8,
    x: (Math.random() - 0.5) * 400,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] as string,
  }));

  return (
    <div className="flex flex-col h-full min-h-screen items-center justify-center px-4 relative overflow-hidden" style={{ background: "#F8FAFC" }}>
      {/* Confetti */}
      <div className="absolute inset-0 flex items-start justify-center pointer-events-none overflow-hidden">
        {confettiParticles.map((p) => (
          <ConfettiParticle key={p.id} delay={p.delay} x={p.x} color={p.color} />
        ))}
      </div>

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-3xl opacity-15"
          style={{ background: "radial-gradient(circle, #4682B4 0%, transparent 70%)" }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center max-w-md">
        {/* Animated checkmark */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, type: "spring", stiffness: 200, delay: 0.2 }}
          className="mb-8 mx-auto"
        >
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center mx-auto"
            style={{
              background: "linear-gradient(135deg, #4682B4 0%, #5BA3D0 100%)",
              boxShadow: "0 8px 32px rgba(70, 130, 180, 0.3)",
            }}
          >
            <motion.svg
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <motion.path
                d="M20 6 9 17l-5-5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay: 0.6 }}
              />
            </motion.svg>
          </div>
        </motion.div>

        {/* Message */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-3xl font-bold mb-3"
          style={{ color: "#1E293B" }}
        >
          Your personalized coach is ready
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-base mb-10 leading-relaxed"
          style={{ color: "#64748B" }}
        >
          We created your first adaptive workout plan. Start training now and experience
          exercises that move with you.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Button
            onClick={handleStart}
            className="h-14 px-10 text-base"
            rightIcon={<ArrowRight size={18} />}
          >
            Start Training
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
