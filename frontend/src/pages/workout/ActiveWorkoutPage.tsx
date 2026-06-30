import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Pause, Play, Square, SkipForward, Camera as CameraIcon, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageTransition } from "@/components/common/PageTransition";
import { exerciseService, Exercise } from "@/services/exerciseService";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { initializeCamera, stopCamera, processPose } from "@/lib/camera_mediapipe";

// Visibility check — only needs hips and knees (not ankles) to be confident.
// Ankles often lose confidence during a deep squat and should NOT block feedback.
function isUpperLegVisible(landmarks: any[]): boolean {
  const criticalPoints = [23, 24, 25, 26]; // hips + knees ONLY
  return criticalPoints.every(idx => landmarks[idx] && landmarks[idx].visibility > 0.45);
}

// Body in frame = head + hips detectable. Returns true if person is present at all.
function isInFrame(landmarks: any[]): boolean {
  const bodyPoints = [0, 23, 24]; // nose + both hips
  return bodyPoints.some(idx => landmarks[idx] && landmarks[idx].visibility > 0.35);
}

// Returns true if hips are visible (person is in frame) but knees are not
function isHipsOnlyVisible(landmarks: any[]): boolean {
  const hipsVis = [23, 24].every(idx => landmarks[idx] && landmarks[idx].visibility > 0.35);
  const kneeVis = [25, 26].some(idx => landmarks[idx] && landmarks[idx].visibility > 0.45);
  return hipsVis && !kneeVis;
}

// Returns true if only head/upper chest is visible (no hips)
function isOnlyHeadVisible(landmarks: any[]): boolean {
  const headVis = landmarks[0] && landmarks[0].visibility > 0.4;
  const hipVis = [23, 24].some(idx => landmarks[idx] && landmarks[idx].visibility > 0.35);
  return headVis && !hipVis;
}

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
  const [trackingStatus, setTrackingStatus] = useState<'calibrating' | 'tracking' | 'lost'>('calibrating');

  // State machine: ready -> descending -> bottom -> ascending -> waiting_for_top -> ready
  const repState = useRef<'ready' | 'descending' | 'bottom' | 'ascending' | 'waiting_for_top'>('ready');
  
  // Voice cooldown management
  const lastSpokeAt = useRef<Record<string, number>>({});
  
  const sessionErrors = useRef<{ error_type: string, timestamp: string }[]>([]);
  const currentRepErrors = useRef<string[]>([]);

  const calibrationFrames = useRef(0);
  const calibrationAngles = useRef<number[]>([]);
  const calibratedStandingAngle = useRef<number | null>(null);
  const hasCalibrated = useRef(false);

  const minAngleInRep = useRef(180);
  const reachedBottom = useRef(false);
  const lastKnownAngle = useRef<number | null>(null); // Persists across low-visibility frames
  const consecutiveLostFrames = useRef(0);
  const LOST_THRESHOLD = 20;

  // Refs so the tracking callback always reads fresh values without re-subscribing
  const isPausedRef = useRef(false);
  const exerciseRef = useRef<Exercise | null>(null);
  const isMutedRef = useRef(false);

  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { exerciseRef.current = exercise; }, [exercise]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  // ---------- VOICE ENGINE ----------
  const speak = (text: string, key: string, cooldownMs = 4000) => {
    if (isMutedRef.current) return;
    const now = Date.now();
    if (now - (lastSpokeAt.current[key] || 0) < cooldownMs) return;
    lastSpokeAt.current[key] = now;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  };

  const speakImmediate = (text: string) => {
    if (isMutedRef.current) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  };

  // ---------- DATA FETCH ----------
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

  // ---------- TIMER ----------
  useEffect(() => {
    if (isPaused || trackingStatus !== 'tracking') return;
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isPaused, trackingStatus]);

  // ---------- CAMERA INIT ----------
  useEffect(() => {
    const init = async () => {
      if (isCameraActive && videoRef.current && canvasRef.current && exercise && !isPoseReady) {
        const success = await initializeCamera(videoRef.current);
        if (success) setIsPoseReady(true);
      }
    };
    init();
  }, [isCameraActive, exercise, isPoseReady]);

  // ---------- MAIN TRACKING LOOP ----------
  useEffect(() => {
    if (!isPoseReady || !exercise || !canvasRef.current || !videoRef.current) return;

    const stopPose = processPose(videoRef.current, canvasRef.current, (results) => {
      const landmarks = results.landmarks;
      const angle: number | null = results.knee_angle;
      const spineAngle: number | null = results.spine_angle;

      const ex = exerciseRef.current;
      if (!ex || !landmarks) return;

      const thresholds = ex.personalization.angle_ranges;
      const cues = ex.personalization.voice_cues;

      // ---- STEP 1: Visibility Checks ----
      const inFrame = isInFrame(landmarks);
      const legsVisible = isUpperLegVisible(landmarks);
      const onlyHead = isOnlyHeadVisible(landmarks);
      const hipsOnlyVisible = isHipsOnlyVisible(landmarks);

      if (!inFrame) {
        consecutiveLostFrames.current += 1;
        if (consecutiveLostFrames.current >= LOST_THRESHOLD) {
          if (trackingStatus !== 'lost') setTrackingStatus('lost');
          if (onlyHead) {
            speak("I can only see your head. Please step further back so your full body is visible.", "lost_view", 7000);
          } else {
            speak("You have left the camera view. Please step back into frame.", "lost_view", 7000);
          }
        }
        return;
      }

      // Person is in frame — reset lost counter and status
      consecutiveLostFrames.current = 0;
      if (trackingStatus === 'lost') setTrackingStatus(hasCalibrated.current ? 'tracking' : 'calibrating');

      // If hips visible but no legs — warn and skip rep logic (but don't say 'lost')
      if (hasCalibrated.current && hipsOnlyVisible) {
        speak("Step back — I cannot see your legs. Make sure your knees and hips are visible.", "legs_missing", 6000);
        return;
      }

      // ---- STEP 2: Calibration Phase ----
      if (!hasCalibrated.current) {
        if (legsVisible && angle !== null && angle > 155) {
          calibrationFrames.current += 1;
          calibrationAngles.current.push(angle);
        }

        if (calibrationFrames.current >= 12) {
          // Enough stable standing frames — finalize calibration
          const avg = calibrationAngles.current.reduce((a, b) => a + b, 0) / calibrationAngles.current.length;
          calibratedStandingAngle.current = avg;
          hasCalibrated.current = true;
          setTrackingStatus('tracking');
          speakImmediate("I can see you. Ready to begin — go down for your first rep.");
          console.log(`Calibrated standing angle: ${avg.toFixed(1)}°`);
        } else {
          setTrackingStatus('calibrating');
        }
        return;
      }

      // ---- STEP 3: After calibration ----
      // Update lastKnownAngle whenever we have a confident reading
      if (angle !== null && legsVisible) {
        lastKnownAngle.current = angle;
      }

      // Use lastKnownAngle as fallback when visibility briefly drops mid-squat
      // This is critical — deep squats often drop knee confidence
      const effectiveAngle = angle ?? lastKnownAngle.current;

      // If we are idle (ready/waiting) and can't see legs, don't process state machine
      const isIdle = repState.current === 'ready' || repState.current === 'waiting_for_top';
      if (isIdle && (!legsVisible || effectiveAngle === null)) {
        return;
      }
      if (effectiveAngle === null) return;

      // ---- STEP 4: Paused ----
      if (isPausedRef.current) return;

      // ---- STEP 5: State Machine ----
      // Default to 165 (typical standing) if calibration didn't complete — prevents thresholds being set too low
      const standingAngle = calibratedStandingAngle.current || Math.max(thresholds.standing_threshold, 160);
      const descendTrigger = standingAngle - 30;   // Enter rep when bent 30° below standing
      const completeTrigger = standingAngle - 15;  // Rep completes when ~15° below standing
      const resetTrigger = standingAngle - 8;      // Must be close to standing to start next rep

      // A. STANDING — waiting for squat to begin
      if (repState.current === 'ready') {
        if (effectiveAngle < descendTrigger) {
          repState.current = 'descending';
          minAngleInRep.current = effectiveAngle;
          reachedBottom.current = false;
          currentRepErrors.current = [];
          delete lastSpokeAt.current['go_lower'];
          delete lastSpokeAt.current['a_little_more'];
          delete lastSpokeAt.current['insufficient'];
        }
      }

      // B. DESCENDING
      else if (repState.current === 'descending') {
        if (effectiveAngle < minAngleInRep.current) minAngleInRep.current = effectiveAngle;

        const depthGap = effectiveAngle - thresholds.bottom_max;

        if (effectiveAngle < thresholds.bottom_max) {
          // HIT TARGET DEPTH
          repState.current = 'bottom';
          reachedBottom.current = true;
          speakImmediate("Good depth! Come back up.");
        } else if (depthGap > 20) {
          speak("Go lower.", "go_lower", 2500);
        } else if (depthGap > 5) {
          speak("A little more.", "a_little_more", 3000);
        }

        // Premature rise
        if (effectiveAngle > minAngleInRep.current + 12) {
          speak(cues.insufficient_depth || "Too shallow. Go deeper next time.", "insufficient", 3000);
          if (!currentRepErrors.current.includes('insufficient_depth')) {
            currentRepErrors.current.push('insufficient_depth');
            sessionErrors.current.push({ error_type: 'insufficient_depth', timestamp: seconds.toString() });
          }
          repState.current = 'ascending';
        }
      }

      // C. BOTTOM — at or below target depth
      else if (repState.current === 'bottom') {
        if (effectiveAngle < minAngleInRep.current) minAngleInRep.current = effectiveAngle;

        if (effectiveAngle < thresholds.too_deep_threshold) {
          speak(cues.excessive_depth || "That's deep enough, come up now.", "too_deep", 3000);
        }

        if (effectiveAngle > minAngleInRep.current + 8) {
          repState.current = 'ascending';
        }
      }

      // D. ASCENDING — coming back up
      else if (repState.current === 'ascending') {
        if (effectiveAngle > completeTrigger) {
          if (reachedBottom.current) {
            setReps(r => r + 1);
            repState.current = 'waiting_for_top';
            const praises = ["Perfect!", "Great rep!", "Keep it up!", "Excellent form!", "Nice work!"];
            const praise = praises[Math.floor(Math.random() * praises.length)];
            speakImmediate(praise || "Great rep!");
          } else {
            repState.current = 'waiting_for_top';
            speakImmediate("Rep not counted. Try going deeper on the next one.");
          }
        }
      }

      // E. RESET — must return near standing before next rep
      else if (repState.current === 'waiting_for_top') {
        if (effectiveAngle > resetTrigger) {
          repState.current = 'ready';
        }
      }

      // FORM CHECK — spine angle
      if (repState.current !== 'ready' && repState.current !== 'waiting_for_top') {
        if (spineAngle !== null && spineAngle < 105) {
          speak(cues.forward_lean || "Keep your chest up.", "spine", 5000);
        }
      }
    });

    return () => {
      if (stopPose) stopPose();
    };
  }, [isPoseReady]); // Run once when pose is ready

  // ---------- CLEANUP ----------
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      if (videoRef.current) stopCamera(videoRef.current);
    };
  }, []);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60).toString().padStart(2, "0");
    const s = (t % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleFinish = async () => {
    if (!exercise) return;
    speakImmediate("Workout complete. Well done!");
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
              <span className={`text-[8px] uppercase font-black tracking-[0.2em] ${
                trackingStatus === 'tracking' ? 'text-green-400' :
                trackingStatus === 'lost' ? 'text-red-400' : 'text-white/40'
              }`}>
                {trackingStatus === 'tracking' ? 'TRACKING' : trackingStatus === 'lost' ? 'LOST VIEW' : 'CALIBRATING'}
              </span>
              <span className="font-black text-xs uppercase italic tracking-wider">{exercise?.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 px-5 py-2 bg-black/60 rounded-xl border border-white/10 backdrop-blur-3xl">
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
              <p className="text-neutral-500 text-sm font-medium">Stand back so I can see your full body</p>
            </div>
            <Button onClick={() => setIsCameraActive(true)} size="lg" className="rounded-full px-16 h-20 text-xl font-black shadow-2xl shadow-primary/20 bg-primary hover:bg-primary/90">
              Start Live Session
            </Button>
          </div>
        ) : (
          <div className="w-full h-full touch-none relative">
            <canvas ref={canvasRef} className="w-full h-full object-cover" width={640} height={480} />
            {trackingStatus !== 'tracking' && (
              <div className="absolute inset-x-0 bottom-32 flex justify-center z-40 px-6">
                <div className={`px-10 py-4 rounded-full flex items-center gap-4 backdrop-blur-xl shadow-2xl border ${
                  trackingStatus === 'lost'
                    ? 'bg-red-900/80 border-red-500/40 shadow-red-500/20'
                    : 'bg-black/80 border-primary/20 shadow-primary/10'
                }`}>
                  <div className={`h-2 w-2 rounded-full animate-pulse ${trackingStatus === 'lost' ? 'bg-red-400' : 'bg-primary'}`} />
                  <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">
                    {trackingStatus === 'lost' ? 'Step back — needs full body' : 'Calibrating... Stand still'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CONTROLS */}
      {isCameraActive && (
        <div className="absolute bottom-12 left-0 right-0 z-[110] flex items-center justify-center gap-10 pointer-events-none">
          <Button variant="outline" size="icon" className="h-14 w-14 rounded-full border border-white/10 bg-black/40 text-white/50 pointer-events-auto" onClick={() => navigate("/dashboard")}>
            <SkipForward size={20} />
          </Button>

          <Button size="icon" className="h-20 w-20 rounded-full shadow-2xl shadow-primary/30 bg-primary hover:bg-primary/90 pointer-events-auto transition-transform active:scale-90" onClick={() => setIsPaused(!isPaused)}>
            {isPaused ? <Play size={32} className="ml-1" /> : <Pause size={32} />}
          </Button>

          <Button variant="outline" size="icon" className="h-14 w-14 rounded-full border border-white/10 bg-black/40 text-white/50 pointer-events-auto" onClick={handleFinish}>
            <Square size={20} className="text-destructive" />
          </Button>
        </div>
      )}
    </PageTransition>
  );
}
