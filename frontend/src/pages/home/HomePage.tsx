import { useNavigate } from "react-router-dom";
import { 
  Activity, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck, 
  Volume2, 
  Ruler, 
  Stethoscope, 
  Play, 
  Dumbbell, 
  ChevronRight,
  Zap,
  Target,
  BarChart3,
  Award
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ROUTES } from "@/constants/routes";

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

  const featuredExercises = [
    {
      id: "1",
      name: "Squats",
      category: "Legs & Glutes",
      difficulty: "Beginner",
      desc: "Real-time knee alignment & hip depth analysis with instant depth cues.",
      image: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=600&q=80",
    },
    {
      id: "2",
      name: "Dumbbell Bicep Curl",
      category: "Arms & Biceps",
      difficulty: "Beginner",
      desc: "Elbow stabilization and extension tracking to maximize arm activation.",
      image: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=600&q=80",
    },
    {
      id: "3",
      name: "Tree Pose (Vrksasana)",
      category: "Balance & Core",
      difficulty: "Intermediate",
      desc: "Single-leg balance tracking and leg placement validation with timer.",
      image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=600&q=80",
    },
    {
      id: "4",
      name: "Butterfly Pose",
      category: "Flexibility & Hips",
      difficulty: "Beginner",
      desc: "Gentle hip opener tracking with posture hold metrics and relaxed stretch guidance.",
      image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=600&q=80",
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-dashboard)] text-[var(--text-main)] flex flex-col font-sans selection:bg-[var(--primary-light)] selection:text-white">
      {/* NAVIGATION HEADER */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-[var(--border-card)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div 
            onClick={() => navigate(ROUTES.HOME)}
            className="flex items-center gap-2 cursor-pointer font-extrabold text-xl text-[var(--primary-solid)] tracking-wider"
          >
            <div className="h-9 w-9 rounded-xl bg-[var(--accent-surface)] flex items-center justify-center text-[var(--primary-solid)] shadow-sm">
              <Activity className="h-5 w-5" />
            </div>
            <span>PoseFit</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-[var(--text-main)]/80">
            <a href="#features" className="hover:text-[var(--primary-solid)] transition-colors">Features</a>
            <a href="#exercises" className="hover:text-[var(--primary-solid)] transition-colors">Exercises</a>
            <a href="#how-it-works" className="hover:text-[var(--primary-solid)] transition-colors">How It Works</a>
            <a href="#telehealth" className="hover:text-[var(--primary-solid)] transition-colors">Doctors</a>
          </nav>

          <div className="flex items-center gap-3">
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
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--primary-light)]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--accent-surface)] border border-[var(--primary-light)]/30 text-[var(--accent-text)] text-xs font-bold uppercase tracking-wider"
              >
                <Sparkles className="h-4 w-4 text-[var(--primary-solid)]" />
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
                className="text-base sm:text-lg text-[var(--text-muted)] font-medium max-w-2xl mx-auto lg:mx-0 leading-relaxed"
              >
                Train with browser-native computer vision pose detection. Get immediate spoken audio feedback, personalized physiological profiling in feet & inches, and multi-goal routine tracking.
              </motion.p>

              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2"
              >
                <Button 
                  size="lg"
                  onClick={handleStartWorkout}
                  className="w-full sm:w-auto h-13 px-8 rounded-2xl bg-[var(--primary-solid)] hover:bg-[var(--primary-hover)] text-white text-base font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-3"
                >
                  <span>{isAuthenticated ? 'Go to Dashboard' : 'Start Free Training'}</span>
                  <ArrowRight className="h-5 w-5" />
                </Button>

                <Button 
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    const el = document.getElementById('exercises');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full sm:w-auto h-13 px-6 rounded-2xl border-[var(--border-card)] bg-white text-[var(--text-main)] text-base font-bold hover:bg-[var(--accent-surface)] transition-all flex items-center justify-center gap-2"
                >
                  <Play className="h-4 w-4 text-[var(--primary-solid)] fill-[var(--primary-solid)]" />
                  <span>Explore Exercises</span>
                </Button>
              </motion.div>

              {/* Highlights List */}
              <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs font-semibold text-[var(--text-muted)]">
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

            {/* Right Interactive Preview Card */}
            <div className="lg:col-span-5">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="relative"
              >
                <Card className="rounded-3xl p-6 bg-white border border-[var(--border-card)] shadow-xl space-y-6 relative overflow-hidden">
                  <div className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[var(--accent-surface)] flex items-center justify-center text-[var(--primary-solid)]">
                        <Zap className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[var(--text-main)]">Live Form Analyzer</h4>
                        <p className="text-xs text-[var(--text-muted)] font-medium">PoseFit AI Vision v2.4</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 font-bold px-3 py-1 rounded-full text-xs">
                      Live Active
                    </Badge>
                  </div>

                  {/* Mock Camera Viewfinder */}
                  <div className="relative h-56 w-full rounded-2xl bg-slate-950 overflow-hidden flex items-center justify-center">
                    <img 
                      src="https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=800&q=80" 
                      alt="Squat form analysis demo" 
                      className="w-full h-full object-cover opacity-65"
                    />

                    {/* AI Skeleton Grid Overlay Effect */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                    
                    {/* Simulated Joint Nodes */}
                    <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-emerald-400 border-2 border-white shadow-lg animate-ping" />
                    <div className="absolute top-1/2 left-1/3 w-3 h-3 rounded-full bg-teal-400 border-2 border-white shadow-lg" />
                    <div className="absolute top-1/2 right-1/3 w-3 h-3 rounded-full bg-teal-400 border-2 border-white shadow-lg" />
                    <div className="absolute bottom-1/4 left-2/5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white shadow-lg" />

                    {/* Form Score Badge */}
                    <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-xl text-white text-xs font-bold flex items-center gap-2">
                      <Award className="h-4 w-4 text-emerald-400" />
                      <span>Form Score: 98%</span>
                    </div>

                    {/* Voice Feedback Overlay */}
                    <div className="absolute bottom-3 inset-x-3 bg-white/95 backdrop-blur-md rounded-xl p-2.5 flex items-center gap-3 shadow-lg">
                      <div className="h-7 w-7 rounded-full bg-[var(--primary-solid)] flex items-center justify-center text-white shrink-0">
                        <Volume2 className="h-4 w-4 animate-pulse" />
                      </div>
                      <p className="text-xs font-bold text-slate-800 truncate">
                        "Great depth! Keep your chest lifted and push through your heels."
                      </p>
                    </div>
                  </div>

                  {/* Real-time stats row */}
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="p-2.5 rounded-xl bg-[var(--bg-dashboard)] border border-[var(--border-card)]">
                      <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] block">Hip Angle</span>
                      <span className="text-base font-extrabold text-[var(--primary-solid)]">92°</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[var(--bg-dashboard)] border border-[var(--border-card)]">
                      <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] block">Knee Alignment</span>
                      <span className="text-base font-extrabold text-emerald-600">Optimal</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[var(--bg-dashboard)] border border-[var(--border-card)]">
                      <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] block">Rep Count</span>
                      <span className="text-base font-extrabold text-[var(--text-main)]">12 / 15</span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </div>

          </div>
        </div>
      </section>

      {/* STATS PROOF BANNER */}
      <section className="bg-white border-y border-[var(--border-card)] py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <span className="text-3xl sm:text-4xl font-black text-[var(--primary-solid)]">99.8%</span>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-1">Form Accuracy</p>
            </div>
            <div>
              <span className="text-3xl sm:text-4xl font-black text-[var(--primary-solid)]">Real-Time</span>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-1">Spoken Voice Cues</p>
            </div>
            <div>
              <span className="text-3xl sm:text-4xl font-black text-[var(--primary-solid)]">100%</span>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-1">Browser Native & Private</p>
            </div>
            <div>
              <span className="text-3xl sm:text-4xl font-black text-[var(--primary-solid)]">Multi-Goal</span>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-1">Tailored Programs</p>
            </div>
          </div>
        </div>
      </section>

      {/* EXERCISES SHOWCASE SECTION */}
      <section id="exercises" className="py-20 bg-[var(--bg-dashboard)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
          
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <Badge variant="outline" className="text-[var(--primary-solid)] border-[var(--primary-light)]/40 bg-[var(--accent-surface)] font-bold">
              Supported Workouts
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-[var(--text-main)] tracking-tight">
              Interactive Pose-Guided Exercises
            </h2>
            <p className="text-sm sm:text-base text-[var(--text-muted)] font-medium leading-relaxed">
              Every exercise features step-by-step instructions, embedded HD video demonstrations, and computer vision pose tracking.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredExercises.map((ex) => (
              <Card 
                key={ex.id}
                variant="interactive"
                onClick={() => navigate(`/exercises/${ex.id}`)}
                className="overflow-hidden rounded-3xl border border-[var(--border-card)] bg-white shadow-sm hover:shadow-lg transition-all group flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                    <img 
                      src={ex.image} 
                      alt={ex.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-white/90 text-slate-800 font-bold backdrop-blur-md text-xs">
                        {ex.difficulty}
                      </Badge>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-200 block">
                        {ex.category}
                      </span>
                      <h3 className="text-lg font-extrabold truncate">{ex.name}</h3>
                    </div>
                  </div>

                  <div className="p-5">
                    <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed mb-4">
                      {ex.desc}
                    </p>
                  </div>
                </div>

                <div className="p-5 pt-0">
                  <Button 
                    variant="outline"
                    className="w-full rounded-xl text-xs font-bold border-[var(--border-card)] group-hover:bg-[var(--accent-surface)] group-hover:text-[var(--primary-solid)] transition-colors flex items-center justify-center gap-2"
                  >
                    <span>View Tutorial & Video</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <div className="text-center pt-4">
            <Button 
              onClick={() => navigate(ROUTES.EXERCISES)}
              className="bg-[var(--primary-solid)] hover:bg-[var(--primary-hover)] text-white font-bold px-8 h-12 rounded-2xl shadow-sm"
            >
              Browse All Workouts
            </Button>
          </div>

        </div>
      </section>

      {/* KEY FEATURES GRID SECTION */}
      <section id="features" className="py-20 bg-white border-t border-[var(--border-card)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-16">
          
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <Badge variant="outline" className="text-[var(--primary-solid)] border-[var(--primary-light)]/40 bg-[var(--accent-surface)] font-bold">
              Core Capabilities
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-[var(--text-main)] tracking-tight">
              Engineered for Precision & Rehabilitation
            </h2>
            <p className="text-sm sm:text-base text-[var(--text-muted)] font-medium">
              Everything you need to correct exercise posture, prevent injuries, and achieve steady progress.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="p-6 rounded-3xl bg-[var(--bg-dashboard)] border border-[var(--border-card)] space-y-4 hover:border-[var(--primary-light)] transition-all">
              <div className="w-12 h-12 rounded-2xl bg-[var(--accent-surface)] flex items-center justify-center text-[var(--primary-solid)]">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-main)]">Computer Vision Tracking</h3>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium leading-relaxed">
                Utilizes MediaPipe landmarks to calculate joint angles in real time. Analyzes squats, arm curls, tree pose, and stretching postures instantly.
              </p>
            </Card>

            <Card className="p-6 rounded-3xl bg-[var(--bg-dashboard)] border border-[var(--border-card)] space-y-4 hover:border-[var(--primary-light)] transition-all">
              <div className="w-12 h-12 rounded-2xl bg-[var(--accent-surface)] flex items-center justify-center text-[var(--primary-solid)]">
                <Volume2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-main)]">Real-Time Voice Coaching</h3>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium leading-relaxed">
                Clear text-to-speech audio feedback guides you through your workouts—notifying you if your body is out of frame or posture needs adjustment.
              </p>
            </Card>

            <Card className="p-6 rounded-3xl bg-[var(--bg-dashboard)] border border-[var(--border-card)] space-y-4 hover:border-[var(--primary-light)] transition-all">
              <div className="w-12 h-12 rounded-2xl bg-[var(--accent-surface)] flex items-center justify-center text-[var(--primary-solid)]">
                <Ruler className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-main)]">Feet & Inches Physiological Profile</h3>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium leading-relaxed">
                Input your height naturally in Feet & Inches with automatic internal centimeter conversion and dynamic BMI metric computation.
              </p>
            </Card>

            <Card className="p-6 rounded-3xl bg-[var(--bg-dashboard)] border border-[var(--border-card)] space-y-4 hover:border-[var(--primary-light)] transition-all">
              <div className="w-12 h-12 rounded-2xl bg-[var(--coral-surface)] flex items-center justify-center text-[var(--coral-text)]">
                <Target className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-main)]">Multi-Goal Customization</h3>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium leading-relaxed">
                Select and toggle multiple goals simultaneously—such as Build Muscle, Lose Weight, Flexibility, and Doctor Rehab recommendations.
              </p>
            </Card>

            <Card className="p-6 rounded-3xl bg-[var(--bg-dashboard)] border border-[var(--border-card)] space-y-4 hover:border-[var(--primary-light)] transition-all">
              <div className="w-12 h-12 rounded-2xl bg-[var(--accent-surface)] flex items-center justify-center text-[var(--primary-solid)]">
                <Stethoscope className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-main)]">Tele-Health Doctor Consultation</h3>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium leading-relaxed">
                Connect directly with medical specialists and physical therapists to receive certified rehabilitation plans and ongoing feedback.
              </p>
            </Card>

            <Card className="p-6 rounded-3xl bg-[var(--bg-dashboard)] border border-[var(--border-card)] space-y-4 hover:border-[var(--primary-light)] transition-all">
              <div className="w-12 h-12 rounded-2xl bg-[var(--accent-surface)] flex items-center justify-center text-[var(--primary-solid)]">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-main)]">Comprehensive Workout Logs</h3>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium leading-relaxed">
                Track session streaks, total hold durations, form scores, and completion histories with full statistical breakdown on your dashboard.
              </p>
            </Card>
          </div>

        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section id="how-it-works" className="py-20 bg-[var(--bg-dashboard)] border-t border-[var(--border-card)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-16">
          
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <Badge variant="outline" className="text-[var(--primary-solid)] border-[var(--primary-light)]/40 bg-[var(--accent-surface)] font-bold">
              Simple 4-Step Process
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-[var(--text-main)] tracking-tight">
              How PoseFit Works
            </h2>
            <p className="text-sm sm:text-base text-[var(--text-muted)] font-medium">
              Start receiving real-time exercise feedback in less than 2 minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-4 text-center sm:text-left">
              <div className="w-10 h-10 rounded-full bg-[var(--primary-solid)] text-white font-extrabold flex items-center justify-center text-sm shadow-md">
                1
              </div>
              <h4 className="font-bold text-lg text-[var(--text-main)]">Set Up Profile</h4>
              <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
                Input your height in Feet & Inches and select your primary goals (Build Muscle, Rehab, Flexibility).
              </p>
            </div>

            <div className="space-y-4 text-center sm:text-left">
              <div className="w-10 h-10 rounded-full bg-[var(--primary-solid)] text-white font-extrabold flex items-center justify-center text-sm shadow-md">
                2
              </div>
              <h4 className="font-bold text-lg text-[var(--text-main)]">Align Camera</h4>
              <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
                Place your device 1.5 meters away so your full body or required muscle group is visible in frame.
              </p>
            </div>

            <div className="space-y-4 text-center sm:text-left">
              <div className="w-10 h-10 rounded-full bg-[var(--primary-solid)] text-white font-extrabold flex items-center justify-center text-sm shadow-md">
                3
              </div>
              <h4 className="font-bold text-lg text-[var(--text-main)]">Perform Exercise</h4>
              <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
                Receive live posture scoring and instant spoken voice prompts guiding every rep and hold.
              </p>
            </div>

            <div className="space-y-4 text-center sm:text-left">
              <div className="w-10 h-10 rounded-full bg-[var(--primary-solid)] text-white font-extrabold flex items-center justify-center text-sm shadow-md">
                4
              </div>
              <h4 className="font-bold text-lg text-[var(--text-main)]">Review Progress</h4>
              <p className="text-xs text-[var(--text-muted)] font-medium leading-relaxed">
                Save session summaries, track streaks, and consult with doctors for tailored routine tweaks.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* CALL TO ACTION SECTION */}
      <section className="py-16 bg-gradient-to-br from-[var(--primary-solid)] to-[var(--primary-hover)] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Ready to Train with Perfect AI Form?
          </h2>
          <p className="text-base text-white/80 font-medium max-w-xl mx-auto">
            Experience real-time posture analysis, spoken voice feedback, and customized biometric routines today.
          </p>
          <div className="pt-2">
            <Button 
              size="lg"
              onClick={handleStartWorkout}
              className="bg-white text-[var(--primary-solid)] hover:bg-slate-100 font-bold px-8 h-13 rounded-2xl shadow-lg text-base"
            >
              <span>{isAuthenticated ? 'Go to Your Dashboard' : 'Get Started Now'}</span>
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
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

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-semibold">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#exercises" className="hover:text-white transition-colors">Exercises</a>
              <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
              <button onClick={() => navigate(ROUTES.DOCTORS)} className="hover:text-white transition-colors">Doctors</button>
              <button onClick={() => navigate(ROUTES.PROFILE)} className="hover:text-white transition-colors">Profile</button>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 text-center md:text-left flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <p>© {new Date().getFullYear()} PoseFit AI Workout Tracker. All rights reserved.</p>
            <p className="font-medium">Computer Vision Pose Detection & Voice Guidance</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
