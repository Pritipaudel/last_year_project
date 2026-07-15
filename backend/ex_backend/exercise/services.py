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
    # Bicep curl and future exercises use 'stay_active' as a valid tag.
    'stay_active': 'stay_active',
    'stay active': 'stay_active',
    'active': 'stay_active',
    'flexibility': 'flexibility',
    'rehab': 'rehabilitation',
    'rehabilitation': 'rehabilitation',
    'doctor recommended': 'rehabilitation',
}


def _resolve_goal_tag(profile_goal: str | None) -> str:
    """
    Normalise the free-text BiometricProfile.goal field into one of the
    canonical goal_tag values: 'weight_loss', 'weight_gain', 'general',
    'stay_active'. Falls back to 'general' if the goal is unset or unrecognised.
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


def _get_postural_flags(profile) -> dict:
    """
    Return the latest PosturalAssessment deviation flags for the user, or an
    empty dict if no assessment exists. Used to optionally elevate voice cue
    priority (e.g. shoulder elevation cue up if rounded_shoulders is flagged).

    Deliberately wraps in try/except so a missing or malformed assessment
    never crashes the exercise personalisation pipeline.
    """
    try:
        latest = profile.assessments.order_by('-created_at').first()
        if latest:
            return {
                'deviations': latest.deviations or {},
                'joint_angles': latest.joint_angles or {},
            }
    except Exception:
        pass
    return {'deviations': {}, 'joint_angles': {}}


def _personalize(user, exercise: Exercise, band: str, goal_tag: str) -> dict:
    """
    Given a raw Exercise ORM object, an age band, and a resolved goal tag,
    return a dict containing only the data the frontend needs for this specific
    user's live session:

    - basic exercise info
    - the angle thresholds for THIS user's age band
    - the rep/set/rest/tempo config for THIS band AND THIS goal
    - the prioritised voice cue list for THIS band
    - the state machine thresholds for rep counting
    - the postural-flag-adjusted cue priority order

    If angle_ranges / rep_config / voice_cues are empty (exercise not yet
    calibrated), safe defaults are returned so the frontend never crashes.

    rep_config supports two structures:
      1. Flat (original squat style):  { "18-25": { sets, reps, rest_seconds } }
      2. Goal-nested (curl style):     { "18-25": { "weight_gain": {...}, "weight_loss": {...} } }
    Both are handled transparently.
    """
    # ----- DEFAULTS -----
    default_angles = {
        'standing_threshold': 150,
        'bottom_min': 60,
        'bottom_max': 90,
        'too_deep_threshold': 50,
        'min_bottom_frames': 3,
    }
    default_rep = {'sets': 3, 'reps': 10, 'rest_seconds': 60}
    default_cues = {
        'insufficient_depth': 'Lower your hips a bit more to hit parallel.',
        'excessive_depth': 'You have hit peak depth, start rising.',
        'forward_lean': 'Keep your chest up and look forward.',
        'knee_tracking': 'Keep your knees aligned over your toes.',
    }

    # ----- ANGLES -----
    band_angles = exercise.angle_ranges.get(band, default_angles)
    band_angles.setdefault('min_bottom_frames', 3)

    # ----- REP CONFIG — handles both flat and goal-nested structures -----
    band_rep_raw = exercise.rep_config.get(band, default_rep)
    if isinstance(band_rep_raw, dict):
        # Check if this is a goal-nested structure { "weight_gain": {...}, ... }
        # A goal-nested dict has string keys that are goal names, not config keys.
        first_key = next(iter(band_rep_raw), None)
        is_goal_nested = first_key in GOAL_TAG_MAP or first_key in (
            'weight_gain', 'weight_loss', 'stay_active', 'general'
        )
        if is_goal_nested:
            # Try to match current goal, fall back to any available goal, then default
            band_rep = band_rep_raw.get(goal_tag) or next(iter(band_rep_raw.values()), default_rep)
        else:
            # Flat structure (e.g. squat)
            band_rep = band_rep_raw
    else:
        band_rep = default_rep

    # ----- VOICE CUES -----
    band_cues_raw = exercise.voice_cues.get(band, default_cues)

    # Priority order — default (squat). Curl exercises override this below.
    priority_order = [
        'insufficient_depth',
        'excessive_depth',
        'forward_lean',
        'knee_tracking',
    ]

    # Pre-fetch postural flags for cue priority adjustments
    deviations = {}
    try:
        profile = user.biometric_profile
        flags = _get_postural_flags(profile)
        deviations = flags.get('deviations', {})
    except Exception:
        pass

    is_static_hold = (
        'tree' in exercise.name.lower() 
        or 'vrksasana' in exercise.name.lower()
        or 'butterfly' in exercise.name.lower()
        or 'baddha' in exercise.name.lower()
    )
    is_curl = 'curl' in exercise.name.lower()

    if is_static_hold:
        is_butterfly = 'butterfly' in exercise.name.lower() or 'baddha' in exercise.name.lower()
        
        if is_butterfly:
            priority_order = [
                'spine_rounded',      # P1 — lumbar safety
                'shoulders_raised',   # P2
                'head_dropped',       # P2
                'knees_too_high',     # P3
                'feet_apart',         # P3
            ]
            
            if deviations.get('anterior_pelvic_tilt') or deviations.get('excessive_lordosis'):
                if 'spine_rounded' in priority_order:
                    priority_order.remove('spine_rounded')
                    priority_order.insert(0, 'spine_rounded')
        else:
            priority_order = [
                'trunk_sway',        # P1 — safety, fire immediately
                'hip_unlevel',       # P2 — form
                'knee_bent',         # P2 — form
                'foot_too_low',      # P3 — alignment
                'arms_asymmetric',   # P3 — alignment
                'forward_head',      # P3 — alignment (elevates to P2 if flagged)
            ]

            if deviations.get('forward_head') or deviations.get('rounded_shoulders'):
                priority_order.remove('forward_head')
                priority_order.insert(2, 'forward_head')  # Insert at P2 position

        band_cues_prioritised = {k: band_cues_raw.get(k, '') for k in priority_order}

        band_hold_config = exercise.rep_config.get(band, {
            'target_hold_seconds': 20,
            'foot_placement': 'ankle',
            'standing_position': 'free_standing',
            'variant_name': 'Tree Pose',
            'safety_note': None,
            'grace_period_seconds': 3,
        })

        return {
            'id': exercise.id,
            'name': exercise.name,
            'muscle_group': exercise.muscle_group,
            'difficulty': exercise.difficulty,
            'image_url': exercise.image_url,
            'description': exercise.description,
            'goal_tags': exercise.goal_tags,
            'pose_type': 'static_hold',
            'personalization': {
                'age_band': band,
                'goal': 'flexibility',
                'user_name': getattr(user, 'first_name', user.username),
                'alignment_thresholds': band_angles,
                'hold_config': band_hold_config,
                'voice_cues': band_cues_prioritised,
                'voice_cue_priority': priority_order,
                'cue_cooldown_seconds': 8,
                'postural_flags': deviations,
            },
        }

    if is_curl:
        # Safety-first priority order for bicep curl (see implementation plan Step 5)
        priority_order = [
            'body_swing',           # P1 — trunk momentum, risk of lower back injury
            'elbow_swing',          # P2 — elbow drift changes recruitment, injury risk
            'shoulder_elevation',   # P3 — compensation pattern
            'insufficient_curl',    # P4 — form quality
            'incomplete_extension', # P5 — form quality
        ]

        if deviations.get('rounded_shoulders') or deviations.get('shoulder_asymmetry'):
            priority_order.remove('shoulder_elevation')
            priority_order.insert(0, 'shoulder_elevation')

    band_cues_prioritised = {k: band_cues_raw.get(k, default_cues.get(k, '')) for k in priority_order}

    return {
        'id': exercise.id,
        'name': exercise.name,
        'muscle_group': exercise.muscle_group,
        'difficulty': exercise.difficulty,
        'image_url': exercise.image_url,
        'description': exercise.description,
        'goal_tags': exercise.goal_tags,
        'personalization': {
            'age_band': band,
            'goal': goal_tag,
            'user_name': getattr(user, 'first_name', user.username),
            'angle_ranges': band_angles,
            'rep_config': band_rep,
            'voice_cues': band_cues_prioritised,
            'voice_cue_priority': priority_order,
            'cue_cooldown_seconds': 8,
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

    return [_personalize(user, ex, band, goal_tag) for ex in exercises]


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
    goal_tag = _resolve_goal_tag(profile.goal if profile else None)

    try:
        exercise = Exercise.objects.get(pk=exercise_id)
    except Exercise.DoesNotExist:
        return None

    return _personalize(user, exercise, band, goal_tag)
