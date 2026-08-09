import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Pause, Play, Square, SkipForward, Camera as CameraIcon, Volume2, VolumeX, Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageTransition } from "@/components/common/PageTransition";
import { exerciseService, Exercise, isCurlExercise, isStaticHoldExercise } from "@/services/exerciseService";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { initializeCamera, stopCamera, processPose } from "@/lib/camera_mediapipe";
import { createCurlTracker } from "@/lib/curl_tracking";
import { createTreePoseTracker } from "@/lib/tree_pose_tracking";
import { createButterflyTracker } from "@/lib/butterfly_tracking";
import { buildCueAudioIndex, preloadCueAudio, getTTSAudioUrl } from "@/lib/cueAudio";

// ================================================================
// VISIBILITY HELPERS
// ================================================================

function isSquatFullBodyVisible(landmarks: any[]): boolean {
  if (!landmarks) return false;
  // Require Nose (0), Shoulders (11,12), Hips (23,24), Knees (25,26), Ankles (27,28)
  const req = [0, 11, 12, 23, 24, 25, 26, 27, 28];
  return req.every(
    idx => landmarks[idx] && (landmarks[idx].visibility === undefined || landmarks[idx].visibility > 0.45)
  );
}

function isCurlBodyVisible(landmarks: any[]): boolean {
  if (!landmarks) return false;
  // Require Shoulders (11,12), Elbows (13,14), Wrists (15,16), Hips (23,24)
  const req = [11, 12, 13, 14, 15, 16, 23, 24];
  return req.every(
    idx => landmarks[idx] && (landmarks[idx].visibility === undefined || landmarks[idx].visibility > 0.45)
  );
}

function isInFrame(landmarks: any[]): boolean {
  const visible = [0, 23, 24].filter(idx => landmarks[idx] && landmarks[idx].visibility > 0.4);
  return visible.length >= 2;
}

function isBothArmsFullyVisible(landmarks: any[]): boolean {
  return [11, 12, 13, 14, 15, 16].every(idx => landmarks[idx] && landmarks[idx].visibility > 0.5);
}


// ================================================================
// COMPONENT
// ================================================================

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

  // Curl-specific: bilateral rep display
  const [repsLeft, setRepsLeft] = useState(0);
  const [repsRight, setRepsRight] = useState(0);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isPoseReady, setIsPoseReady] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState<'calibrating' | 'tracking' | 'lost'>('calibrating');

  // ---- STATIC HOLD STATE (Tree Pose) ----
  const [treeHoldLeft, setTreeHoldLeft] = useState(0);
  const [treeHoldRight, setTreeHoldRight] = useState(0);
  const [treeActiveLeg, setTreeActiveLeg] = useState<'left' | 'right' | null>(null);
  const [treeIsHolding, setTreeIsHolding] = useState(false);
  const [treeTarget, setTreeTarget] = useState(20);

  // ---- SQUAT STATE MACHINE ----
  const repState = useRef<'ready' | 'descending' | 'bottom' | 'ascending' | 'waiting_for_top'>('ready');

  // ---- TRACKER REFS ----
  const curlTrackerRef = useRef<ReturnType<typeof createCurlTracker> | null>(null);
  const treeTrackerRef = useRef<ReturnType<typeof createTreePoseTracker> | null>(null);
  const butterflyTrackerRef = useRef<ReturnType<typeof createButterflyTracker> | null>(null);

  // Voice cooldown management (used by all engines)
  const lastSpokeAt = useRef<Record<string, number>>({});

  const sessionErrors = useRef<{ error_type: string; timestamp: string; leg?: string }[]>([]);
  const currentRepErrors = useRef<string[]>([]);

  // Squat calibration
  const calibrationFrames = useRef(0);
  const calibrationAngles = useRef<number[]>([]);
  const calibratedStandingAngle = useRef<number | null>(null);
  const hasCalibrated = useRef(false);

  // Squat: track consecutive full-leg-visible frames
  const visibleFramesCount = useRef(0);
  const descendingFrameCount = useRef(0);
  const bottomHoldFrames = useRef(0);
  const ascendingFrames = useRef(0);

  const minAngleInRep = useRef(180);
  const reachedBottom = useRef(false);
  const lastKnownAngle = useRef<number | null>(null);
  const consecutiveLostFrames = useRef(0);
  const LOST_THRESHOLD = 25;
  const lastUiUpdateAt = useRef(0);

  // Algorithm 3: collect EMA-smoothed angle readings per frame during a set.
  // Appended each frame in the processPose callback; sent to backend on session end.
  // Backend calls calculate_form_score(angle_readings, ideal_min, ideal_max).
  const angleReadingsRef = useRef<number[]>([]);

  // Refs so tracking callback always reads fresh values
  const isPausedRef = useRef(false);
  const exerciseRef = useRef<Exercise | null>(null);
  const isMutedRef = useRef(false);
  const secondsRef = useRef(0);
  const trackingStatusRef = useRef(trackingStatus);

  const treeHoldLeftRef = useRef(0);
  const treeHoldRightRef = useRef(0);
  // Cue text -> pre-rendered clip URL, and the clip currently playing.
  const cueAudioIndexRef = useRef<Record<string, string>>({});
  const cueAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { exerciseRef.current = exercise; }, [exercise]);

  // Index the seeded cue clips for this exercise and warm the browser cache so
  // the first cue plays without a network delay.
  useEffect(() => {
    const personalization = exercise?.personalization;
    const index = buildCueAudioIndex(
      personalization?.voice_cues as unknown as Record<string, string> | undefined,
      personalization?.voice_cue_audio,
    );
    cueAudioIndexRef.current = index;
    preloadCueAudio(index);
  }, [exercise]);
  useEffect(() => {
    isMutedRef.current = isMuted;
    if (isMuted) {
      cueAudioRef.current?.pause();
    }
  }, [isMuted]);
  useEffect(() => { secondsRef.current = seconds; }, [seconds]);
  useEffect(() => { trackingStatusRef.current = trackingStatus; }, [trackingStatus]);
  useEffect(() => { treeHoldLeftRef.current = treeHoldLeft; }, [treeHoldLeft]);
  useEffect(() => { treeHoldRightRef.current = treeHoldRight; }, [treeHoldRight]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  // Plays TTS audio clips for voice feedback (pre-rendered or on-demand TTS).
  const utter = (text: string, key?: string) => {
    const previous = cueAudioRef.current;
    if (previous) {
      previous.pause();
      previous.currentTime = 0;
    }

    const url = getTTSAudioUrl(text, key, cueAudioIndexRef.current);
    const audio = new Audio(url);
    cueAudioRef.current = audio;
    audio.play().catch((e) => {
      // If play() was interrupted by pause() (e.g. newer cue), ignore.
      if (e.name === 'AbortError') return;
      if (cueAudioRef.current === audio) {
        cueAudioRef.current = null;
      }
      console.warn("TTS playback error:", e);
    });
  };

  const speak = (text: string, key: string, cooldownMs = 4000) => {
    if (isMutedRef.current) return;
    const now = Date.now();
    if (now - (lastSpokeAt.current[key] || 0) < cooldownMs) return;
    lastSpokeAt.current[key] = now;
    utter(text, key);
  };

  const speakImmediate = (text: string, key?: string) => {
    if (isMutedRef.current) return;
    utter(text, key);
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
    if (isPaused || trackingStatus !== 'tracking') return;
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isPaused, trackingStatus]);

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

    const isCurl = isCurlExercise(exercise);
    const isStatic = isStaticHoldExercise(exercise);

    if (isCurl && !curlTrackerRef.current) {
      curlTrackerRef.current = createCurlTracker(
        exercise.personalization as any,
        speak,
        (errorType: string, timestampSeconds: number) => {
          sessionErrors.current.push({ error_type: errorType, timestamp: String(timestampSeconds) });
        },
        () => Date.now()
      );
    }

    if (isStatic) {
      const p = exercise.personalization;
      setTreeTarget(p.hold_config?.target_hold_seconds || 20);
      const isButterfly = exercise.name.toLowerCase().includes('butterfly') || exercise.name.toLowerCase().includes('baddha');

      if (isButterfly && !butterflyTrackerRef.current) {
        butterflyTrackerRef.current = createButterflyTracker(
          p as any,
          speak,
          (type: string, _leg: string, ts: number) => {
            sessionErrors.current.push({ error_type: type, timestamp: String(ts) });
          },
          () => Date.now()
        );
      } else if (!isButterfly && !treeTrackerRef.current) {
        treeTrackerRef.current = createTreePoseTracker(
          p as any,
          speak,
          (type: string, _leg: string, ts: number) => {
            sessionErrors.current.push({ error_type: type, timestamp: String(ts) });
          },
          () => Date.now()
        );
      }
    }

    const stopPose = processPose(videoRef.current, canvasRef.current, (results) => {
      const landmarks = results.landmarks;
      const ex = exerciseRef.current;
      if (!ex || !landmarks) return;
      if (isPausedRef.current) return;

      if (isStatic) {
        const isButterfly = ex.name.toLowerCase().includes('butterfly') || ex.name.toLowerCase().includes('baddha');
        let result: any;

        if (isButterfly && butterflyTrackerRef.current) {
          result = butterflyTrackerRef.current.processFrame(landmarks, Date.now());
        } else if (!isButterfly && treeTrackerRef.current) {
          result = treeTrackerRef.current.processFrame(landmarks, Date.now());
        } else {
          return;
        }

        // Update tracking status for the header HUD
        if (result.phase === 'invisible') {
          if (trackingStatusRef.current !== 'lost') {
            setTrackingStatus('lost');
            trackingStatusRef.current = 'lost';
          }
          consecutiveLostFrames.current++;
        } else {
          if (trackingStatusRef.current !== 'tracking') {
            setTrackingStatus('tracking');
            trackingStatusRef.current = 'tracking';
          }
          consecutiveLostFrames.current = 0;
        }

        if (result.isComplete && !isPausedRef.current) {
          handleFinish();
          return;
        }

        const now = Date.now();
        if (now - lastUiUpdateAt.current > 100) {
          setTreeHoldLeft(result.leftLeg.holdSeconds);
          setTreeHoldRight(result.rightLeg.holdSeconds);
          setTreeActiveLeg(result.activeLeg);
          setTreeIsHolding(
            result.activeLeg === 'left'
              ? result.leftLeg.isHolding
              : result.activeLeg === 'right'
                ? result.rightLeg.isHolding
                : false,
          );
          lastUiUpdateAt.current = now;
        }
        return;
      }

      if (isCurl && curlTrackerRef.current) {
        const bodyVis = isCurlBodyVisible(landmarks);
        if (!bodyVis) {
          consecutiveLostFrames.current += 1;
          if (consecutiveLostFrames.current >= LOST_THRESHOLD) {
            setTrackingStatus('lost');
            speak("Both arms and torso must be visible. Step back.", "curl_lost", 7000);
          }
          return;
        }
        if (consecutiveLostFrames.current >= LOST_THRESHOLD) {
          setTrackingStatus(hasCalibrated.current ? 'tracking' : 'calibrating');
        }
        consecutiveLostFrames.current = 0;

        const tracker = curlTrackerRef.current;
        const { leftReps, rightReps, totalReps } = tracker.processFrame(results);

        if (!tracker.bothCalibrated()) {
          if (Date.now() - lastUiUpdateAt.current > 100) {
            setTrackingStatus('calibrating');
            lastUiUpdateAt.current = Date.now();
          }
          return;
        }

        if (!hasCalibrated.current) {
          hasCalibrated.current = true;
          setTrackingStatus('tracking');
          speakImmediate("Perfect, let's start! Begin your first curl.");
        }

        const now = Date.now();
        if (now - lastUiUpdateAt.current > 100) {
          setRepsLeft(leftReps);
          setRepsRight(rightReps);
          setReps(totalReps);
          lastUiUpdateAt.current = now;
        }
        return;
      }

      // SQUAT ENGINE
      const angle = results.knee_angle;
      const spineAngle = results.spine_angle;
      const thresholds = ex.personalization.angle_ranges;
      const cues = ex.personalization.voice_cues;
      const fullBodyVisible = isSquatFullBodyVisible(landmarks);

      if (!fullBodyVisible) {
        consecutiveLostFrames.current += 1;
        if (consecutiveLostFrames.current >= LOST_THRESHOLD) {
          if (trackingStatusRef.current !== 'lost') {
            setTrackingStatus('lost');
            speak("Step back so your full body is in frame.", "squat_lost", 7000);
          }
          if (repState.current !== 'ready') repState.current = 'ready';
        }
        return;
      }
      consecutiveLostFrames.current = 0;
      if (trackingStatusRef.current === 'lost') {
        setTrackingStatus(hasCalibrated.current ? 'tracking' : 'calibrating');
      }

      if (!hasCalibrated.current) {
        const isUprightStanding =
          angle !== null &&
          angle > 150 &&
          spineAngle !== null &&
          spineAngle < 20 &&
          landmarks[23]?.y < landmarks[25]?.y &&
          landmarks[25]?.y < landmarks[27]?.y;

        if (isUprightStanding) {
          calibrationFrames.current += 1;
          calibrationAngles.current.push(angle);
        } else {
          calibrationFrames.current = Math.max(0, calibrationFrames.current - 2);
        }
        if (calibrationFrames.current >= 30) {
          const avg = calibrationAngles.current.slice(-30).reduce((a, b) => a + b, 0) / 30;
          calibratedStandingAngle.current = avg;
          hasCalibrated.current = true;
          setTrackingStatus('tracking');
          speakImmediate("Perfect, let's start! Go down for your first rep.");
        }
        return;
      }

      if (angle === null) return;
      const standingAngle = calibratedStandingAngle.current!;
      const descendTrigger = standingAngle - 18;
      const completeTrigger = standingAngle - 15;
      const resetTrigger = standingAngle - 6;
      const bottomMax = (thresholds as any).bottom_max ?? 105;

      if (repState.current === 'ready') {
        if (angle < descendTrigger) {
          repState.current = 'descending';
          minAngleInRep.current = angle;
          reachedBottom.current = false;
        }
      } else if (repState.current === 'descending') {
        if (angle < minAngleInRep.current) minAngleInRep.current = angle;
        if (angle < bottomMax) {
          repState.current = 'bottom';
          reachedBottom.current = true;
          speakImmediate("Good depth!");
        } else if (angle > minAngleInRep.current + 30) {
          repState.current = 'ascending';
        }
      } else if (repState.current === 'bottom') {
        if (angle < minAngleInRep.current) minAngleInRep.current = angle;
        if (angle > minAngleInRep.current + 30) repState.current = 'ascending';
      } else if (repState.current === 'ascending') {
        if (angle > completeTrigger) {
          if (reachedBottom.current) {
            if (spineAngle !== null && spineAngle > 30) {
              speakImmediate((cues as any).forward_lean ?? "No rep! Keep your chest up.");
              repState.current = 'waiting_for_top';
            } else {
              setReps(r => r + 1);
              repState.current = 'waiting_for_top';
              speakImmediate("Nice work!");
            }
          } else {
            speakImmediate((cues as any).insufficient_depth ?? "Not deep enough.");
            repState.current = 'waiting_for_top';
          }
        }
      } else if (repState.current === 'waiting_for_top') {
        if (angle > resetTrigger) repState.current = 'ready';
      }

      // Check forward lean ONLY during active squat movement (descending/bottom/ascending)
      if (spineAngle !== null && spineAngle > 30 && repState.current !== 'ready' && repState.current !== 'waiting_for_top') {
        speak((cues as any).forward_lean || 'Keep your chest up.', 'spine', 8000);
      }

      // Algorithm 3: append the primary joint angle for this exercise to the
      // angle_readings buffer. For squats this is the knee angle (rep depth);
      // for curls the elbow angle is already collected via the curl tracker.
      // The buffer is sent to the backend at session end for form score calculation.
      const primaryAngle = angle ?? spineAngle;
      if (primaryAngle !== null) {
        angleReadingsRef.current.push(primaryAngle);
      }
    });

    return () => { if (stopPose) stopPose(); };
  }, [isPoseReady]);

  useEffect(() => {
    return () => {
      cueAudioRef.current?.pause();
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

    const isCurl = isCurlExercise(exercise);
    const isStatic = isStaticHoldExercise(exercise);

    try {
      if (isStatic) {
        await exerciseService.submitHoldSessionSummary({
          exercise_id: exercise.id,
          left_leg_hold_duration_seconds: treeHoldLeftRef.current,
          right_leg_hold_duration_seconds: treeHoldRightRef.current,
          target_hold_duration_seconds: treeTarget,
          form_errors_triggered: sessionErrors.current as any,
        });
        navigate("/workout/summary", {
          state: {
            exerciseName: exercise.name,
            isStaticHold: true,
            treeHoldLeft: Math.floor(treeHoldLeftRef.current),
            treeHoldRight: Math.floor(treeHoldRightRef.current),
            duration: formatTime(secondsRef.current),
          }
        });
        return;
      }

      const tracker = curlTrackerRef.current;
      let formErrors = sessionErrors.current;
      if (isCurl && tracker) {
        const errorCounts = tracker.getErrors();
        formErrors = Object.entries(errorCounts).flatMap(([type, count]) =>
          Array.from({ length: count as number }, (_, i) => ({
            error_type: type,
            timestamp: String(i),
          }))
        );
      }

      await exerciseService.submitSessionSummary({
        exercise_id: exercise.id,
        reps_completed: reps,
        duration_seconds: seconds,
        form_errors: formErrors as any,
        // Algorithm 3: send collected angle readings for form score calculation.
        // Backend will call calculate_form_score() and store result in session metadata.
        angle_readings: angleReadingsRef.current,
        ...(isCurl && tracker ? {
          reps_left: tracker.getCounts().left,
          reps_right: tracker.getCounts().right,
          goal_context: (exercise.personalization as any).goal || '',
        } : {}),
      });
      navigate("/workout/summary", {
        state: {
          exerciseName: exercise.name,
          reps,
          duration: formatTime(seconds),
          ...(isCurl ? { repsLeft, repsRight } : {}),
        }
      });
    } catch (e) {
      navigate("/dashboard");
    }
  };

  if (isLoading) return <LoadingSpinner fullScreen />;
  const isCurl = exercise ? isCurlExercise(exercise) : false;
  const isStatic = exercise ? isStaticHoldExercise(exercise) : false;

  return (
    <PageTransition variant="fade" className="fixed inset-0 z-[100] flex flex-col bg-black text-white overflow-hidden">
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
              <span className={`text-[8px] uppercase font-black tracking-[0.2em] ${trackingStatus === 'tracking' ? 'text-green-400' :
                trackingStatus === 'lost' ? 'text-red-400' : 'text-white/40'
                }`}>
                {trackingStatus === 'tracking' ? 'TRACKING' : trackingStatus === 'lost' ? 'LOST VIEW' : 'CALIBRATING'}
              </span>
              <span className="font-black text-xs uppercase italic tracking-wider">{exercise?.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-2 bg-black/60 rounded-xl border border-white/10 backdrop-blur-3xl">
            {isCurl ? (
              <>
                <div className="flex flex-col items-center">
                  <span className="text-[7px] uppercase font-black text-[var(--primary-light)]">L ARM</span>
                  <span className="text-lg font-black">{repsLeft}</span>
                </div>
                <div className="w-[1px] h-4 bg-white/10" />
                <div className="flex flex-col items-center">
                  <span className="text-[7px] uppercase font-black text-[var(--primary-light)]">REPS</span>
                  <span className="text-xl font-black">{reps}</span>
                </div>
                <div className="w-[1px] h-4 bg-white/10" />
                <div className="flex flex-col items-center">
                  <span className="text-[7px] uppercase font-black text-[var(--primary-light)]">R ARM</span>
                  <span className="text-lg font-black">{repsRight}</span>
                </div>
              </>
            ) : isStatic ? (
              <>
                {(exercise?.name.toLowerCase().includes('butterfly') || exercise?.name.toLowerCase().includes('baddha')) ? (
                  <div className="flex flex-col items-center">
                    <span className={`text-[7px] uppercase font-black ${treeIsHolding ? 'text-green-400' : 'text-blue-400'}`}>HOLD</span>
                    <span className="text-lg font-black">{Math.floor(treeHoldLeft)}s</span>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col items-center">
                      <span className={`text-[7px] uppercase font-black ${treeIsHolding && treeActiveLeg === 'left' ? 'text-green-400' : 'text-blue-400'}`}>L LEG</span>
                      <span className="text-lg font-black">{Math.floor(treeHoldLeft)}s</span>
                    </div>
                    <div className="w-[1px] h-4 bg-white/10" />
                    <div className="flex flex-col items-center">
                      <span className={`text-[7px] uppercase font-black ${treeIsHolding && treeActiveLeg === 'right' ? 'text-green-400' : 'text-blue-400'}`}>R LEG</span>
                      <span className="text-lg font-black">{Math.floor(treeHoldRight)}s</span>
                    </div>
                  </>
                )}
                <div className="w-[1px] h-4 bg-white/10" />
                <div className="flex flex-col items-center">
                  <span className="text-[7px] uppercase font-black text-primary">TARGET</span>
                  <span className="text-xl font-black">{treeTarget}s</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-[8px] uppercase font-black text-primary">Reps</span>
                <span className="text-xl font-black">{reps}</span>
              </div>
            )}
            <div className="w-[1px] h-4 bg-white/10" />
            <div className="flex flex-col items-center">
              <span className="text-[8px] uppercase font-black text-white/40">Time</span>
              <span className="text-xl font-mono">{formatTime(seconds)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none" playsInline />
        {!isCameraActive ? (
          <div className="text-center p-8 space-y-12">
            <div className="h-28 w-28 bg-[var(--primary-solid)]/20 rounded-full flex items-center justify-center mx-auto text-primary relative">
              <div className="absolute inset-0 rounded-full animate-ping bg-[var(--primary-solid)]/100 opacity-30" />
              {isCurl ? <Dumbbell size={40} className="relative z-10" stroke="var(--primary-light)" /> : <CameraIcon size={40} stroke="var(--primary-light)" className="relative z-10" />}
            </div>
            <div className="space-y-4">
              <h3 className="text-3xl font-black tracking-tighter uppercase italic text-white">{exercise?.name}</h3>
              <p className="text-[var(--text-muted)] text-sm font-medium">Stand back so I can see your full body</p>
            </div>
            <Button onClick={() => setIsCameraActive(true)} size="lg" className="rounded-full px-16 h-20 text-xl font-black bg-[var(--primary-solid)]">
              Start Live Session
            </Button>
          </div>
        ) : (
          <div className="w-full h-full relative">
            <canvas ref={canvasRef} className="w-full h-full object-cover" width={640} height={480} />
            {trackingStatus !== 'tracking' && (
              <div className="absolute inset-x-0 bottom-32 flex justify-center px-6">
                <div className="px-10 py-4 bg-black/80 rounded-full border border-primary/20 flex items-center gap-4">
                  <div className="h-2 w-2 rounded-full animate-pulse bg-primary" />
                  <p className="text-[10px] font-black text-white uppercase tracking-widest">{trackingStatus.toUpperCase()}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isCameraActive && (
        <div className="absolute bottom-12 left-0 right-0 z-[110] flex items-center justify-center gap-10">
          <Button variant="outline" size="icon" className="h-14 w-14 rounded-full bg-black/40 text-white/50" onClick={() => navigate("/dashboard")}>
            <SkipForward size={20} />
          </Button>
          <Button size="icon" className="h-20 w-20 rounded-full bg-primary" onClick={() => setIsPaused(!isPaused)}>
            {isPaused ? <Play size={32} /> : <Pause size={32} />}
          </Button>
          <Button variant="outline" size="icon" className="h-14 w-14 rounded-full bg-black/40 text-white/50" onClick={handleFinish}>
            <Square size={20} className="text-destructive" />
          </Button>
        </div>
      )}
    </PageTransition>
  );
}
