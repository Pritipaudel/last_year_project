import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Pause, Play, Square, SkipForward, Camera as CameraIcon, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageTransition } from "@/components/common/PageTransition";
import { exerciseService, Exercise } from "@/services/exerciseService";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { initializeCamera, stopCamera, processPose } from "@/lib/camera_mediapipe";

export function ActiveWorkoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const exerciseId = queryParams.get('id');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [reps, setReps] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isPoseReady, setIsPoseReady] = useState(false);
  const [isUserInView, setIsUserInView] = useState(false);

  const repState = useRef<'up' | 'down'>('up');
  const lastCueTime = useRef(0);
  const CUE_COOLDOWN = 3000;
  
  // Track errors in current rep to give "Correct" feedback
  const currentRepErrors = useRef<string[]>([]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const speak = (text: string, force = false) => {
    if (isMuted) return;
    if (!force && Date.now() - lastCueTime.current < CUE_COOLDOWN) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
    lastCueTime.current = Date.now();
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (exerciseId) {
          const data = await exerciseService.getExerciseById(exerciseId);
          setExercise(data);
        } else {
          const all = await exerciseService.getExercises();
          const squat = all.find(ex => ex.name.toLowerCase().includes('squat'));
          setExercise(squat || all[0] || null);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [exerciseId]);

  useEffect(() => {
    if (isPaused || !isPoseReady || !isUserInView) return;
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isPaused, isPoseReady, isUserInView]);

  useEffect(() => {
    const init = async () => {
      if (isCameraActive && videoRef.current && canvasRef.current && exercise && !isPoseReady) {
        const success = await initializeCamera(videoRef.current);
        if (success) setIsPoseReady(true);
      }
    };
    init();
  }, [isCameraActive, exercise, isPoseReady]);

  useEffect(() => {
    if (!isPoseReady || !exercise || !canvasRef.current || !videoRef.current) return;

    processPose(videoRef.current, canvasRef.current, (results) => {
      const landmarks = results.landmarks;
      const angle = results.knee_angle || results.kneeAngleRight;
      const spineAngle = results.spine_angle;
      const thresholds = exercise.personalization.angle_ranges;
      const cues = exercise.personalization.voice_cues;

      if (!landmarks) return;

      // 1. POSITIONING FEEDBACK (Move Back, Right, Left)
      const criticalPoints = [11, 12, 23, 24, 25, 26, 27, 28]; // shoulders, hips, knees, ankles
      const avgVisibility = criticalPoints.reduce((acc, idx) => acc + landmarks[idx].visibility, 0) / criticalPoints.length;
      
      // Horizontal positioning
      const centerX = (landmarks[11].x + landmarks[12].x) / 2;
      
      let positioningCue = "";
      if (avgVisibility < 0.6) {
        positioningCue = "Move back. I need to see your full body.";
      } else if (centerX < 0.3) {
        positioningCue = "Move to your right.";
      } else if (centerX > 0.7) {
        positioningCue = "Move to your left.";
      }

      if (positioningCue) {
        if (isUserInView) setIsUserInView(false);
        speak(positioningCue, false);
        return;
      }

      if (!isUserInView) {
        setIsUserInView(true);
        speak("Start! Begin your squats.", true);
        return;
      }

      if (isPaused) return;

      // 2. REPS & PERFORMANCE FEEDBACK
      if (angle !== null) {
        // GOING DOWN
        if (repState.current === 'up' && angle < (thresholds.standing_threshold - 30)) {
          repState.current = 'down';
          currentRepErrors.current = []; // Reset errors for new rep
        } 
        
        // COMPLETING REP
        if (repState.current === 'down' && angle > (thresholds.standing_threshold - 15)) {
          repState.current = 'up';
          setReps(r => r + 1);
          
          // Positive feedback if no errors were spoken during the rep
          if (currentRepErrors.current.length === 0) {
            speak("Perfect! Correct way.", true);
          }
        }

        // 3. CORRECTION FEEDBACK
        if (repState.current === 'down') {
          if (angle > (thresholds.bottom_max + 15)) {
            const cue = cues.insufficient_depth || "Lower your hips a bit more.";
            speak(cue);
            if (!currentRepErrors.current.includes('depth')) currentRepErrors.current.push('depth');
          } else if (angle < thresholds.too_deep_threshold) {
            const cue = cues.excessive_depth || "Too deep.";
            speak(cue);
            if (!currentRepErrors.current.includes('depth')) currentRepErrors.current.push('depth');
          }
          
          if (spineAngle !== null && spineAngle < 110) {
            const cue = cues.forward_lean || "Keep your chest up.";
            speak(cue);
            if (!currentRepErrors.current.includes('lean')) currentRepErrors.current.push('lean');
          }
        }
      }
    });

  }, [isPoseReady, exercise, isPaused, isUserInView]);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      if (videoRef.current) stopCamera(videoRef.current);
    };
  }, []);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleFinish = async () => {
    if (!exercise) return;
    speak("Complete.", true);
    if (videoRef.current) stopCamera(videoRef.current);
    try {
      await exerciseService.submitSessionSummary({
        exercise_id: exercise.id,
        reps_completed: reps,
        duration_seconds: seconds,
        form_errors: [] 
      });
      navigate("/workout/summary", { state: { exerciseName: exercise.name, reps, duration: formatTime(seconds) } });
    } catch (e) {
      navigate("/dashboard");
    }
  };

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <PageTransition variant="fade" className="fixed inset-0 z-[100] flex flex-col bg-black text-white overflow-hidden">
      {/* HUD */}
      {isCameraActive && (
        <div className="absolute top-0 left-0 right-0 z-[110] flex items-center justify-between px-6 pt-12 pb-6 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-3">
             <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-white/60 bg-white/5 border border-white/10 rounded-full"
                onClick={() => setIsMuted(!isMuted)}
              >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </Button>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-white/40 tracking-[0.2em]">{isUserInView ? 'CONNECTED' : 'CALIBRATING'}</span>
              <span className="font-bold text-xs">{exercise?.name}</span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <div className="flex items-center gap-4 px-4 py-2 bg-black/60 rounded-2xl border border-white/5 backdrop-blur-3xl shadow-2xl">
              <div className="flex flex-col items-center">
                <span className="text-[8px] uppercase font-bold text-primary">Reps</span>
                <span className="text-2xl font-black">{reps}</span>
              </div>
              <div className="w-[1px] h-6 bg-white/10" />
              <div className="flex flex-col items-center">
                <span className="text-[8px] uppercase font-bold text-white/30">Time</span>
                <span className="text-2xl font-mono">{formatTime(seconds)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEWPORT */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none" playsInline />
        
        {!isCameraActive ? (
          <div className="text-center p-8 space-y-8 animate-in fade-in duration-500">
            <div className="h-24 w-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto text-primary shadow-[0_0_80px_rgba(70,130,180,0.2)]">
              <CameraIcon size={32} />
            </div>
             <div className="space-y-2">
              <h3 className="text-2xl font-black tracking-tight uppercase">AI TRAINER</h3>
              <p className="text-neutral-500 text-sm font-medium">Position full body for live guidance</p>
            </div>
            <Button onClick={() => setIsCameraActive(true)} size="lg" className="rounded-full px-12 h-16 text-lg font-black shadow-2xl shadow-primary/20">
              Start Session
            </Button>
          </div>
        ) : (
          <div className="w-full h-full touch-none relative">
            <canvas ref={canvasRef} className="w-full h-full object-cover" width={640} height={480} />
            
            {!isUserInView && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-md z-30">
                <div className="bg-black/90 border border-white/10 px-8 py-8 rounded-[2rem] text-center space-y-4 max-w-xs shadow-2xl">
                  <div className="flex justify-center"><LoadingSpinner size="lg" /></div>
                  <div className="space-y-1">
                    <p className="text-lg font-black text-primary tracking-widest uppercase">Calibrating</p>
                    <p className="text-xs text-neutral-400 leading-relaxed font-medium">Follow voice instructions to align your body perfectly.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FLOATING CONTROLS */}
      {isCameraActive && (
        <div className="absolute bottom-10 left-0 right-0 z-[110] flex items-center justify-center gap-8 pointer-events-none">
          <Button 
            variant="outline" size="icon" 
            className="h-14 w-14 rounded-full border-2 border-white/10 bg-black/20 hover:bg-black/40 pointer-events-auto backdrop-blur-xl"
            onClick={() => navigate(-1)}
          >
            <SkipForward size={20} className="text-white/40" />
          </Button>

          <Button 
            size="icon" 
            className="h-20 w-20 rounded-full shadow-2xl bg-primary hover:bg-primary/90 pointer-events-auto transition-transform active:scale-90"
            onClick={() => setIsPaused(!isPaused)}
          >
            {isPaused ? <Play size={32} className="ml-1" /> : <Pause size={32} />}
          </Button>

          <Button 
            variant="outline" size="icon" 
            className="h-14 w-14 rounded-full border-2 border-white/10 bg-black/20 hover:bg-black/40 pointer-events-auto backdrop-blur-xl"
            onClick={handleFinish}
          >
            <Square size={20} className="text-destructive font-bold" />
          </Button>
        </div>
      )}
    </PageTransition>
  );
}
