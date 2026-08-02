"""
exercise/algorithms/recommendation.py

Algorithm 4: Weighted Multi-Criteria Scoring and Ranking.

NAME: Weighted Multi-Criteria Scoring and Ranking (Insertion Sort)
LOCATION: exercise/algorithms/recommendation.py :: rank_exercises_by_suitability()

TIME COMPLEXITY:  O(n²) — O(n) scoring pass + O(n²) insertion sort.
                  Acceptable because the exercise library is small (< 100).
                  Insertion sort is also stable: equal-score exercises preserve
                  their database insertion order, which is deterministic.
SPACE COMPLEXITY: O(n)  — one scored_list of (exercise, score) pairs.

WHY INSERTION SORT (not Python's sorted()):
    1. Named, from-scratch algorithm required for viva defense.
    2. Stable sort: ties in score preserve original exercise ordering.
    3. O(n²) is fine for n < 100; for large libraries a merge sort would be used.
    4. Insertion sort is cache-friendly on small, nearly-sorted data.

SCORING CRITERIA (total up to 100 points):
    Age band match:   40 pts  — exercise.age_groups_allowed contains user's band
                     +10 bonus — exercise.angle_ranges has entry for user's band
    Goal match:       30 pts  — goal_tag appears in exercise.goal_tags
    BMI suitability:  20 pts  — BMI ≤ 30 OR exercise is not high_impact
    Difficulty:       10 pts  — difficulty level is appropriate for age band

LINE-BY-LINE EXPLANATION (for viva):
    score_exercise():
        1. Start at 0.
        2. Age band match: check if band in exercise.age_groups_allowed (+40).
           Then check if band has entry in exercise.angle_ranges (+10 bonus).
        3. Goal match: check if goal_tag is in exercise.goal_tags list (+30).
        4. BMI: if user BMI > 30 and exercise is high_impact → no points.
           Otherwise award 20 points.
        5. Difficulty: map age band to appropriate difficulty levels.
           If exercise difficulty is in the appropriate set → +10.
        6. Return total score.

    rank_exercises_by_suitability():
        1. Build scored_list = [(score, exercise), ...] via score_exercise().
        2. Insertion sort (descending by score):
           For i from 1 to n-1:
               key = scored_list[i]
               j = i - 1
               While j >= 0 AND scored_list[j].score < key.score:
                   shift scored_list[j+1] = scored_list[j]  (move lower score right)
                   j -= 1
               Place key at scored_list[j+1]
        3. Return list of dicts {exercise, score} ordered highest score first.
"""


# --------------------------------------------------------------------------
# Difficulty level numeric mapping (for age-appropriateness scoring)
# Based on ACSM (American College of Sports Medicine) guidelines.
# --------------------------------------------------------------------------

_DIFFICULTY_SCORE = {
    'Beginner':     1,
    'Intermediate': 2,
    'Advanced':     3,
}

# Age band → set of appropriate difficulty numeric levels.
# 18-25: can handle Intermediate–Advanced (2–3)
# 26-40: can handle Beginner–Intermediate (1–2) conservatively, or Intermediate–Advanced
# 41-60: Beginner–Intermediate (1–2) appropriate, Advanced risky
# 60+:   Beginner only (1), Intermediate borderline
_AGE_APPROPRIATE_DIFFICULTY = {
    '18-25': {2, 3},     # Intermediate or Advanced
    '26-40': {1, 2, 3},  # All levels appropriate (widest bracket)
    '41-60': {1, 2},     # Beginner or Intermediate
    '60+':   {1, 2},     # Beginner or Intermediate (ACSM caution for 60+)
}


# --------------------------------------------------------------------------
# Internal: score one exercise against one user profile
# --------------------------------------------------------------------------

def _score_exercise(exercise, age_band: str, goal_tag: str, bmi: float) -> int:
    """
    Compute the suitability score (0–100) for one exercise / user pair.

    Args:
        exercise:  Django Exercise ORM object (or any object with the required attrs).
        age_band:  User's age group string, e.g. '26-40'.
        goal_tag:  Resolved canonical goal string, e.g. 'weight_loss'.
        bmi:       User's BMI as a float. Treated as 25.0 if unknown.

    Returns:
        Integer score 0–100.

    Time complexity:  O(1) — all checks are dict/list lookups or comparisons.
    Space complexity: O(1) — no collections allocated.
    """
    score = 0

    # ------------------------------------------------------------------
    # Criterion 1: Age band match (max 50 points)
    # ------------------------------------------------------------------
    # Primary match: exercise is listed as appropriate for this age group (+40).
    age_groups_allowed = exercise.age_groups_allowed or []
    if age_band in age_groups_allowed:
        score += 40

        # Bonus: exercise has calibrated angle thresholds for this band (+10).
        # This means the exercise has been specifically configured for the user's band,
        # not just generically allowed—a stronger match.
        angle_ranges = exercise.angle_ranges or {}
        if age_band in angle_ranges:
            score += 10

    # ------------------------------------------------------------------
    # Criterion 2: Goal match (30 points)
    # ------------------------------------------------------------------
    # The user's resolved goal tag must appear in the exercise's goal_tags list.
    goal_tags = exercise.goal_tags or []
    if goal_tag in goal_tags:
        score += 30

    # ------------------------------------------------------------------
    # Criterion 3: BMI suitability (20 points)
    # ------------------------------------------------------------------
    # High-impact exercises (jumping, HIIT) stress joints disproportionately
    # for users with BMI > 30. Award 20 points only when the combination is safe.
    effective_bmi = bmi if bmi and bmi > 0 else 25.0
    is_high_impact = getattr(exercise, 'high_impact', False)
    if effective_bmi > 30.0 and is_high_impact:
        # No points awarded — not penalised, just not rewarded.
        pass
    else:
        score += 20

    # ------------------------------------------------------------------
    # Criterion 4: Difficulty appropriateness for age band (10 points)
    # ------------------------------------------------------------------
    difficulty_str = exercise.difficulty or ''
    difficulty_level = _DIFFICULTY_SCORE.get(difficulty_str, 0)
    appropriate_levels = _AGE_APPROPRIATE_DIFFICULTY.get(age_band, {1, 2})
    if difficulty_level in appropriate_levels:
        score += 10

    return score


# --------------------------------------------------------------------------
# Insertion sort — scratch implementation (not Python's sorted())
# --------------------------------------------------------------------------

def _insertion_sort_descending(scored_list: list) -> list:
    """
    Sort scored_list in-place by score, descending.

    Each element is a dict {'exercise': ..., 'score': int}.

    Algorithm: Insertion Sort
    -  Stable: equal scores preserve original relative order.
    -  In-place: no extra list allocated.
    Time complexity:  O(n²)  worst case (all descending input).
    Space complexity: O(1)   extra space (in-place, only key variable).

    LINE-BY-LINE (for viva):
        outer loop: iterate from index 1 to n-1 (the unsorted part)
        key = current element to be inserted into sorted left partition
        j = last index of sorted partition
        inner while: shift elements that are SMALLER than key one position right
        insert key at the gap created by shifting
    """
    n = len(scored_list)

    # Outer loop: grow the sorted partition one element at a time
    for i in range(1, n):
        key = scored_list[i]          # element to insert into sorted partition
        j = i - 1                     # last index of the sorted partition

        # Shift elements that score LESS than key one position to the right.
        # We sort descending, so "less than key" means "should come after key".
        while j >= 0 and scored_list[j]['score'] < key['score']:
            scored_list[j + 1] = scored_list[j]  # shift right
            j -= 1

        # Insert key in the gap
        scored_list[j + 1] = key

    return scored_list


# --------------------------------------------------------------------------
# Public API
# --------------------------------------------------------------------------

def rank_exercises_by_suitability(exercises: list, profile) -> list:
    """
    Score and rank all exercises for the given user profile.

    This replaces the simple Exercise.objects.filter(goal_tags__contains=[...])
    call in services.get_personalized_exercises(). Instead of binary
    include/exclude filtering, every exercise receives a suitability score
    and the list is sorted descending by that score.

    Args:
        exercises:  List of Exercise ORM objects (all exercises from the DB).
        profile:    BiometricProfile ORM object for the authenticated user,
                    or None if the user has no biometric profile yet.

    Returns:
        List of dicts ordered by score descending:
            [{'exercise': <Exercise>, 'score': <int>}, ...]
        Exercises with score == 0 are included in the returned list but will
        be filtered out by the caller (get_personalized_exercises) before
        being returned to the frontend.

    Time complexity:  O(n) scoring + O(n²) insertion sort = O(n²) overall.
                      Acceptable for n < 100 (current exercise library size).
    Space complexity: O(n)  — one scored_list of the same length as exercises.
    """
    # ------------------------------------------------------------------
    # Step 1: Resolve user profile attributes with safe defaults.
    # ------------------------------------------------------------------
    if profile is not None:
        age_band = profile.age_group or '26-40'
        goal     = profile.goal or ''
        bmi      = float(profile.bmi) if profile.bmi else 25.0
    else:
        # No profile → use conservative defaults
        age_band = '26-40'
        goal     = ''
        bmi      = 25.0

    # Resolve free-text goal to a canonical goal_tag.
    # Import here to avoid circular imports (services.py uses this module).
    from exercise.services import _resolve_goal_tag  # noqa: PLC0415
    goal_tag = _resolve_goal_tag(goal)

    # ------------------------------------------------------------------
    # Step 2: Score every exercise — O(n) pass.
    # ------------------------------------------------------------------
    scored_list = []
    for ex in exercises:
        s = _score_exercise(ex, age_band, goal_tag, bmi)
        scored_list.append({'exercise': ex, 'score': s})

    # ------------------------------------------------------------------
    # Step 3: Insertion sort descending by score — O(n²) worst case.
    # ------------------------------------------------------------------
    _insertion_sort_descending(scored_list)

    return scored_list
