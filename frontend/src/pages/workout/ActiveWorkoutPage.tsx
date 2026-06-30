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
  
  // Advanced tracking state
  const repState = useRef<'up' | 'down'>('up');
  const lastCueTime = useRef(0);
  const CUE_COOLDOWN = 4000; // Increased cooldown to 4s to prevent repetition
  
  const sessionErrors = useRef<{type: string, timestamp: number}[]>([]);
  const currentRepErrors = useRef<string[]>([]);
  
  // Visibility calibration
  const visibleFrameCount = useRef(0);
  const REQUIRED_VISIBLE_FRAMES = 10; 
  const [isFullyVisible, setIsFullyVisible] = useState(false);
  const hasAnnouncedStart = useRef(false);

  // Depth tracking to avoid premature "go lower"
  const minAngleInCurrentRep = useRef(180);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const speak = (text: string, force = false, errorType?: string) => {
    if (isMuted) return;
    if (!force && Date.now() - lastCueTime.current < CUE_COOLDOWN) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
    lastCueTime.current = Date.now();

    if (errorType) {
      sessionErrors.current.push({ type: errorType, timestamp: seconds });
      if (!currentRepErrors.current.includes(errorType)) {
        currentRepErrors.current.push(errorType);
      }
    }
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
    if (isPaused || !isPoseReady || !isFullyVisible) return;
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isPaused, isPoseReady, isFullyVisible]);

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

      // 1. ROBUST VISIBILITY CHECK
      // Must see Hips(23,24), Knees(25,26), and Ankles(27,28) with high confidence
      const keyPoints = [23, 24, 25, 26, 27, 28];
      const allVisible = keyPoints.every(idx => landmarks[idx] && landmarks[idx].visibility > 0.75);

      if (allVisible) {
        visibleFrameCount.current += 1;
      } else {
        visibleFrameCount.current = 0;
        if (isFullyVisible) setIsFullyVisible(false);
      }

      // Only announce start after 10 clean frames of full body visibility
      if (visibleFrameCount.current >= REQUIRED_VISIBLE_FRAMES && !hasAnnouncedStart.current) {
        hasAnnouncedStart.current = true;
        setIsFullyVisible(true);
        speak("I can see you clearly now. Start your squats!", true);
        return;
      }

      if (!isFullyVisible || isPaused) return;

      // 2. INTELLIGENT REPS & FEEDBACK
      if (angle !== null) {
        // Going down phase
        if (repState.current === 'up' && angle < (thresholds.standing_threshold - 30)) {
          repState.current = 'down';
          currentRepErrors.current = [];
          minAngleInCurrentRep.current = angle;
        } 
        
        if (repState.current === 'down') {
          // Track the deepest point reached in this rep
          if (angle < minAngleInCurrentRep.current) {
            minAngleInCurrentRep.current = angle;
          }

          // INTELLIGENT DEPTH CUE
          // Only tell them to go deeper if they stop descending (angle starts increasing)
          // but they are still above the bottom_max target.
          const isAscending = angle > minAngleInCurrentRep.current + 5; 
          
          if (isAscending && minAngleInCurrentRep.current > (thresholds.bottom_max + 10)) {
            speak(cues.insufficient_depth || "Lower your hips a bit more.", false, 'insufficient_depth');
          } else if (angle < thresholds.too_deep_threshold) {
             speak(cues.excessive_depth || "Don't go too deep.", false, 'excessive_depth');
          }
          
          // Posture check
          if (spineAngle !== null && spineAngle < 110) {
            speak(cues.forward_lean || "Keep your chest up.", false, 'forward_lean');
          }
        }

        // Completing rep
        if (repState.current === 'down' && angle > (thresholds.standing_threshold - 15)) {
          repState.current = 'up';
          setReps(r => r + 1);
          if (currentRepErrors.current.length === 0) {
            speak("Perfect!", true);
          }
        }
      }
    });

  }, [isPoseReady, exercise, isPaused, isFullyVisible]);

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
    speak("Workout complete.", true);
    if (videoRef.current) stopCamera(videoRef.current);
    try {
      await exerciseService.submitSessionSummary({
        exercise_id: exercise.id,
        reps_completed: reps,
        duration_seconds: seconds,
        form_errors: sessionErrors.current
      });
      navigate("/workout/summary", { state: { exerciseName: exercise.name, reps, duration: formatTime(seconds) } });
    } catch (e) {
      navigate("/dashboard");
    }
  };

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <PageTransition variant="fade" className="fixed inset-0 z-[100] flex flex-col bg-black text-white overflow-hidden">
      {/* COMPACT HUD */}
      {isCameraActive && (
        <div className="absolute top-0 left-0 right-0 z-[110] flex items-center justify-between px-6 pt-12 pb-6 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-3">
             <Button 
                variant="ghost" size="icon" 
                className="h-8 w-8 text-white/50 bg-white/5 border border-white/10 rounded-full"
                onClick={() => setIsMuted(!isMuted)}
              >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </Button>
            <div className="flex flex-col">
              <span className="text-[8px] uppercase font-bold text-white/40 tracking-[0.2em]">{isFullyVisible ? 'READY' : 'POSITIONING'}</span>
              <span className="font-bold text-xs uppercase">{exercise?.name}</span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <div className="flex items-center gap-4 px-4 py-2 bg-black/60 rounded-xl border border-white/5 backdrop-blur-3xl">
              <div className="flex flex-col items-center">
                <span className="text-[8px] uppercase font-bold text-primary">Reps</span>
                <span className="text-xl font-black">{reps}</span>
              </div>
              <div className="w-[1px] h-4 bg-white/10" />
              <div className="flex flex-col items-center">
                <span className="text-[8px] uppercase font-bold text-white/30">Time</span>
                <span className="text-xl font-mono">{formatTime(seconds)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEWPORT */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none" playsInline />
        
        {!isCameraActive ? (
          <div className="text-center p-8 space-y-12">
            <div className="h-28 w-28 bg-primary/20 rounded-full flex items-center justify-center mx-auto text-primary shadow-2xl shadow-primary/30">
              <CameraIcon size={40} />
            </div>
            <div className="space-y-3">
              <h3 className="text-3xl font-black tracking-tighter uppercase italic">Ready?</h3>
              <p className="text-neutral-500 text-sm">Full body must be visible</p>
            </div>
            <Button onClick={() => setIsCameraActive(true)} size="lg" className="rounded-full px-16 h-20 text-xl font-black shadow-2xl shadow-primary/20">
              Go Live
            </Button>
          </div>
        ) : (
          <div className="w-full h-full touch-none relative">
            <canvas ref={canvasRef} className="w-full h-full object-cover" width={640} height={480} />
            
            {/* Calibration Warning */}
            {!isFullyVisible && (
              <div className="absolute inset-x-0 bottom-32 flex justify-center z-40 px-6">
                <div className="bg-black/80 border border-white/10 px-8 py-4 rounded-2xl flex items-center gap-4 shadow-2xl backdrop-blur-xl">
                  <LoadingSpinner size="sm" />
                  <p className="text-sm font-bold text-white uppercase tracking-widest animate-pulse">Waiting for full body view...</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FLOATING CONTROLS */}
      {isCameraActive && (
        <div className="absolute bottom-10 left-0 right-0 z-[110] flex items-center justify-center gap-8 pointer-events-none">
          <Button variant="outline" size="icon" className="h-14 w-14 rounded-full border-2 border-white/10 bg-black/20 pointer-events-auto backdrop-blur-xl" onClick={() => navigate(-1)}>
            <SkipForward size={20} className="text-white/40" />
          </Button>

          <Button size="icon" className="h-20 w-20 rounded-full shadow-2xl bg-primary pointer-events-auto" onClick={() => setIsPaused(!isPaused)}>
            {isPaused ? <Play size={32} className="ml-1" /> : <Pause size={32} />}
          </Button>

          <Button variant="outline" size="icon" className="h-14 w-14 rounded-full border-2 border-white/10 bg-black/20 pointer-events-auto" onClick={handleFinish}>
            <Square size={20} className="text-destructive font-bold" />
          </Button>
        </div>
      )}
    </PageTransition>
  );
}
