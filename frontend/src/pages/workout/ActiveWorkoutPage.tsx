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

// ================================================================
// VISIBILITY HELPERS
// ================================================================

/** Squat: requires BOTH hips AND BOTH knees clearly visible (all 4 landmarks). */
function isUpperLegVisible(landmarks: any[]): boolean {
  return [23, 24, 25, 26].every(idx => landmarks[idx] && landmarks[idx].visibility > 0.5);
}

/** Both exercises: person is at least partially in frame. */
function isInFrame(landmarks: any[]): boolean {
  // Require at least 2 of: nose, left hip, right hip to avoid single-point false positives
  const visible = [0, 23, 24].filter(idx => landmarks[idx] && landmarks[idx].visibility > 0.4);
  return visible.length >= 2;
}

/**
 * Curl: requires BOTH shoulders + BOTH elbows + BOTH wrists visible.
 * This is the strict bilateral check — if any of the 6 landmarks is missing
 * we cannot reliably track both arms.
 */
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

  // Tree Pose: hold display
  const [treeHoldLeft, setTreeHoldLeft] = useState(0);
  const [treeHoldRight, setTreeHoldRight] = useState(0);
  const [treeActiveLeg, setTreeActiveLeg] = useState<'left' | 'right' | null>(null);
  const [treeIsHolding, setTreeIsHolding] = useState(false);
  const [treeTarget, setTreeTarget] = useState(0);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isPoseReady, setIsPoseReady] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState<'calibrating' | 'tracking' | 'lost'>('calibrating');

  // ---- SQUAT STATE MACHINE ----
  const repState = useRef<'ready' | 'descending' | 'bottom' | 'ascending' | 'waiting_for_top'>('ready');

  // ---- CURL TRACKER (only instantiated for curl exercises) ----
  const curlTrackerRef = useRef<ReturnType<typeof createCurlTracker> | null>(null);

  // ---- TREE POSE TRACKER ----
  const treeTrackerRef = useRef<ReturnType<typeof createTreePoseTracker> | null>(null);

  // Voice cooldown management (used by all engines)
  const lastSpokeAt = useRef<Record<string, number>>({});

  const sessionErrors = useRef<{ error_type: string; timestamp: string; leg?: string }[]>([]);
  const currentRepErrors = useRef<string[]>([]);

  // Squat calibration
  const calibrationFrames = useRef(0);
  const calibrationAngles = useRef<number[]>([]);
  const calibratedStandingAngle = useRef<number | null>(null);
  const hasCalibrated = useRef(false);

  // Squat: track consecutive full-leg-visible frames so 'let's start' isn't
  // spoken prematurely. We need 25+ consecutive frames of good visibility.
  const visibleFramesCount = useRef(0);

  // Squat: how many frames we've been descending (prevents 'go lower' firing immediately)
  const descendingFrameCount = useRef(0);
  // Squat: how many frames held in bottom (noise filter before ascending)
  const bottomHoldFrames = useRef(0);
  // Squat: how many frames in ascending (ensures rep completion is stable)
  const ascendingFrames = useRef(0);

  const minAngleInRep = useRef(180);
  const reachedBottom = useRef(false);
  const lastKnownAngle = useRef<number | null>(null);
  const consecutiveLostFrames = useRef(0);
  const LOST_THRESHOLD = 25;

  // Refs so tracking callback always reads fresh values without re-subscribing
  const isPausedRef = useRef(false);
  const exerciseRef = useRef<Exercise | null>(null);
  const isMutedRef = useRef(false);
  const secondsRef = useRef(0);
  const trackingStatusRef = useRef(trackingStatus);

  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { exerciseRef.current = exercise; }, [exercise]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { secondsRef.current = seconds; }, [seconds]);
  useEffect(() => { trackingStatusRef.current = trackingStatus; }, [trackingStatus]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  // ================================================================
  // VOICE ENGINE — shared by both squat and curl
  // ================================================================
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

  // ================================================================
  // DATA FETCH
  // ================================================================
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

  // ================================================================
  // TIMER
  // ================================================================
  useEffect(() => {
    if (isPaused || trackingStatus !== 'tracking') return;
    const interval = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isPaused, trackingStatus]);

  // ================================================================
  // CAMERA INIT
  // ================================================================
  useEffect(() => {
    const init = async () => {
      if (isCameraActive && videoRef.current && canvasRef.current && exercise && !isPoseReady) {
        const success = await initializeCamera(videoRef.current);
        if (success) setIsPoseReady(true);
      }
    };
    init();
  }, [isCameraActive, exercise, isPoseReady]);

  // ================================================================
  // MAIN TRACKING LOOP — dispatches to squat, curl, or tree pose engine
  // ================================================================
  useEffect(() => {
    if (!isPoseReady || !exercise || !canvasRef.current || !videoRef.current) return;

    const isCurl = isCurlExercise(exercise);
    const isTree = isStaticHoldExercise(exercise);

    // ---- Initialise curl tracker if needed ----
    if (isCurl && !curlTrackerRef.current) {
      const p = exercise.personalization;
      curlTrackerRef.current = createCurlTracker(
        {
          angle_ranges: p.angle_ranges as any,
          voice_cues: p.voice_cues as any,
          voice_cue_priority: p.voice_cue_priority || [],
          cue_cooldown_seconds: p.cue_cooldown_seconds || 8,
        },
        speak,
        (errorType: string, ts: number) => {
          sessionErrors.current.push({ error_type: errorType, timestamp: String(ts) });
        },
        () => secondsRef.current
      );
    }
    
    // ---- Initialise tree pose tracker if needed ----
    if (isTree && !treeTrackerRef.current) {
       const p = exercise.personalization as any;
       treeTrackerRef.current = createTreePoseTracker(
          {
            alignment_thresholds: p.alignment_thresholds,
            hold_config: p.hold_config,
            voice_cues: p.voice_cues,
            voice_cue_priority: p.voice_cue_priority || [],
            cue_cooldown_seconds: p.cue_cooldown_seconds || 8,
            postural_flags: p.postural_flags || {},
          },
          speak,
          (errorType: string, leg: string, ts: number) => {
             sessionErrors.current.push({ error_type: errorType, timestamp: String(ts), leg });
          },
          () => secondsRef.current
       );
       setTreeTarget(p.hold_config.target_hold_seconds || 0);
    }

    const stopPose = processPose(videoRef.current, canvasRef.current, (results) => {
      const landmarks = results.landmarks;
      const ex = exerciseRef.current;
      if (!ex || !landmarks) return;
      if (isPausedRef.current) return;
      
      // ---- TREE POSE ENGINE ----
      if (isStaticHoldExercise(ex) && treeTrackerRef.current) {
          const legsVis = isUpperLegVisible(landmarks);
          
          if (!legsVis) {
             consecutiveLostFrames.current += 1;
             if (consecutiveLostFrames.current >= LOST_THRESHOLD) {
                setTrackingStatus('lost');
                speak(
                  "Full body must be visible for Tree Pose. Step back.",
                  "tree_lost",
                  7000
                );
             }
             return;
          }
          
          if (consecutiveLostFrames.current >= LOST_THRESHOLD) {
             const newStatus = hasCalibrated.current ? 'tracking' : 'calibrating';
             setTrackingStatus(newStatus);
             trackingStatusRef.current = newStatus;
          }
          consecutiveLostFrames.current = 0;
          
          if (!hasCalibrated.current) {
             // For tree pose, we don't have deep calibration right now, just visibility
             setTrackingStatus('tracking');
             hasCalibrated.current = true;
             const pers = ex.personalization as any;
             speakImmediate(`Welcome to ${pers['hold_config']?.variant_name || 'Tree Pose'}. ${pers['hold_config']?.safety_note || "Let's begin."}`);
          }
          
          const tracker = treeTrackerRef.current;
          const result = tracker.processFrame(landmarks, performance.now());
          
          setTreeHoldLeft(result.leftLeg.holdSeconds);
          setTreeHoldRight(result.rightLeg.holdSeconds);
          setTreeActiveLeg(result.activeLeg);
          
          // isHolding is true if ANY active leg is holding accurately
          const isHolding = (result.activeLeg === 'left' && result.leftLeg.isHolding) || 
                            (result.activeLeg === 'right' && result.rightLeg.isHolding);
          setTreeIsHolding(isHolding);
          
          if (result.isComplete) {
              // Both legs complete
              // handleFinish will be called manually or we can auto-end.
              // We'll let the user end manually for now like other exercises.
          }
          
          return;
      }

      // ---- CURL ENGINE ----
      if (isCurlExercise(ex) && curlTrackerRef.current) {
        const bothArmsVis = isBothArmsFullyVisible(landmarks);

        if (!bothArmsVis) {
          consecutiveLostFrames.current += 1;
          if (consecutiveLostFrames.current >= LOST_THRESHOLD) {
            setTrackingStatus('lost');
            speak(
              "Both arms must be fully visible. Step back and make sure both elbows are in frame.",
              "curl_lost",
              7000
            );
          }
          return;
        }

        // Arms are visible — reset lost counter and restore status
        if (consecutiveLostFrames.current >= LOST_THRESHOLD) {
          const newStatus = hasCalibrated.current ? 'tracking' : 'calibrating';
          setTrackingStatus(newStatus);
          trackingStatusRef.current = newStatus;
        }
        consecutiveLostFrames.current = 0;

        const tracker = curlTrackerRef.current;

        // Feed EVERY frame to the tracker so calibration accumulates
        const { leftReps, rightReps, totalReps } = tracker.processFrame(results);

        // Wait for BOTH arms to calibrate before starting
        if (!tracker.bothCalibrated()) {
          setTrackingStatus('calibrating');
          return;
        }

        // First frame where both arms are calibrated — announce start
        if (!hasCalibrated.current) {
          hasCalibrated.current = true;
          setTrackingStatus('tracking');
          speakImmediate("Perfect, let's start! Begin your first curl.");
        }

        setRepsLeft(leftReps);
        setRepsRight(rightReps);
        setReps(totalReps);
        return;
      }

      // ---- SQUAT ENGINE ----
      const angle: number | null = results.knee_angle;
      const spineAngle: number | null = results.spine_angle;

      const thresholds = ex.personalization.angle_ranges;
      const cues = ex.personalization.voice_cues;

      const legsVisible = isUpperLegVisible(landmarks);

      // ---- VISIBILITY GATE ----
      // Both legs must be continuously visible. Any frame without full leg
      // visibility increments the lost counter. We only pause/reset the engine if
      // they remain lost for a sustained period (LOST_THRESHOLD).
      if (!legsVisible) {
        consecutiveLostFrames.current += 1;
        visibleFramesCount.current = 0;
        
        if (consecutiveLostFrames.current >= LOST_THRESHOLD) {
          if (trackingStatusRef.current !== 'lost') {
            setTrackingStatus('lost');
            trackingStatusRef.current = 'lost';
            speak(
              hasCalibrated.current
                ? "Required body not visible. Step back so your full legs are in frame."
                : "Step back so I can see your full body, including both knees.",
              "squat_lost",
              7000
            );
          }
          // Only hard reset the state if they've been gone for a full second
          // This prevents tiny half-frame flickers from destroying rep counts
          if (repState.current !== 'ready' && repState.current !== 'waiting_for_top') {
            repState.current = 'ready';
            reachedBottom.current = false;
          }
        }
        return;
      }

      // Legs are visible — update counters
      consecutiveLostFrames.current = 0;
      visibleFramesCount.current += 1;

      // Restore status after gaining visibility
      if (trackingStatusRef.current === 'lost') {
        const newStatus = hasCalibrated.current ? 'tracking' : 'calibrating';
        setTrackingStatus(newStatus);
        trackingStatusRef.current = newStatus;
      }

      // ---- CALIBRATION ----
      // Collect 25 CONSECUTIVE frames of fully extended standing (angle > 155°).
      // Reset calibration frames if angle drops (person bent knees during calibration).
      if (!hasCalibrated.current) {
        if (angle !== null && angle > 155) {
          calibrationFrames.current += 1;
          calibrationAngles.current.push(angle);
        } else {
          // Bent knees during calibration — reset to avoid wrong baseline
          calibrationFrames.current = Math.max(0, calibrationFrames.current - 3);
        }
        if (calibrationFrames.current >= 25) {
          const avg = calibrationAngles.current.slice(-25).reduce((a, b) => a + b, 0) / 25;
          calibratedStandingAngle.current = avg;
          hasCalibrated.current = true;
          setTrackingStatus('tracking');
          speakImmediate("Perfect, let's start! Go down for your first rep.");
        } else {
          setTrackingStatus('calibrating');
        }
        return;
      }

      // Post-calibration: require real MediaPipe angle
      if (angle === null) return;
      lastKnownAngle.current = angle;
      const effectiveAngle = angle;

      // ======================================================
      // SQUAT STATE MACHINE
      // ======================================================
      //
      // States:
      //   ready        → waiting for squat to begin (standing still)
      //   descending   → knee angle decreasing, approaching bottom
      //   bottom       → reached valid depth zone, waiting to ascend
      //   ascending    → knee angle increasing back to standing
      //   waiting_top  → rep counted, waiting for full stand before next rep
      //
      // All transitions require MULTIPLE CONSECUTIVE frames in the new zone
      // to prevent angle noise / jitter from causing phantom transitions.
      // ======================================================

      // Standing angle calibrated. Use it + offsets for all thresholds.
      const standingAngle = calibratedStandingAngle.current!;

      // ENTRY: enter 'descending' when angle drops ≥ 12° below standing
      // Highly sensitive so shallow reps are detected and coached, not ignored.
      const descendTrigger = standingAngle - 12;

      // EXIT ascending: only count rep when returns to within 12° of standing
      // (ensures they actually stood back up, not just partially)
      const completeTrigger = standingAngle - 12;

      // RESET: reset to ready once back within 6° of standing
      const resetTrigger = standingAngle - 6;

      // Depth zone: Use config from backend, but bound by (standing - 55°) to be robust
      // against different camera angles/calibration heights. 55° drop is a solid squat limit.
      const bottomMax = Math.max((thresholds as any).bottom_max ?? 90, standingAngle - 60);
      const tooDeepThreshold = (thresholds as any).too_deep_threshold ?? 50;

      // ---- STATE: ready ----
      if (repState.current === 'ready') {
        if (effectiveAngle < descendTrigger) {
          repState.current = 'descending';
          minAngleInRep.current = effectiveAngle;
          reachedBottom.current = false;
          descendingFrameCount.current = 1;
          bottomHoldFrames.current = 0;
          ascendingFrames.current = 0;
          currentRepErrors.current = [];
          // Clear per-rep cooldowns
          delete lastSpokeAt.current['go_lower'];
          delete lastSpokeAt.current['a_little_more'];
          delete lastSpokeAt.current['insufficient'];
        }
        // Standing still: no feedback
      }

      // ---- STATE: descending ----
      else if (repState.current === 'descending') {
        descendingFrameCount.current += 1;
        if (effectiveAngle < minAngleInRep.current) minAngleInRep.current = effectiveAngle;

        if (effectiveAngle < bottomMax) {
          // Reached valid bottom zone — transition to bottom
          repState.current = 'bottom';
          reachedBottom.current = true;
          bottomHoldFrames.current = 1;
          speakImmediate("Good depth!");
        }

        // Abort / early reversal detection: angle rose significantly after a descent attempt
        // We track a 15° rise from the lowest point they reached to confirm they are coming back up
        if (effectiveAngle > minAngleInRep.current + 15) {
          // They reversed up BEFORE hitting bottomMax
          if (minAngleInRep.current > standingAngle - 18) {
            // Literally shivering/twitching — silently reset
            repState.current = 'ready';
          } else {
            // A real attempt but didn't reach bottom — coach them based on how short they were
            const gap = effectiveAngle - bottomMax;
            if (gap > 40) {
              speak("Try to go lower next time.", "go_lower", 5000);
            } else {
              speak("Just a little deeper on the next one.", "a_little_more", 5000);
            }
            
            if (!currentRepErrors.current.includes('insufficient_depth')) {
              currentRepErrors.current.push('insufficient_depth');
              sessionErrors.current.push({
                error_type: 'insufficient_depth',
                timestamp: seconds.toString(),
              });
            }
            repState.current = 'ascending';
            ascendingFrames.current = 0;
          }
        }
      }

      // ---- STATE: bottom ----
      else if (repState.current === 'bottom') {
        bottomHoldFrames.current += 1;
        if (effectiveAngle < minAngleInRep.current) minAngleInRep.current = effectiveAngle;

        // Too deep warning (only fire once per rep, after holding 3 frames)
        if (bottomHoldFrames.current >= 3 && effectiveAngle < tooDeepThreshold) {
          speak(
            (cues as any).excessive_depth || "That's deep enough, start coming up.",
            "too_deep",
            4000
          );
        }

        // Exit bottom: must have held for ≥3 frames AND angle rose ≥20° from min
        // This prevents jitter (random 5° spike) from ending the bottom state
        if (bottomHoldFrames.current >= 3 && effectiveAngle > minAngleInRep.current + 20) {
          repState.current = 'ascending';
          ascendingFrames.current = 0;
        }
      }

      // ---- STATE: ascending ----
      else if (repState.current === 'ascending') {
        ascendingFrames.current += 1;

        if (effectiveAngle > completeTrigger) {
          // Must hold completeTrigger for ≥3 consecutive frames (not a jitter spike)
          if (ascendingFrames.current >= 3) {
            if (reachedBottom.current) {
              setReps(r => r + 1);
              repState.current = 'waiting_for_top';
              const praises = ['Perfect!', 'Great rep!', 'Keep going!', 'Excellent!', 'Nice work!'];
              speakImmediate(praises[Math.floor(Math.random() * praises.length)]!);
            } else {
              // Didn't reach valid bottom — alert user why rep wasn't counted
              repState.current = 'ready';
              speakImmediate("Rep not counted. Make sure to go deeper.");
            }
          }
        } else if (effectiveAngle < minAngleInRep.current - 10) {
          // Angle dropped again during ascent — they went back down
          // Update minAngle and return to bottom state
          repState.current = 'bottom';
          if (effectiveAngle < minAngleInRep.current) minAngleInRep.current = effectiveAngle;
          bottomHoldFrames.current = 0;
        }
      }

      // ---- STATE: waiting_for_top ----
      // Rep already counted. Wait for person to fully stand before allowing next rep.
      else if (repState.current === 'waiting_for_top') {
        if (effectiveAngle > resetTrigger) {
          repState.current = 'ready';
        }
      }

      // ---- SPINE / CHEST CUE ----
      // Only fire during active movement (descending or ascending), not while standing.
      // Dropped threshold to < 55° (very extreme lean) as normal back squats naturally involve forward torso lean.
      // 8-second cooldown prevents it repeating every 5 seconds.
      if (
        (repState.current === 'descending' || repState.current === 'bottom' || repState.current === 'ascending') &&
        spineAngle !== null &&
        spineAngle < 55
      ) {
        speak((cues as any).forward_lean || 'Keep your chest up.', 'spine', 8000);
      }
    });

    return () => {
      if (stopPose) stopPose();
    };
  }, [isPoseReady]); // Run once when pose is ready

  // ================================================================
  // CLEANUP
  // ================================================================
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

  // ================================================================
  // FINISH — builds payload for squat, curl, or tree pose
  // ================================================================
  const handleFinish = async () => {
    if (!exercise) return;
    speakImmediate("Workout complete. Well done!");
    if (videoRef.current) stopCamera(videoRef.current);

    const isCurl = isCurlExercise(exercise);
    const isTree = isStaticHoldExercise(exercise);
    const cTracker = curlTrackerRef.current;
    const tTracker = treeTrackerRef.current;

    // Build per-error-type error list for history
    let formErrors = sessionErrors.current;
    if (isCurl && cTracker) {
      const errorCounts = cTracker.getErrors();
      // Convert { body_swing: 3, elbow_swing: 1 } → flat list matching existing history format
      const errorList = Object.entries(errorCounts).flatMap(([type, count]) =>
        Array.from({ length: count }, (_, i) => ({
          error_type: type,
          timestamp: String(i),
        }))
      );
      formErrors = errorList;
    } else if (isTree && tTracker) {
      formErrors = tTracker.getErrors() as any;
    }

    try {
      if (isTree && tTracker) {
          await exerciseService.submitHoldSessionSummary({
             exercise_id: exercise.id,
             left_leg_hold_duration_seconds: treeHoldLeft,
             right_leg_hold_duration_seconds: treeHoldRight,
             target_hold_duration_seconds: treeTarget,
             form_errors_triggered: formErrors,
             goal_context: 'flexibility',
             age_group: exercise.personalization.age_band,
          });
          navigate("/workout/summary", {
            state: {
              exerciseName: exercise.name,
              reps: 0,
              duration: formatTime(seconds),
              isStaticHold: true,
              treeHoldLeft,
              treeHoldRight,
              treeTarget
            }
          });
      } else {
          await exerciseService.submitSessionSummary({
            exercise_id: exercise.id,
            reps_completed: reps,
            duration_seconds: seconds,
            form_errors: formErrors,
            ...(isCurl && cTracker ? {
              reps_left: cTracker.getCounts().left,
              reps_right: cTracker.getCounts().right,
              goal_context: exercise.personalization.goal || '',
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
      }
    } catch (e) {
      navigate("/dashboard");
    }
  };

  if (isLoading) return <LoadingSpinner fullScreen />;

  const isCurl = exercise ? isCurlExercise(exercise) : false;

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

          {/* Rep counter / Timer UI */}
          {isCurl ? (
            <div className="flex items-center gap-3 px-4 py-2 bg-black/60 rounded-xl border border-white/10 backdrop-blur-3xl">
              <div className="flex flex-col items-center">
                <span className="text-[7px] uppercase font-black text-blue-400">L ARM</span>
                <span className="text-lg font-black">{repsLeft}</span>
              </div>
              <div className="w-[1px] h-4 bg-white/10" />
              <div className="flex flex-col items-center">
                <span className="text-[7px] uppercase font-black text-primary">REPS</span>
                <span className="text-xl font-black">{reps}</span>
              </div>
              <div className="w-[1px] h-4 bg-white/10" />
              <div className="flex flex-col items-center">
                <span className="text-[7px] uppercase font-black text-blue-400">R ARM</span>
                <span className="text-lg font-black">{repsRight}</span>
              </div>
              <div className="w-[1px] h-4 bg-white/10" />
              <div className="flex flex-col items-center">
                <span className="text-[8px] uppercase font-black text-white/40">Time</span>
                <span className="text-xl font-mono">{formatTime(seconds)}</span>
              </div>
            </div>
          ) : isStaticHoldExercise(exercise!) ? (
            <div className="flex items-center gap-3 px-4 py-2 bg-black/60 rounded-xl border border-white/10 backdrop-blur-3xl">
              <div className="flex flex-col items-center">
                <span className={`text-[7px] uppercase font-black ${treeActiveLeg === 'left' && treeIsHolding ? 'text-green-400' : 'text-blue-400'}`}>L LEG</span>
                <span className="text-lg font-black">{Math.floor(treeHoldLeft)}s</span>
              </div>
              <div className="w-[1px] h-4 bg-white/10" />
              <div className="flex flex-col items-center">
                <span className="text-[7px] uppercase font-black text-primary">TARGET</span>
                <span className="text-xl font-black">{treeTarget}s</span>
              </div>
              <div className="w-[1px] h-4 bg-white/10" />
              <div className="flex flex-col items-center">
                <span className={`text-[7px] uppercase font-black ${treeActiveLeg === 'right' && treeIsHolding ? 'text-green-400' : 'text-blue-400'}`}>R LEG</span>
                <span className="text-lg font-black">{Math.floor(treeHoldRight)}s</span>
              </div>
              <div className="w-[1px] h-4 bg-white/10" />
              <div className="flex flex-col items-center">
                <span className="text-[8px] uppercase font-black text-white/40">Time</span>
                <span className="text-xl font-mono">{formatTime(seconds)}</span>
              </div>
            </div>
          ) : (
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
          )}
        </div>
      )}

      {/* VIEWPORT */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none" playsInline />

        {!isCameraActive ? (
          <div className="text-center p-8 space-y-12 animate-in fade-in zoom-in duration-500">
            <div className="h-28 w-28 bg-primary/20 rounded-full flex items-center justify-center mx-auto text-primary shadow-2xl relative">
              <div className="absolute inset-0 rounded-full animate-ping bg-primary/10 opacity-30" />
              {isCurl ? <Dumbbell size={40} className="relative z-10" /> : <CameraIcon size={40} className="relative z-10" />}
            </div>
            <div className="space-y-4">
              <h3 className="text-4xl font-black tracking-tighter uppercase italic text-white">
                {isCurl ? 'Curl Coach' : isStaticHoldExercise(exercise!) ? 'Balance Coach' : 'Coach Mode'}
              </h3>
              <p className="text-neutral-500 text-sm font-medium">
                {isCurl
                  ? (exercise?.personalization.angle_ranges.position === 'seated'
                      ? 'Sit with your back straight so I can see both arms'
                      : 'Stand back so I can see your arms and upper body')
                  : isStaticHoldExercise(exercise!)
                  ? 'Stand back so I can see your full body. Perform near a wall if needed.'
                  : 'Stand back so I can see your full body'
                }
              </p>
              {isCurl && exercise?.personalization.rep_config.load_note && (
                <p className="text-neutral-600 text-xs font-medium italic">
                  💡 {exercise.personalization.rep_config.load_note}
                </p>
              )}
              {isStaticHoldExercise(exercise!) && (exercise?.personalization as any)?.hold_config?.safety_note && (
                <p className="text-neutral-600 text-xs font-medium italic">
                  💡 {(exercise?.personalization as any)?.hold_config?.safety_note}
                </p>
              )}
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
                    {trackingStatus === 'lost'
                      ? (isCurl ? 'Step back — needs arms visible' : 'Step back — needs full body')
                      : (isCurl ? 'Calibrating — hold arms at sides' : 'Calibrating... Stand still')
                    }
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
