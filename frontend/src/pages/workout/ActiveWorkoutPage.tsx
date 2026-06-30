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
  
  const repState = useRef<'ready' | 'descending' | 'bottom' | 'ascending'>('ready');
  const lastCueTime = useRef(0);
  const CUE_COOLDOWN = 5000; // 5 seconds to prevent spam
  
  const sessionErrors = useRef<{error_type: string, timestamp: string}[]>([]);
  const currentRepErrors = useRef<string[]>([]);
  
  const visibleFrameCount = useRef(0);
  const [isFullyVisible, setIsFullyVisible] = useState(false);
  const hasAnnouncedStart = useRef(false);
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
      sessionErrors.current.push({ error_type: errorType, timestamp: seconds.toString() });
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
      const angle = results.knee_angle;
      const spineAngle = results.spine_angle;
      const thresholds = exercise.personalization.angle_ranges;
      const cues = exercise.personalization.voice_cues;

      if (!landmarks) return;

      const keyPoints = [23, 24, 25, 26, 27, 28];
      const allVisible = keyPoints.every(idx => landmarks[idx] && landmarks[idx].visibility > 0.7);

      if (allVisible) {
        visibleFrameCount.current += 1;
      } else {
        visibleFrameCount.current = 0;
      }

      if (visibleFrameCount.current >= 12 && !hasAnnouncedStart.current) {
        hasAnnouncedStart.current = true;
        setIsFullyVisible(true);
        speak("I see you. Let's start! Go down for your first squat.", true);
        return;
      }

      if (!isFullyVisible || isPaused) return;

      if (angle !== null) {
        // ENHANCED STATE MACHINE TO PREVENT DOUBLE COUNTING
        
        // 1. STARTING DESCENDING
        if (repState.current === 'ready' && angle < (thresholds.standing_threshold - 35)) {
          repState.current = 'descending';
          currentRepErrors.current = [];
          minAngleInCurrentRep.current = angle;
        } 
        
        // 2. MONITORING BOTTOM
        if (repState.current === 'descending') {
          if (angle < minAngleInCurrentRep.current) {
            minAngleInCurrentRep.current = angle;
          }

          // If they hit target depth
          if (angle < thresholds.bottom_max) {
             repState.current = 'bottom';
          }

          // Premature ascending check
          if (angle > minAngleInCurrentRep.current + 10) {
             // They started moving up before reaching peak depth
             if (minAngleInCurrentRep.current > thresholds.bottom_max + 15) {
                speak(cues.insufficient_depth || "Go lower next time.", false, 'insufficient_depth');
             }
             repState.current = 'ascending';
          }
        }

        // 3. AT BOTTOM
        if (repState.current === 'bottom') {
            if (angle < minAngleInCurrentRep.current) minAngleInCurrentRep.current = angle;
            
            // Too deep check
            if (angle < thresholds.too_deep_threshold) {
                speak(cues.excessive_depth || "A bit too deep.", false, 'excessive_depth');
            }

            // Moving up now
            if (angle > minAngleInCurrentRep.current + 8) {
                repState.current = 'ascending';
            }
        }

        // 4. COMPLETING
        if (repState.current === 'ascending' && angle > (thresholds.standing_threshold - 15)) {
          repState.current = 'ready';
          setReps(r => r + 1);
          if (currentRepErrors.current.length === 0) {
            speak("Perfect!", true);
          }
        }

        // FORM CHECK (ALWAYS ACTIVE)
        if (repState.current !== 'ready') {
            if (spineAngle !== null && spineAngle < 110) {
                speak(cues.forward_lean || "Chest up.", false, 'forward_lean');
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
      {/* HUD */}
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
              <span className="text-[8px] uppercase font-black text-white/40 tracking-[0.2em]">{isFullyVisible ? 'TRACKING' : 'CALIBRATING'}</span>
              <span className="font-black text-xs uppercase italic tracking-wider">{exercise?.name}</span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <div className="flex items-center gap-4 px-5 py-2 bg-black/60 rounded-xl border border-white/10 backdrop-blur-3xl shadow-[0_0_40px_rgba(0,0,0,0.5)]">
               <div className="flex flex-col items-center">
                <span className="text-[8px] uppercase font-black text-primary">Reps</span>
                <span className="text-xl font-black">{reps}</span>
              </div>
              <div className="w-[1px] h-4 bg-white/10" />
              <div className="flex flex-col items-center">
                <span className="text-[8px] uppercase font-black text-white/40">Time</span>
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
          <div className="text-center p-8 space-y-12 animate-in fade-in zoom-in duration-500">
            <div className="h-28 w-28 bg-primary/20 rounded-full flex items-center justify-center mx-auto text-primary shadow-2xl relative">
               <div className="absolute inset-0 rounded-full animate-ping bg-primary/10 opacity-30" />
               <CameraIcon size={40} className="relative z-10" />
            </div>
            <div className="space-y-4">
              <h3 className="text-4xl font-black tracking-tighter uppercase italic text-white">Coach Mode</h3>
              <p className="text-neutral-500 text-sm font-medium">Stand back so I can see your form</p>
            </div>
            <Button onClick={() => setIsCameraActive(true)} size="lg" className="rounded-full px-16 h-20 text-xl font-black shadow-2xl shadow-primary/20 transition-all active:scale-95 bg-primary hover:bg-primary/90">
              Start Life Session
            </Button>
          </div>
        ) : (
          <div className="w-full h-full touch-none relative">
            <canvas ref={canvasRef} className="w-full h-full object-cover" width={640} height={480} />
            {!isFullyVisible && (
              <div className="absolute inset-x-0 bottom-32 flex justify-center z-40 px-6">
                <div className="bg-black/80 border border-primary/20 px-10 py-4 rounded-full flex items-center gap-4 backdrop-blur-xl shadow-2xl shadow-primary/10">
                   <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                   <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Synching Physiology...</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CONTROLS */}
      {isCameraActive && (
        <div className="absolute bottom-12 left-0 right-0 z-[110] flex items-center justify-center gap-10 pointer-events-none">
          <Button variant="outline" size="icon" className="h-14 w-14 rounded-full border border-white/10 bg-black/40 text-white/50 pointer-events-auto backdrop-blur-md transition-all hover:bg-black/60" onClick={() => navigate("/dashboard")}>
            <SkipForward size={20} />
          </Button>

          <Button size="icon" className="h-20 w-20 rounded-full shadow-2xl shadow-primary/30 bg-primary hover:bg-primary/90 pointer-events-auto transition-transform active:scale-90" onClick={() => setIsPaused(!isPaused)}>
            {isPaused ? <Play size={32} className="ml-1" /> : <Pause size={32} />}
          </Button>

          <Button variant="outline" size="icon" className="h-14 w-14 rounded-full border border-white/10 bg-black/40 text-white/50 pointer-events-auto transition-all hover:bg-black/60" onClick={handleFinish}>
            <Square size={20} className="text-destructive font-black" />
          </Button>
        </div>
      )}
    </PageTransition>
  );
}
