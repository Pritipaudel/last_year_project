from rest_framework import serializers
from .models import Exercise, WorkoutSession, ExerciseLog


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
