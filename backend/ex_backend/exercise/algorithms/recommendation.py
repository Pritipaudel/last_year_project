"""
exercise/algorithms/recommendation.py

Content-Based Filtering Recommendation Algorithm

This system recommends items (exercises) based on the features of the items themselves
matched against the features of the user. It works with zero other users and no
interaction history, relying solely on extracting structured feature vectors and computing
Cosine Similarity.

Algorithms implemented:
1. Feature Vector Encoding
2. Cosine Similarity Calculation
3. Ranking (Insertion Sort)
"""

import math

# --------------------------------------------------------------------------
# Encoding Maps
# --------------------------------------------------------------------------

_AGE_BAND_ENCODINGS = {
    '18-25': 1.0,
    '26-40': 2.0,
    '41-60': 3.0,
    '60+': 4.0,
}

_DIFFICULTY_SCORE = {
    'Beginner': 1.0,
    'Intermediate': 2.0,
    'Advanced': 3.0,
}

# Average age-appropriate difficulty for user vector
_AGE_APPROPRIATE_DIFFICULTY = {
    '18-25': 2.5, # Intermediate-Advanced
    '26-40': 2.0, # Intermediate
    '41-60': 1.5, # Beginner-Intermediate
    '60+': 1.0,   # Beginner
}


# --------------------------------------------------------------------------
# Vector Extraction
# --------------------------------------------------------------------------

def calculate_cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """
    Computes the cosine similarity between two vectors of equal length.
    
    Formula: cosine_similarity(A, B) = (A · B) / (|A| × |B|)
    
    Returns a value between -1.0 (opposite) and 1.0 (perfect match).
    Returns 0.0 if either vector has zero magnitude.
    """
    if len(vec_a) != len(vec_b):
        return 0.0
        
    dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
    
    magnitude_a = math.sqrt(sum(a * a for a in vec_a))
    magnitude_b = math.sqrt(sum(b * b for b in vec_b))
    
    if magnitude_a == 0 or magnitude_b == 0:
        return 0.0
        
    return dot_product / (magnitude_a * magnitude_b)


def extract_exercise_vector(exercise, age_band: str) -> list[float]:
    """
    Builds a 7-dimensional feature vector for an exercise.
    
    Dimensions:
    0: goal_weight_loss      (1.0 if tag present, else 0.0)
    1: goal_weight_gain      (1.0 if tag present, else 0.0)
    2: goal_flexibility      (1.0 if tag present, else 0.0)
    3: goal_stay_active      (1.0 if tag present, else 0.0)
    4: age_band_encoded      (1.0=18-25, 2.0=26-40, 3.0=41-60, 4.0=60+)
    5: difficulty_normalized (difficulty / 5.0)
    6: high_impact           (1.0 if True, else 0.0)
    """
    goal_tags = getattr(exercise, 'goal_tags', []) or []
    
    goal_weight_loss = 1.0 if 'weight_loss' in goal_tags else 0.0
    goal_weight_gain = 1.0 if 'weight_gain' in goal_tags else 0.0
    goal_flexibility = 1.0 if 'flexibility' in goal_tags else 0.0
    goal_stay_active = 1.0 if 'stay_active' in goal_tags else 0.0
    
    # Base the exercise's target age band on the context it's being evaluated in,
    # or the average of its allowed groups if we wanted a fixed vector.
    # To keep dimensions aligned, we map the provided age_band context, but we 
    # check if the exercise actually allows it.
    allowed_groups = getattr(exercise, 'age_groups_allowed', []) or []
    
    # If the exercise allows the requested band, align the vector.
    # Otherwise, it gets a 0.0 for age band, heavily penalizing similarity.
    if age_band in allowed_groups:
        age_band_encoded = _AGE_BAND_ENCODINGS.get(age_band, 2.0)
    else:
        # It's an important mismatch
        age_band_encoded = 0.0
        
    difficulty_str = getattr(exercise, 'difficulty', 'Beginner')
    difficulty_score = _DIFFICULTY_SCORE.get(difficulty_str, 1.0)
    difficulty_normalized = difficulty_score / 5.0
    
    high_impact = 1.0 if getattr(exercise, 'high_impact', False) else 0.0
    
    return [
        goal_weight_loss,
        goal_weight_gain,
        goal_flexibility,
        goal_stay_active,
        age_band_encoded,
        difficulty_normalized,
        high_impact
    ]


def extract_user_vector(age_band: str, goal_tag: str, bmi: float) -> list[float]:
    """
    Builds a 7-dimensional feature vector for a user profile.
    
    Dimensions:
    0: goal_weight_loss      (1.0 if goal matches, else 0.0)
    1: goal_weight_gain      (1.0 if goal matches, else 0.0)
    2: goal_flexibility      (1.0 if goal matches, else 0.0)
    3: goal_stay_active      (1.0 if goal matches, else 0.0)
    4: age_band_encoded      (1.0=18-25, 2.0=26-40, 3.0=41-60, 4.0=60+)
    5: difficulty_preferred  (age-appropriate difficulty / 5.0)
    6: bmi_impact_tolerance  (0.0 if BMI > 30, else 1.0)
    """
    goal_weight_loss = 1.0 if goal_tag == 'weight_loss' else 0.0
    goal_weight_gain = 1.0 if goal_tag == 'weight_gain' else 0.0
    goal_flexibility = 1.0 if goal_tag == 'flexibility' else 0.0
    goal_stay_active = 1.0 if goal_tag == 'stay_active' else 0.0
    
    age_band_encoded = _AGE_BAND_ENCODINGS.get(age_band, 2.0)
    
    difficulty_pref = _AGE_APPROPRIATE_DIFFICULTY.get(age_band, 2.0)
    difficulty_preferred = difficulty_pref / 5.0
    
    effective_bmi = bmi if bmi > 0 else 25.0
    bmi_impact_tolerance = 0.0 if effective_bmi > 30.0 else 1.0
    
    return [
        goal_weight_loss,
        goal_weight_gain,
        goal_flexibility,
        goal_stay_active,
        age_band_encoded,
        difficulty_preferred,
        bmi_impact_tolerance
    ]


def _insertion_sort_descending(scored_list: list) -> list:
    """
    Sort scored_list in-place by score, descending.
    Each element is a dict {'exercise': ..., 'score': float}.
    """
    n = len(scored_list)
    for i in range(1, n):
        key = scored_list[i]
        j = i - 1
        while j >= 0 and scored_list[j]['score'] < key['score']:
            scored_list[j + 1] = scored_list[j]
            j -= 1
        scored_list[j + 1] = key
    return scored_list


# --------------------------------------------------------------------------
# Public API
# --------------------------------------------------------------------------

def rank_exercises_by_suitability(exercises: list, profile) -> list:
    """
    Content-Based Filtering algorithm entry point.
    
    Calculates cosine similarity between user feature vector and exercise 
    feature vectors. Ranks them descending.
    """
    if profile is not None:
        age_band = profile.age_group or '26-40'
        goal = profile.goal or ''
        bmi = float(profile.bmi) if profile.bmi else 25.0
    else:
        age_band = '26-40'
        goal = ''
        bmi = 25.0

    from exercise.services import _resolve_goal_tag  # noqa: PLC0415
    goal_tag = _resolve_goal_tag(goal)
    
    user_vector = extract_user_vector(age_band, goal_tag, bmi)

    scored_list = []
    for ex in exercises:
        ex_vector = extract_exercise_vector(ex, age_band)
        
        sim = calculate_cosine_similarity(user_vector, ex_vector)
        
        # We can map similarity [-1 to 1] to a 0-100 score for backwards compatibility,
        # or just sort by the float similarity directly. We'll use 0-100 scale.
        # Ensure we only include exercises that have some reasonable similarity (similarity > 0)
        similarity_score = max(0.0, sim * 100.0)
        
        scored_list.append({'exercise': ex, 'score': similarity_score})

    _insertion_sort_descending(scored_list)

    return scored_list
