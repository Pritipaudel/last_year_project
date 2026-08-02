"""
exercise/algorithms/scoring.py

Algorithm 3: Form Score Calculation using Weighted Deviation Scoring.

NAME: Form Score Calculation (Weighted Deviation Scoring)
LOCATION: exercise/algorithms/scoring.py :: calculate_form_score()

TIME COMPLEXITY:  O(n)  where n = number of angle readings in the set.
                  One pass through the readings list; no nested loops.
SPACE COMPLEXITY: O(1)  — only scalar accumulators used; no new list created.

WHY THIS ALGORITHM:
    A weighted deviation approach converts raw angular error into a
    normalised 0–100 score, making performance comparable across exercises
    with different ideal ranges. The penalty is proportional to the deviation
    relative to the ideal range width, so a 10° error out of a 30° range
    is penalised more heavily than a 10° error out of a 60° range. This
    is clinically meaningful: a tight ideal range means the exercise requires
    higher precision.

LINE-BY-LINE EXPLANATION (for viva):
    1. Validate inputs: empty readings or zero range → return 100.0 (perfect,
       since there is nothing to penalise).
    2. ideal_range = ideal_max - ideal_min. This is the denominator for the
       proportional penalty.
    3. Loop over each angle reading (one pass — O(n)):
        a. If the angle is within [ideal_min, ideal_max] → penalty = 0.0
        b. If below ideal_min → deviation = ideal_min - angle
           If above ideal_max → deviation = angle - ideal_max
        c. penalty = (deviation / ideal_range) * 10.0
           Scaling by 10 means a full-range deviation gives a penalty of 10.
    4. total_penalty accumulates all per-frame penalties.
    5. average_penalty = total_penalty / n  (mean penalty per frame)
    6. raw_score = 100.0 - average_penalty
    7. Clamp to [0.0, 100.0] — a very poor session cannot go negative.
    8. Return rounded to 1 decimal place for clean display.

EDGE CASES:
    - Empty angle_readings list → returns 100.0 (no data, no penalty)
    - ideal_min == ideal_max (zero-width range) → returns 100.0 (undefined range)
    - All readings outside range → score approaches 0.0 (clamped, never negative)
    - Readings exactly on ideal_min or ideal_max → penalty = 0.0 (boundary is ideal)

UNIT TESTS (see exercise/tests/test_algorithms.py):
    calculate_form_score([75.0], 60, 90)     == 100.0  (inside range)
    calculate_form_score([45.0], 60, 90)     == 95.0   (15° below, penalty = 5.0)
    calculate_form_score([], 60, 90)         == 100.0  (empty list)
    calculate_form_score([0.0]*100, 60, 90)  ==  0.0   (all far outside, clamped)
"""


def calculate_form_score(
    angle_readings: list,
    ideal_min: float,
    ideal_max: float,
) -> float:
    """
    Calculate a form quality score for one completed exercise set.

    Args:
        angle_readings: List of smoothed joint angle values (degrees) recorded
                        during the set — one value per video frame.
        ideal_min:      Lower bound of the ideal angle range for this user's
                        age band (from exercise.angle_ranges[band]).
        ideal_max:      Upper bound of the ideal angle range.

    Returns:
        A score from 0.0 to 100.0 (inclusive), rounded to 1 decimal place.
        100.0 = perfect form throughout the set.
        0.0   = maximally poor form throughout (clamped).

    Time complexity:  O(n)  — single pass over angle_readings.
    Space complexity: O(1)  — only scalar variables, no new collections.
    """
    # Step 1: Guard — no data or undefined range → perfect score (nothing to penalise)
    n = len(angle_readings)
    if n == 0:
        return 100.0

    ideal_range = ideal_max - ideal_min
    if ideal_range <= 0:
        # Zero or inverted range is ill-defined; return perfect score.
        return 100.0

    # Step 2: Single-pass accumulation of penalties
    total_penalty = 0.0

    for angle in angle_readings:
        # Step 3a: Inside ideal range — no penalty
        if ideal_min <= angle <= ideal_max:
            penalty = 0.0
        # Step 3b: Below ideal minimum — penalise proportionally
        elif angle < ideal_min:
            deviation = ideal_min - angle
            # Step 3c: Scale: one full ideal_range of deviation = 10 penalty points
            penalty = (deviation / ideal_range) * 10.0
        # Step 3d: Above ideal maximum — same proportional logic
        else:
            deviation = angle - ideal_max
            penalty = (deviation / ideal_range) * 10.0

        # Step 4: Accumulate
        total_penalty += penalty

    # Step 5: Average penalty per frame
    average_penalty = total_penalty / n

    # Step 6: Subtract from perfect score
    raw_score = 100.0 - average_penalty

    # Step 7: Clamp to valid range [0.0, 100.0]
    clamped_score = max(0.0, min(100.0, raw_score))

    # Step 8: Round to 1 decimal place for display
    return round(clamped_score, 1)
