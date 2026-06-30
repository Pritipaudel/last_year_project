"""
exercise/services.py

Personalization logic for exercises.

Design decision: this belongs in a services.py file (not a model manager or
serializer method) because it crosses two app boundaries — it reads
BiometricProfile (biometrics app) and queries Exercise (exercise app).
A model manager on Exercise would create a circular or cross-app import;
a serializer method would mix query logic into the serialization layer.
services.py is the Django-idiomatic home for this kind of cross-model business
logic.
"""

from .models import Exercise


# Maps BiometricProfile.goal values → goal_tags stored on exercises.
# goal is free-text on the profile but we normalise it here so the filter works.
GOAL_TAG_MAP = {
    'weight_loss': 'weight_loss',
    'lose weight': 'weight_loss',
    'fat loss': 'weight_loss',
    'weight_gain': 'weight_gain',
    'gain weight': 'weight_gain',
    'muscle gain': 'weight_gain',
    'build muscle': 'weight_gain',
    'general': 'general',
    'general fitness': 'general',
    'stay fit': 'general',
    'maintain': 'general',
}


def _resolve_goal_tag(profile_goal: str | None) -> str:
    """
    Normalise the free-text BiometricProfile.goal field into one of the three
    canonical goal_tag values: 'weight_loss', 'weight_gain', 'general'.
    Falls back to 'general' if the goal is unset or unrecognised.
    """
    if not profile_goal:
        return 'general'
    normalised = profile_goal.strip().lower()
    return GOAL_TAG_MAP.get(normalised, 'general')


def _safe_band(profile) -> str:
    """
    Return the age_group string from the profile, defaulting to '26-40' if
    the profile has no age_group yet (e.g. user skipped that step).
    """
    return profile.age_group or '26-40'


def _personalize(exercise: Exercise, band: str) -> dict:
    """
    Given a raw Exercise ORM object and an age band, return a dict containing
    only the data the frontend needs for this specific user's live session:
    - basic exercise info
    - the angle thresholds for THIS user's age band
    - the rep/set/rest config for THIS band
    - the prioritised voice cue list for THIS band

    If angle_ranges / rep_config / voice_cues are empty (exercise not yet
    calibrated), safe defaults are returned so the frontend never crashes.
    """
    default_angles = {
        'standing_threshold': 150,
        'bottom_min': 60,
        'bottom_max': 90,
        'too_deep_threshold': 50,
        'min_bottom_frames': 3,
    }
    default_rep = {'sets': 3, 'reps': 10, 'rest_seconds': 60}
    default_cues = {
        'insufficient_depth': 'Try to lower a bit more.',
        'excessive_depth': 'You are deep enough — start rising.',
        'forward_lean': 'Keep your chest up and back tall.',
        'knee_tracking': 'Guide your knees outward over your toes.',
    }

    band_angles = exercise.angle_ranges.get(band, default_angles)
    # Always include min_bottom_frames (noise guard) even if DB omits it
    band_angles.setdefault('min_bottom_frames', 3)

    band_rep = exercise.rep_config.get(band, default_rep)

    band_cues_raw = exercise.voice_cues.get(band, default_cues)
    # Return cues in priority order so the frontend can just pick [0] when
    # multiple errors fire simultaneously.
    priority_order = [
        'insufficient_depth',
        'excessive_depth',
        'forward_lean',
        'knee_tracking',
    ]
    band_cues_prioritised = {k: band_cues_raw.get(k, default_cues[k]) for k in priority_order}

    return {
        'id': exercise.id,
        'name': exercise.name,
        'muscle_group': exercise.muscle_group,
        'difficulty': exercise.difficulty,
        'image_url': exercise.image_url,
        'description': exercise.description,
        'goal_tags': exercise.goal_tags,
        # Everything the frontend needs for the live session — no further
        # backend calls required once this payload lands.
        'personalization': {
            'age_band': band,
            'angle_ranges': band_angles,
            'rep_config': band_rep,
            'voice_cues': band_cues_prioritised,
            'cue_cooldown_seconds': 8,   # frontend enforces this
        },
    }


def get_personalized_exercises(user) -> list[dict]:
    """
    Return a list of personalised exercise dicts for the authenticated user.

    Filtering logic:
    1. Resolve the user's goal_tag from BiometricProfile.goal
    2. Filter exercises whose goal_tags JSON array contains that tag
       (uses PostgreSQL JSON containment: @> operator via __contains)
    3. Personalize each result for the user's age_group

    Fallback: if BiometricProfile does not exist, returns general exercises
    for the default band '26-40'.
    """
    try:
        profile = user.biometric_profile
    except Exception:
        profile = None

    band = _safe_band(profile) if profile else '26-40'
    goal_tag = _resolve_goal_tag(profile.goal if profile else None)

    # __contains on a JSONField does a PostgreSQL @> containment check.
    # This correctly matches ["weight_loss", "general"] when filtering for "weight_loss".
    exercises = Exercise.objects.filter(goal_tags__contains=[goal_tag])

    return [_personalize(ex, band) for ex in exercises]


def get_personalized_exercise_detail(user, exercise_id: int) -> dict | None:
    """
    Return a single fully-personalised exercise dict for the authenticated user.
    Used when the user opens an exercise detail page right before a live session.
    Returns None if the exercise does not exist.
    """
    try:
        profile = user.biometric_profile
    except Exception:
        profile = None

    band = _safe_band(profile) if profile else '26-40'

    try:
        exercise = Exercise.objects.get(pk=exercise_id)
    except Exercise.DoesNotExist:
        return None

    return _personalize(exercise, band)
