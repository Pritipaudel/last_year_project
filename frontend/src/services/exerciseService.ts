import api from "@/lib/api";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

/** Shared angle fields for exercises that use the squat-style flat angle config. */
export interface SquatAngleRange {
  standing_threshold: number;
  bottom_min: number;
  bottom_max: number;
  too_deep_threshold: number;
  min_bottom_frames: number;
}

/** Angle fields for bilateral curl-style exercises. */
export interface CurlAngleRange {
  extended_threshold: number;
  peak_max: number;
  peak_min: number;
  min_peak_frames: number;
  position: string; // "standing" | "seated"
}

/** Accepts both squat flat range and curl range transparently. */
export type AngleRange = SquatAngleRange & Partial<CurlAngleRange>;

export interface RepConfig {
  sets: number;
  reps: number;
  rest_seconds: number;
  tempo?: string;       // e.g. "2-0-2"
  load_note?: string;   // e.g. "Heavy dumbbell, seated"
}

/** Voice cues for squat-style exercises. */
export interface SquatVoiceCues {
  insufficient_depth: string;
  excessive_depth: string;
  forward_lean: string;
  knee_tracking: string;
}

/** Voice cues for curl-style exercises. */
export interface CurlVoiceCues {
  body_swing: string;
  elbow_swing: string;
  shoulder_elevation: string;
  insufficient_curl: string;
  incomplete_extension: string;
}

/** Union — personalization.voice_cues can be either style. */
export type VoiceCues = SquatVoiceCues & Partial<CurlVoiceCues>;

export interface ExercisePersonalization {
  age_band: string;
  goal: string;
  angle_ranges: AngleRange;
  rep_config: RepConfig;
  // Static hold specifics
  alignment_thresholds?: any;
  hold_config?: any;
  postural_flags?: any;
  voice_cues: VoiceCues;
  voice_cue_priority: string[];
  cue_cooldown_seconds: number;
  user_name?: string;
}

export interface Exercise {
  id: number;
  name: string;
  muscle_group: string;
  muscleGroup: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  image_url: string;
  imageUrl: string;
  description: string;
  goal_tags: string[];
  pose_type?: 'rep_based' | 'static_hold';
  personalization: ExercisePersonalization;
}

export interface HoldSessionSummaryPayload {
  exercise_id: number;
  left_leg_hold_duration_seconds: number;
  right_leg_hold_duration_seconds: number;
  target_hold_duration_seconds: number;
  form_errors_triggered: FormError[];
  goal_context?: string;
  age_group?: string;
}

export interface FormError {
  error_type: string;
  count?: number;
  timestamp?: string;
}

export interface SessionSummaryPayload {
  exercise_id: number;
  reps_completed: number;
  duration_seconds: number;
  form_errors: FormError[];
  reps_left?: number;
  reps_right?: number;
  goal_context?: string;
}

export interface WorkoutSession {
  id: number;
  title: string;
  workout_type: string;
  duration_minutes: number;
  created_at: string;
  exercise_name: string;
  reps: number | null;
  metadata: any;
}

// ----------------------------------------------------------------
// Normalise: map snake_case API response to Exercise interface
// ----------------------------------------------------------------
function normaliseExercise(raw: any): Exercise {
  return {
    ...raw,
    muscleGroup: raw.muscle_group,
    imageUrl: raw.image_url,
  };
}

// ----------------------------------------------------------------
// Helper: determine if an exercise is curl-style
// ----------------------------------------------------------------
export function isCurlExercise(exercise: Exercise): boolean {
  return exercise.name.toLowerCase().includes('curl');
}

export function isStaticHoldExercise(exercise: Exercise): boolean {
  return exercise.pose_type === 'static_hold' || exercise.name.toLowerCase().includes('tree');
}

// ----------------------------------------------------------------
// Service
// ----------------------------------------------------------------
export const exerciseService = {
  getExercises: async (): Promise<Exercise[]> => {
    const { data } = await api.get("exercises/");
    return (data as any[]).map(normaliseExercise);
  },

  getExerciseById: async (id: string | number): Promise<Exercise | null> => {
    try {
      const { data } = await api.get(`exercises/${id}/`);
      return normaliseExercise(data);
    } catch {
      return null;
    }
  },

  getSessions: async (): Promise<WorkoutSession[]> => {
    const { data } = await api.get("exercises/sessions/");
    return data;
  },

  submitSessionSummary: async (payload: SessionSummaryPayload): Promise<any> => {
    const { data } = await api.post("exercises/session/", payload);
    return data;
  },

  submitHoldSessionSummary: async (payload: HoldSessionSummaryPayload): Promise<any> => {
    const { data } = await api.post("exercises/session/hold/", payload);
    return data;
  },
};
