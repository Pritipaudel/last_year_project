from rest_framework import serializers
from .models import Exercise, WorkoutSession, ExerciseLog
from .algorithms.scoring import calculate_form_score
from .algorithms.angle import calculate_angle  # noqa: F401  (imported for re-export / tests)


class ExerciseSerializer(serializers.ModelSerializer):
    """Raw exercise serializer — used by admin/seeding, not personalized."""
    class Meta:
        model = Exercise
        fields = '__all__'


class PersonalizedExerciseSerializer(serializers.Serializer):
    """
    Serializes the dict returned by services.get_personalized_exercises().
    The 'personalization' block is a nested object containing everything the
    frontend needs for the live rep-counting session: angle thresholds,
    rep targets, and voice cue text strings keyed by error type.
    """
    id = serializers.IntegerField()
    name = serializers.CharField()
    muscle_group = serializers.CharField()
    difficulty = serializers.CharField()
    image_url = serializers.URLField()
    description = serializers.CharField()
    goal_tags = serializers.ListField(child=serializers.CharField())
    personalization = serializers.DictField()


class WorkoutSessionSerializer(serializers.ModelSerializer):
    """Summarizes a completed session for the Dashboard/History pages."""
    exercise_name = serializers.SerializerMethodField()
    reps = serializers.SerializerMethodField()

    class Meta:
        model = WorkoutSession
        fields = [
            'id', 'title', 'workout_type', 'duration_minutes',
            'created_at', 'exercise_name', 'reps', 'metadata'
        ]

    def get_exercise_name(self, obj):
        first_log = obj.exercise_logs.first()
        return first_log.exercise.name if first_log else obj.title

    def get_reps(self, obj):
        first_log = obj.exercise_logs.first()
        return first_log.reps if first_log else 0


class SessionSummarySerializer(serializers.Serializer):
    """
    Receives the POST body from the frontend at the end of a live exercise set.

    The frontend sends:
    - exercise_id: which exercise was performed
    - reps_completed: integer (min of both arms for curl; total reps for other exercises)
    - reps_left:  (optional) individual left arm rep count — for bilateral exercises
    - reps_right: (optional) individual right arm rep count — for bilateral exercises
    - form_errors: list of error events {error_type, count, timestamp}
    - duration_seconds: total time for the set
    - goal_context: (optional) the goal tag active during this session for logging

    This creates a WorkoutSession + ExerciseLog pair so results are persisted.
    History page reads from WorkoutSession — no changes needed there.
    """
    exercise_id = serializers.IntegerField()
    reps_completed = serializers.IntegerField(min_value=0)
    duration_seconds = serializers.IntegerField(min_value=0)
    form_errors = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list
    )
    # Optional per-arm data for bilateral exercises (e.g. Dumbbell Bicep Curl)
    reps_left = serializers.IntegerField(min_value=0, required=False, default=0)
    reps_right = serializers.IntegerField(min_value=0, required=False, default=0)
    # Optional goal context for richer session metadata
    goal_context = serializers.CharField(required=False, default='', allow_blank=True)
    # Algorithm 3: per-frame smoothed angle readings for form score calculation.
    # The frontend appends the EMA-smoothed joint angle each frame and sends the
    # full list at session end. Backend calls calculate_form_score() on this list.
    angle_readings = serializers.ListField(
        child=serializers.FloatField(),
        required=False,
        default=list,
        help_text='EMA-smoothed joint angles recorded per frame during the set'
    )

    def create(self, validated_data):
        user = self.context['request'].user
        exercise = Exercise.objects.get(pk=validated_data['exercise_id'])

        # Build metadata — includes per-arm data if provided
        meta = {
            'form_errors': validated_data.get('form_errors', []),
            'source': 'live_tracking',
        }
        if validated_data.get('reps_left') or validated_data.get('reps_right'):
            meta['reps_left'] = validated_data.get('reps_left', 0)
            meta['reps_right'] = validated_data.get('reps_right', 0)
        if validated_data.get('goal_context'):
            meta['goal_context'] = validated_data['goal_context']

        # Algorithm 3: Form Score Calculation.
        # The ideal range comes from the exercise's angle_ranges for the user's
        # age band. We use 'bottom_min'/'bottom_max' as the ideal squat depth,
        # or 'peak_min'/'peak_max' for curl exercises.
        angle_readings = validated_data.get('angle_readings', [])
        if angle_readings:
            # Attempt to resolve ideal range from the exercise's angle_ranges.
            # Fall back to sensible defaults if the exercise has no calibrated range.
            angle_ranges = exercise.angle_ranges or {}
            # Try to find any configured band; use first available or safe default.
            first_band = next(iter(angle_ranges), None)
            band_cfg = angle_ranges.get(first_band, {}) if first_band else {}
            ideal_min = float(band_cfg.get('bottom_min', band_cfg.get('peak_min', 60)))
            ideal_max = float(band_cfg.get('bottom_max', band_cfg.get('peak_max', 90)))
            form_score = calculate_form_score(angle_readings, ideal_min, ideal_max)
            meta['form_score'] = form_score
            meta['angle_readings_count'] = len(angle_readings)

        session = WorkoutSession.objects.create(
            user=user,
            title=f"{exercise.name} Session",
            workout_type=exercise.muscle_group,
            duration_minutes=max(1, validated_data['duration_seconds'] // 60),
            metadata=meta,
        )

        ExerciseLog.objects.create(
            session=session,
            exercise=exercise,
            sets=1,
            reps=validated_data['reps_completed'],
            duration_seconds=validated_data['duration_seconds'],
        )

        return {
            'session_id': session.id,
            'exercise': exercise.name,
            'reps_completed': validated_data['reps_completed'],
            'reps_left': validated_data.get('reps_left', 0),
            'reps_right': validated_data.get('reps_right', 0),
            'duration_seconds': validated_data['duration_seconds'],
        }


class HoldSessionSummarySerializer(serializers.Serializer):
    """
    Receives the POST body from the frontend at the end of a Tree Pose (static hold) session.

    Unlike rep-based exercises, hold sessions track:
    - Per-leg hold durations (left and right independently)
    - Target hold duration (for analytics comparison)
    - Form errors with leg attribution
    - Pose type (always "static_hold" for this serializer)
    - Goal context (always "flexibility" for Tree Pose)
    - Age group (for analytics stratification)

    Creates a WorkoutSession + ExerciseLog pair.
    ExerciseLog uses duration_seconds to store the MINIMUM of left/right hold
    (conservative measure of session success).
    """
    exercise_id       = serializers.IntegerField()
    left_leg_hold_duration_seconds  = serializers.FloatField(min_value=0)
    right_leg_hold_duration_seconds = serializers.FloatField(min_value=0)
    target_hold_duration_seconds    = serializers.FloatField(min_value=0)
    form_errors_triggered = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list
        # Each item: { "error_type": str, "count": int, "leg": str }
    )
    goal_context = serializers.CharField(default='flexibility', allow_blank=True)
    age_group    = serializers.CharField(required=False, allow_blank=True)

    def create(self, validated_data):
        user = self.context['request'].user
        exercise = Exercise.objects.get(pk=validated_data['exercise_id'])

        left_hold  = validated_data['left_leg_hold_duration_seconds']
        right_hold = validated_data['right_leg_hold_duration_seconds']
        target     = validated_data['target_hold_duration_seconds']

        meta = {
            'source': 'live_tracking',
            'pose_type': 'static_hold',
            'left_leg_hold_seconds': left_hold,
            'right_leg_hold_seconds': right_hold,
            'target_hold_seconds': target,
            'left_leg_success': left_hold >= target,
            'right_leg_success': right_hold >= target,
            'form_errors': validated_data.get('form_errors_triggered', []),
            'goal_context': validated_data.get('goal_context', 'flexibility'),
            'age_group': validated_data.get('age_group', ''),
        }

        session = WorkoutSession.objects.create(
            user=user,
            title=f"{exercise.name} Session",
            workout_type=exercise.muscle_group,
            # Duration = sum of both holds (total time the user was actively posing)
            duration_minutes=max(1, int((left_hold + right_hold) / 60)),
            metadata=meta,
        )

        ExerciseLog.objects.create(
            session=session,
            exercise=exercise,
            sets=1,
            reps=None,                           # not applicable for static hold
            # Store minimum hold as duration — represents the weakest leg (conservative)
            duration_seconds=int(min(left_hold, right_hold)),
        )

        return {
            'session_id': session.id,
            'exercise': exercise.name,
            'left_leg_hold_seconds': left_hold,
            'right_leg_hold_seconds': right_hold,
            'target_hold_seconds': target,
            'left_leg_success': left_hold >= target,
            'right_leg_success': right_hold >= target,
        }

