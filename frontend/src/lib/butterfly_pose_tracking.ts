/**
 * butterfly_pose_tracking.ts
 *
 * Butterfly Pose (Baddha Konasana) tracker driven purely by lower-body geometry.
 * Both legs are tracked independently: each knee has its own oscillation state
 * and its own hold timer, and the pose is complete only when both are done.
 *
 * Detection chain:
 *   1. Feet below hips  — both ankles (27/28) must have greater y than the hips
 *      (23/24), and sit horizontally close to the hip mid-line.
 *   2. Seated compactness — hip / knee / ankle collapse into a small cluster on
 *      both sides when seated cross-legged, whereas standing spreads them apart.
 *   3. Knee settle test — purely geometric, no velocity. Per side we take the
 *      hip/ankle reference line (23-27 on the left, 24-28 on the right) and
 *      measure how far the knee (25 / 26) sits above it, normalised by torso
 *      height. A settled butterfly knee rests close to that line; a flapping
 *      knee lifts well above it. The measurement is EMA-smoothed and gated by
 *      hysteresis, so MediaPipe's per-frame ankle jitter cannot flip the state.
 *
 *      Contrast with standing (the calibration reference): standing knees sit
 *      essentially ON the hip-ankle line, which is why the seated gate in
 *      step 1/2 — not this test — is what rejects a standing user.
 */

import { TreePhase, TreePoseResult, TreePoseConfig } from './tree_pose_tracking';
import { ExponentialMovingAverage } from './ema_smoothing';

const LM = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

const VIS_THRESHOLD = 0.4;

/** Ankle must be at least this far below the hip (fraction of torso height). */
const ANKLE_BELOW_HIP_MIN = 0.05;
/** Ankles must stay within this horizontal distance of the hip centre (x torso height). */
const ANKLE_TUCK_MAX = 0.9;
/** Max vertical spread of hip/knee/ankle (x torso height) that still counts as seated. */
const LEG_CLUSTER_MAX = 0.85;

/** Smoothing factor for the knee-lift signal (see ema_smoothing.ts for the rationale). */
const LIFT_ALPHA = 0.3;
/**
 * Knee lift = how far the knee sits ABOVE the hip-ankle line, in torso heights.
 * Settled knees hover just above it; a flapping knee rides much higher.
 * Two thresholds give hysteresis: once settled, the knee must lift past
 * EXIT before we call it flapping again.
 */
const LIFT_SETTLED_ENTER = 0.4;
const LIFT_SETTLED_EXIT = 0.55;
/** Consecutive settled frames required before a leg's hold timer starts. */
const MIN_HOLD_FRAMES = 5;

const CUES = {
  invisible: "I can't see your legs. Step back so your hips and feet are in frame.",
  standing: 'Sit on the floor and bring the soles of your feet together.',
  flapping: 'Now let both knees settle down and hold them there.',
  holding: 'Good. Keep both knees low and breathe.',
  reset: 'Form lost. Timer has been reset.',
} as const;

type Side = 'left' | 'right';

interface Point {
  x: number;
  y: number;
  visibility?: number;
}

/** Mutable per-leg settle + hold state. */
interface LegState {
  /** EMA-smoothed knee lift above the hip-ankle line, in torso heights. */
  lift: number | null;
  /** Smoother for this leg's lift signal; reset whenever tracking is dropped. */
  liftEma: ExponentialMovingAverage;
  /** Latched settle state, so hysteresis has something to hold onto. */
  settled: boolean;
  steadyFrames: number;
  isHolding: boolean;
  accumulated: number;
  holdTickAt: number | null;
  lastGoodAt: number;
  graceWarned: boolean;
}

function newLegState(): LegState {
  return {
    lift: null,
    liftEma: new ExponentialMovingAverage(LIFT_ALPHA),
    settled: false,
    steadyFrames: 0,
    isHolding: false,
    accumulated: 0,
    holdTickAt: null,
    lastGoodAt: 0,
    graceWarned: false,
  };
}

/** Clears motion tracking but keeps whatever hold time the leg has banked. */
function clearMotion(leg: LegState): void {
  leg.lift = null;
  leg.liftEma.reset();
  leg.settled = false;
  leg.steadyFrames = 0;
  leg.isHolding = false;
  leg.holdTickAt = null;
}

function vis(lm: Point | undefined, thr: number = VIS_THRESHOLD): boolean {
  return lm != null && (lm.visibility === undefined || lm.visibility > thr);
}

/** The landmarks this tracker needs, all confirmed visible. */
interface Body {
  shoulderL: Point;
  shoulderR: Point;
  hipL: Point;
  hipR: Point;
  kneeL: Point;
  kneeR: Point;
  ankleL: Point;
  ankleR: Point;
}

/** Extracts the required landmarks, or null if any is missing / not visible. */
function readBody(lm: Point[]): Body | null {
  const body = {
    shoulderL: lm[LM.LEFT_SHOULDER],
    shoulderR: lm[LM.RIGHT_SHOULDER],
    hipL: lm[LM.LEFT_HIP],
    hipR: lm[LM.RIGHT_HIP],
    kneeL: lm[LM.LEFT_KNEE],
    kneeR: lm[LM.RIGHT_KNEE],
    ankleL: lm[LM.LEFT_ANKLE],
    ankleR: lm[LM.RIGHT_ANKLE],
  };
  return Object.values(body).every((p) => vis(p)) ? (body as Body) : null;
}

/** Vertical spread of one leg's hip/knee/ankle, normalised by torso height. */
function clusterSpread(hip: Point, knee: Point, ankle: Point, torso: number): number {
  return (Math.max(hip.y, knee.y, ankle.y) - Math.min(hip.y, knee.y, ankle.y)) / torso;
}

/**
 * How far one knee sits above that side's hip-ankle line, in torso heights.
 * Image y grows downward, so a raised knee gives a positive number and a knee
 * resting at or below the line gives ~0 or negative. Using the hip-ankle
 * midpoint (rather than the hip alone) makes the reading insensitive to how
 * high the user is sitting and to ankle jitter, since a wobbling ankle only
 * moves the baseline by half its own error.
 */
function kneeLift(hip: Point, knee: Point, ankle: Point, torso: number): number {
  return ((hip.y + ankle.y) / 2 - knee.y) / torso;
}

export function createButterflyPoseTracker(
  config: TreePoseConfig,
  speak: (text: string, key: string, cooldownMs: number) => void,
  fireError: (type: string, leg: string, ts: number) => void,
  getTimestamp: () => number,
) {
  const target = config.hold_config.target_hold_seconds;
  const grace = config.hold_config.grace_period_seconds;
  const cueCooldown = config.cue_cooldown_seconds * 1000;

  const legs: Record<Side, LegState> = { left: newLegState(), right: newLegState() };
  let lastPhase: TreePhase = 'invisible';

  function snapshot(leg: LegState, holding: boolean) {
    return {
      isHolding: holding,
      holdSeconds: leg.accumulated,
      isComplete: leg.accumulated >= target,
    };
  }

  function idleResult(phase: TreePhase): TreePoseResult {
    return {
      phase,
      activeLeg: null,
      leftLeg: snapshot(legs.left, false),
      rightLeg: snapshot(legs.right, false),
      isComplete: legs.left.accumulated >= target && legs.right.accumulated >= target,
      currentErrors: [],
    };
  }

  /**
   * Smooths one leg's knee-lift reading, applies the settle hysteresis and
   * updates its hold timer. Returns whether that knee counts as settled.
   */
  function updateLeg(leg: LegState, rawLift: number, side: Side, now: number): boolean {
    leg.lift = leg.liftEma.smooth(side, rawLift);
    leg.settled = leg.settled ? leg.lift < LIFT_SETTLED_EXIT : leg.lift < LIFT_SETTLED_ENTER;
    const goodHold = leg.settled;

    if (goodHold) {
      leg.steadyFrames += 1;
      leg.graceWarned = false;
      leg.isHolding = leg.steadyFrames >= MIN_HOLD_FRAMES;

      if (leg.isHolding) {
        leg.lastGoodAt = now;
        if (leg.holdTickAt !== null) {
          leg.accumulated = Math.min(leg.accumulated + (now - leg.holdTickAt) / 1000, target);
        }
        leg.holdTickAt = now;
      }
    } else {
      leg.steadyFrames = 0;
      leg.isHolding = false;
      leg.holdTickAt = null;

      if (leg.lastGoodAt > 0 && (now - leg.lastGoodAt) / 1000 > grace && !leg.graceWarned) {
        leg.graceWarned = true;
        leg.accumulated = 0;
        leg.lastGoodAt = 0;
      }
    }

    return goodHold;
  }

  return {
    processFrame(lm: Point[], now: number): TreePoseResult {
      const body = readBody(lm);

      if (body === null) {
        if (lastPhase !== 'invisible') {
          speak(CUES.invisible, 'butterfly_invisible', 5000);
          lastPhase = 'invisible';
        }
        clearMotion(legs.left);
        clearMotion(legs.right);
        return idleResult('invisible');
      }

      const { hipL, hipR, kneeL, kneeR, ankleL, ankleR } = body;

      const hipMidX = (hipL.x + hipR.x) / 2;
      const hipMidY = (hipL.y + hipR.y) / 2;
      const shoulderMidY = (body.shoulderL.y + body.shoulderR.y) / 2;
      const torso = Math.abs(hipMidY - shoulderMidY) || 0.001;

      // 1. Both feet below the hips and tucked in toward the body.
      const feetBelowHips =
        (ankleL.y - hipMidY) / torso > ANKLE_BELOW_HIP_MIN &&
        (ankleR.y - hipMidY) / torso > ANKLE_BELOW_HIP_MIN;
      const feetTucked =
        Math.abs(ankleL.x - hipMidX) / torso < ANKLE_TUCK_MAX &&
        Math.abs(ankleR.x - hipMidX) / torso < ANKLE_TUCK_MAX;

      // 2. hip / knee / ankle collapsed into one compact cluster on both sides.
      const seatedCluster =
        clusterSpread(hipL, kneeL, ankleL, torso) < LEG_CLUSTER_MAX &&
        clusterSpread(hipR, kneeR, ankleR, torso) < LEG_CLUSTER_MAX;

      if (!feetBelowHips || !feetTucked || !seatedCluster) {
        if (lastPhase !== 'standing') {
          speak(CUES.standing, 'butterfly_standing', 8000);
          lastPhase = 'standing';
        }
        clearMotion(legs.left);
        clearMotion(legs.right);
        return idleResult('standing');
      }

      const wasBothHolding = legs.left.isHolding && legs.right.isHolding;
      lastPhase = 'active';

      // 3. Knee lift above that side's hip-ankle line, normalised by torso height
      //    so it is distance-invariant. Larger = knee raised higher off the floor.
      const leftGood = updateLeg(legs.left, kneeLift(hipL, kneeL, ankleL, torso), 'left', now);
      const rightGood = updateLeg(legs.right, kneeLift(hipR, kneeR, ankleR, torso), 'right', now);

      const bothHolding = legs.left.isHolding && legs.right.isHolding;
      if (bothHolding && !wasBothHolding) {
        speak(CUES.holding, 'butterfly_hold', 6000);
      } else if (!leftGood || !rightGood) {
        speak(CUES.flapping, 'butterfly_flapping', cueCooldown);
        fireError('knees_too_high', leftGood ? 'right' : rightGood ? 'left' : 'both', getTimestamp());
      }

      if (legs.left.graceWarned && legs.right.graceWarned) {
        speak(CUES.reset, 'butterfly_grace', 3000);
      }

      const isComplete = legs.left.accumulated >= target && legs.right.accumulated >= target;

      return {
        phase: isComplete ? 'complete' : 'active',
        activeLeg: null,
        leftLeg: snapshot(legs.left, legs.left.isHolding),
        rightLeg: snapshot(legs.right, legs.right.isHolding),
        isComplete,
        currentErrors: leftGood && rightGood ? [] : ['knees_too_high'],
      };
    },

    getErrors: () => [],

    reset(): void {
      legs.left = newLegState();
      legs.right = newLegState();
      lastPhase = 'invisible';
    },
  };
}
