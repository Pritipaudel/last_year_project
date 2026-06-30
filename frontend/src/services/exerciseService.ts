import api from "@/lib/api";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface AngleRange {
  standing_threshold: number;
  bottom_min: number;
  bottom_max: number;
  too_deep_threshold: number;
  min_bottom_frames: number;
}

export interface RepConfig {
  sets: number;
  reps: number;
  rest_seconds: number;
}

export interface VoiceCues {
  insufficient_depth: string;
  excessive_depth: string;
  forward_lean: string;
  knee_tracking: string;
}

export interface ExercisePersonalization {
  age_band: string;
  angle_ranges: AngleRange;
  rep_config: RepConfig;
  voice_cues: VoiceCues;
  cue_cooldown_seconds: number;
}

export interface Exercise {
  id: number;
  name: string;
  muscle_group: string;
  muscleGroup: string; // camelCase alias for UI components
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  image_url: string;
  imageUrl: string; // camelCase alias for UI components
  description: string;
  goal_tags: string[];
  personalization: ExercisePersonalization;
}

export interface FormError {
  error_type: "insufficient_depth" | "excessive_depth" | "forward_lean" | "knee_tracking";
  count: number;
  timestamp?: string;
}

export interface SessionSummaryPayload {
  exercise_id: number;
  reps_completed: number;
  duration_seconds: number;
  form_errors: FormError[];
}

export interface WorkoutSession {
  id: number;
  title: string;
  workout_type: string;
  duration_minutes: number;
  created_at: string;
  exercise_name: string;
  reps: number;
  metadata: any;
}

// ----------------------------------------------------------------
// Normalise: map snake_case API response to Exercise interface
// ----------------------------------------------------------------
function normaliseExercise(raw: any): Exercise {
  return {
    ...raw,
    // camelCase aliases so existing UI components (ExerciseSelectionPage etc.)
    // continue to work without changes
    muscleGroup: raw.muscle_group,
    imageUrl: raw.image_url,
  };
}

// ----------------------------------------------------------------
// Service
// ----------------------------------------------------------------
export const exerciseService = {
  /**
   * Fetch the personalised exercise list for the authenticated user.
   */
  getExercises: async (): Promise<Exercise[]> => {
    const { data } = await api.get("exercises/");
    return (data as any[]).map(normaliseExercise);
  },

  /**
   * Fetch a single exercise with thresholds already adjusted for this user.
   */
  getExerciseById: async (id: string | number): Promise<Exercise | null> => {
    try {
      const { data } = await api.get(`exercises/${id}/`);
      return normaliseExercise(data);
    } catch {
      return null;
    }
  },

  /**
   * POST session results after a live tracking set completes.
   */
  submitSessionSummary: async (payload: SessionSummaryPayload): Promise<any> => {
    const { data } = await api.post("exercises/session/", payload);
    return data;
  },

  /**
   * Fetch the authenticated user's workout session history.
   */
  getSessions: async (): Promise<WorkoutSession[]> => {
    const { data } = await api.get("exercises/sessions/");
    return data;
  },
};
