import { useNavigate } from "react-router-dom";
import { 
  Activity, 
  ArrowRight, 
  CheckCircle2, 
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/constants/routes";
import { LanguageSwitcher } from "@/components/common/LanguageSwitcher";

export function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleStartWorkout = () => {
    if (isAuthenticated) {
      navigate(ROUTES.DASHBOARD);
    } else {
      navigate(ROUTES.WELCOME);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-dashboard)] text-[var(--text-main)] flex flex-col font-sans selection:bg-[var(--primary-light)] selection:text-white">
      {/* NAVIGATION HEADER */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-[var(--border-card)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div 
            onClick={() => navigate(ROUTES.HOME)}
            className="flex items-center gap-2 cursor-pointer font-extrabold text-xl text-[var(--primary-solid)] tracking-wider"
          >
            <span>PoseFit</span>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />

            {isAuthenticated ? (
              <Button 
                onClick={() => navigate(ROUTES.DASHBOARD)}
                className="bg-[var(--primary-solid)] hover:bg-[var(--primary-hover)] text-white font-bold rounded-xl px-5 h-10 shadow-sm flex items-center gap-2"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  onClick={() => navigate(ROUTES.WELCOME)}
                  className="font-bold text-sm text-[var(--text-main)] hover:text-[var(--primary-solid)]"
                >
                  Sign In
                </Button>
                <Button 
                  onClick={() => navigate(ROUTES.WELCOME)}
                  className="bg-[var(--primary-solid)] hover:bg-[var(--primary-hover)] text-white font-bold rounded-xl px-5 h-10 shadow-sm"
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative flex-1 pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--primary-light)]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="items-center">
            <div className="lg:col-span-7 space-y-6 text-center lg:text-center">
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="mt-10 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--accent-surface)] border border-[var(--primary-light)]/30 text-[var(--accent-text)] text-xs font-bold uppercase tracking-wider"
              >
                <span>Next-Gen AI Posture & Form Correction</span>
              </motion.div>

              <motion.h1 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-black text-[var(--text-main)] tracking-tight leading-[1.15]"
              >
                Master Your Form with <span className="text-[var(--primary-solid)] underline decoration-[var(--primary-light)]/40">Real-Time AI Voice</span> Cues
              </motion.h1>

              <motion.p 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="text-base sm:text-lg text-[var(--text-muted)] font-medium max-w-2xl mx-auto lg:text-center leading-relaxed"
              >
                Train with AI-based pose detection, get immediate audio feedback and personalize your exercise.
              </motion.p>

              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center justify-center lg:justify-center gap-4 pt-2"
              >
                <Button 
                  size="lg"
                  onClick={handleStartWorkout}
                  className="w-full sm:w-auto h-13 px-8 rounded-2xl bg-[var(--primary-solid)] hover:bg-[var(--primary-hover)] text-white text-base font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-3"
                >
                  <span>{isAuthenticated ? 'Go to Dashboard' : 'Start Free Training'}</span>
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </motion.div>

              {/* Highlights List */}
              <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-center gap-6 text-xs font-semibold text-[var(--text-muted)]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--primary-light)]" />
                  <span>No Special Sensors Required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--primary-light)]" />
                  <span>Live Spoken Voice Cues</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--primary-light)]" />
                  <span>100% Browser Native & Private</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2 font-extrabold text-xl text-white tracking-wider">
              <div className="h-8 w-8 rounded-xl bg-[var(--primary-solid)] flex items-center justify-center text-white">
                <Activity className="h-4 w-4" />
              </div>
              <span>PoseFit</span>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 text-center md:text-left flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <p>&copy; {new Date().getFullYear()} PoseFit AI Workout Tracker. All rights reserved.</p>
            <p className="font-medium">Computer Vision Pose Detection & Voice Guidance</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
