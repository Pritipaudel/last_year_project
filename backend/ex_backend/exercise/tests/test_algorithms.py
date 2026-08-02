"""
exercise/tests/test_algorithms.py

Unit tests for all three backend algorithms:
  - Algorithm 1: calculate_angle() — Joint Angle Calculation
  - Algorithm 3: calculate_form_score() — Form Score Calculation
  - Algorithm 4: rank_exercises_by_suitability() — Weighted Recommendation

Run with: python manage.py test exercise.tests.test_algorithms -v 2
"""

import math
import unittest

from exercise.algorithms.angle import calculate_angle
from exercise.algorithms.scoring import calculate_form_score
from exercise.algorithms.recommendation import _insertion_sort_descending, _score_exercise


# ============================================================================
# HELPERS
# ============================================================================

def pt(x: float, y: float) -> dict:
    """Shorthand for a 2D point dict."""
    return {'x': x, 'y': y}


# ============================================================================
# ALGORITHM 1: Joint Angle Calculation (Vector Dot Product)
# ============================================================================

class TestCalculateAngle(unittest.TestCase):
    """Tests for exercise.algorithms.angle.calculate_angle()"""

    def test_right_angle_returns_90(self):
        result = calculate_angle(pt(0, 1), pt(0, 0), pt(1, 0))
        self.assertAlmostEqual(result, 90.0, places=3)

    def test_straight_line_returns_180(self):
        result = calculate_angle(pt(0, 1), pt(0, 0), pt(0, -1))
        self.assertAlmostEqual(result, 180.0, places=3)

    def test_45_degree_angle(self):
        result = calculate_angle(pt(1, 1), pt(0, 0), pt(1, 0))
        self.assertAlmostEqual(result, 45.0, places=3)

    def test_60_degree_angle(self):
        result = calculate_angle(pt(1, 0), pt(0, 0), pt(0.5, math.sqrt(3) / 2))
        self.assertAlmostEqual(result, 60.0, places=2)

    def test_120_degree_angle(self):
        result = calculate_angle(pt(-1, 0), pt(0, 0), pt(0.5, math.sqrt(3) / 2))
        self.assertAlmostEqual(result, 120.0, places=2)

    def test_symmetric_points_return_0(self):
        result = calculate_angle(pt(0, 1), pt(0, 0), pt(0, 1))
        self.assertAlmostEqual(result, 0.0, places=3)

    def test_zero_vector_ba_returns_0(self):
        result = calculate_angle(pt(0, 0), pt(0, 0), pt(1, 0))
        self.assertEqual(result, 0.0)

    def test_zero_vector_bc_returns_0(self):
        result = calculate_angle(pt(0, 1), pt(0, 0), pt(0, 0))
        self.assertEqual(result, 0.0)

    def test_all_same_point_returns_0(self):
        result = calculate_angle(pt(0, 0), pt(0, 0), pt(0, 0))
        self.assertEqual(result, 0.0)

    def test_return_value_in_valid_range(self):
        for degrees in range(0, 181, 15):
            rad = math.radians(degrees)
            result = calculate_angle(pt(math.cos(rad), math.sin(rad)), pt(0, 0), pt(1, 0))
            self.assertTrue(0.0 <= result <= 180.0)

    def test_floating_point_cosine_clamping(self):
        tiny = 1e-10
        result = calculate_angle(pt(1, tiny), pt(0, 0), pt(1, -tiny))
        self.assertTrue(0.0 <= result <= 180.0)


# ============================================================================
# ALGORITHM 3: Form Score Calculation (Weighted Deviation Scoring)
# ============================================================================

class TestCalculateFormScore(unittest.TestCase):
    """Tests for exercise.algorithms.scoring.calculate_form_score()"""

    def test_single_reading_inside_range_is_perfect(self):
        score = calculate_form_score([75.0], ideal_min=60, ideal_max=90)
        self.assertEqual(score, 100.0)

    def test_reading_at_ideal_min_is_perfect(self):
        score = calculate_form_score([60.0], ideal_min=60, ideal_max=90)
        self.assertEqual(score, 100.0)

    def test_reading_below_ideal_min(self):
        score = calculate_form_score([45.0], ideal_min=60, ideal_max=90)
        self.assertEqual(score, 95.0)

    def test_mixed_readings_partial_score(self):
        score = calculate_form_score([75.0, 45.0, 90.0], ideal_min=60, ideal_max=90)
        expected = round(100.0 - (5.0 / 3), 1)
        self.assertEqual(score, expected)

    def test_empty_readings_returns_100(self):
        score = calculate_form_score([], ideal_min=60, ideal_max=90)
        self.assertEqual(score, 100.0)

    def test_zero_range_returns_100(self):
        score = calculate_form_score([75.0], ideal_min=80, ideal_max=80)
        self.assertEqual(score, 100.0)

    def test_score_never_negative(self):
        # range is 1, deviation is 50 -> penalty = (50/1)*10 = 500
        # raw score = 100 - 500 = -400 -> clamped to 0
        readings = [0.0] * 100
        score = calculate_form_score(readings, ideal_min=50, ideal_max=51)
        self.assertEqual(score, 0.0)


# ============================================================================
# ALGORITHM 4: Weighted Recommendation — Insertion Sort validation
# ============================================================================

class TestInsertionSort(unittest.TestCase):
    def test_already_sorted_descending(self):
        items = [{'score': 90}, {'score': 70}, {'score': 50}]
        result = _insertion_sort_descending(items)
        self.assertEqual([i['score'] for i in result], [90, 70, 50])

    def test_reverse_sorted_ascending(self):
        items = [{'score': 10}, {'score': 30}, {'score': 80}]
        result = _insertion_sort_descending(items)
        self.assertEqual([i['score'] for i in result], [80, 30, 10])

    def test_empty_list(self):
        self.assertEqual(_insertion_sort_descending([]), [])

    def test_stable_equal_scores(self):
        items = [
            {'score': 50, 'name': 'A'},
            {'score': 50, 'name': 'B'},
            {'score': 50, 'name': 'C'},
        ]
        result = _insertion_sort_descending(items)
        self.assertEqual([i['name'] for i in result], ['A', 'B', 'C'])


class TestScoreExercise(unittest.TestCase):
    def _make_exercise(self, age_groups_allowed=None, goal_tags=None,
                       difficulty='Intermediate', high_impact=False,
                       angle_ranges=None):
        class FakeExercise:
            pass
        ex = FakeExercise()
        ex.age_groups_allowed = age_groups_allowed or []
        ex.goal_tags = goal_tags or []
        ex.difficulty = difficulty
        ex.high_impact = high_impact
        ex.angle_ranges = angle_ranges or {}
        return ex

    def test_perfect_match_all_criteria(self):
        ex = self._make_exercise(
            age_groups_allowed=['26-40'],
            goal_tags=['weight_loss'],
            difficulty='Intermediate',
            angle_ranges={'26-40': {'bottom_min': 60}}
        )
        score = _score_exercise(ex, '26-40', 'weight_loss', 22.0)
        self.assertEqual(score, 110)

    def test_age_band_mismatch_no_base_points(self):
        ex = self._make_exercise(
            age_groups_allowed=['18-25'],
            goal_tags=['weight_loss'],
        )
        score = _score_exercise(ex, '60+', 'weight_loss', 22.0)
        self.assertEqual(score, 60)

    def test_high_impact_bmi_penalty(self):
        ex = self._make_exercise(
            age_groups_allowed=['26-40'],
            goal_tags=['weight_loss'],
            high_impact=True
        )
        score = _score_exercise(ex, '26-40', 'weight_loss', 35.0)
        self.assertEqual(score, 80)
