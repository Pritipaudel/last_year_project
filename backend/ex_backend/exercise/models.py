from django.db import models
from django.contrib.auth.models import User


class Exercise(models.Model):
    """
    Library of available exercises (Push-ups, Squats, etc.)

    Personalization fields:
    - goal_tags: list of goals this exercise serves, e.g. ["weight_loss", "weight_gain", "general"]
    - angle_ranges: per-age-band MediaPipe knee interior-angle thresholds for rep counting
    - rep_config: per-age-band sets/reps/rest targets
    - voice_cues: per-age-band, per-error cue text strings for Web Speech API
    """
    DIFFICULTY_CHOICES = [
        ('Beginner', 'Beginner'),
        ('Intermediate', 'Intermediate'),
        ('Advanced', 'Advanced'),
    ]

    GOAL_CHOICES = ['weight_loss', 'weight_gain', 'general']

    name = models.CharField(max_length=255, unique=True)
    muscle_group = models.CharField(max_length=100, db_index=True)
    difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES)
    image_url = models.URLField()
    description = models.TextField(blank=True)

    # --- Personalization fields ---

    # Which goals this exercise is relevant for.
    # Values must be from: ["weight_loss", "weight_gain", "general"]
    goal_tags = models.JSONField(
        default=list,
        blank=True,
        help_text='e.g. ["weight_loss", "weight_gain", "general"]'
    )

    # Per-age-band knee angle thresholds (MediaPipe interior angle, degrees).
    # Keys: "18-25", "26-40", "41-60", "60+"
    # Each band: {bottom_min, bottom_max, standing_threshold, too_deep_threshold}
    angle_ranges = models.JSONField(
        default=dict,
        blank=True,
        help_text='Per-age-band MediaPipe knee angle thresholds for rep counting'
    )

    # Per-age-band rep/set/rest prescriptions.
    # Keys: "18-25", "26-40", "41-60", "60+"
    # Each band: {sets, reps, rest_seconds}
    rep_config = models.JSONField(
        default=dict,
        blank=True,
        help_text='Per-age-band sets, reps, and rest period in seconds'
    )

    # Per-age-band voice cue text for each error type.
    # Keys: "18-25", "26-40", "41-60", "60+"
    # Each band: {insufficient_depth, excessive_depth, forward_lean, knee_tracking}
    voice_cues = models.JSONField(
        default=dict,
        blank=True,
        help_text='Per-age-band cue text strings keyed by error type'
    )

    # Pre-rendered TTS audio for each cue in voice_cues, same key structure:
    # {"18-25": {"body_swing": "/media/voice_cues/<hash>.wav", ...}, ...}
    # Populated by `manage.py seed_voice_cue_audio`. The frontend plays this
    # clip when present and falls back to Web Speech synthesis when it is not.
    voice_cue_audio = models.JSONField(
        default=dict,
        blank=True,
        help_text='Per-age-band pre-rendered cue audio URLs keyed by error type'
    )

    # --- Algorithm 4: Weighted Recommendation fields ---

    # Which age bands this exercise is appropriate for.
    # Values must be from: ["18-25", "26-40", "41-60", "60+"]
    # Used by rank_exercises_by_suitability() for the 40-point age-band match score.
    age_groups_allowed = models.JSONField(
        default=list,
        blank=True,
        help_text='Age bands for which this exercise is appropriate, e.g. ["18-25", "26-40"]'
    )

    # Whether this exercise has high joint/cardiovascular impact (e.g. jumping, HIIT).
    # Used by rank_exercises_by_suitability(): BMI > 30 + high_impact = -20 penalty.
    high_impact = models.BooleanField(
        default=False,
        help_text='True if exercise has high joint load; penalised for users with BMI > 30'
    )

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class WorkoutSession(models.Model):
    """
    Represents a completed workout activity.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='workout_sessions')
    title = models.CharField(max_length=255, default="New Workout") # e.g., 'Upper Body Strength'
    workout_type = models.CharField(max_length=50, db_index=True) # e.g., Strength, Cardio, Core, Mobility
    duration_minutes = models.PositiveIntegerField(default=0)
    calories_burned = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    metadata = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"{self.title} on {self.created_at.strftime('%Y-%m-%d')}"

class ExerciseLog(models.Model):
    """
    Specific performance data for an exercise within a session.
    """
    session = models.ForeignKey(WorkoutSession, on_delete=models.CASCADE, related_name='exercise_logs')
    exercise = models.ForeignKey(Exercise, on_delete=models.PROTECT)
    
    sets = models.PositiveIntegerField(default=1)
    reps = models.PositiveIntegerField(null=True, blank=True)
    weight_kg = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.exercise.name} Log - {self.session.id}"


