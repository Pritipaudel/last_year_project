"""
exercise/algorithms/angle.py

Algorithm 1: Joint Angle Calculation using the Vector Dot Product Formula.

NAME: Joint Angle Calculation (Vector Dot Product)
LOCATION: exercise/algorithms/angle.py :: calculate_angle()

TIME COMPLEXITY:  O(1)  — fixed number of arithmetic operations regardless of input size.
SPACE COMPLEXITY: O(1)  — no data structures allocated; only scalar variables used.

WHY THIS ALGORITHM:
    The dot product formula is mathematically correct and numerically stable for
    angles between 0° and 180°. The atan2 alternative (used in the old frontend
    code) can give inconsistent results when points are collinear. The dot-product
    formula explicitly handles the degenerate case (zero-length vectors) and clamps
    the cosine value to [-1, 1] to guard against floating-point drift that would
    cause math.acos to raise ValueError.

LINE-BY-LINE EXPLANATION (for viva):
    1. Build vector BA = A - B  and vector BC = C - B.
       These are the two arms of the angle we are measuring, both
       originating at the vertex B (the joint).
    2. Compute the dot product: dot = BAx*BCx + BAy*BCy
       The dot product equals |BA||BC|cos(θ) by definition.
    3. Compute the magnitude of each vector: sqrt(x² + y²).
    4. If either vector has zero length (landmark coincides with vertex),
       return 0.0 to avoid division by zero — this is the edge case.
    5. Compute cosine = dot / (|BA| * |BC|).
    6. Clamp cosine to [-1, 1] to correct for floating-point drift
       (e.g. 1.0000000002 would crash math.acos).
    7. angle_radians = math.acos(clamped_cosine)
    8. Convert to degrees: angle = angle_radians * 180 / math.pi
    9. Return angle in degrees — always in [0, 180].

UNIT TESTS (see exercise/tests/test_algorithms.py):
    calculate_angle({x:0,y:1}, {x:0,y:0}, {x:1,y:0}) == 90.0   (right angle)
    calculate_angle({x:0,y:1}, {x:0,y:0}, {x:0,y:-1}) == 180.0 (straight line)
    calculate_angle({x:1,y:1}, {x:0,y:0}, {x:1,y:0}) == 45.0   (diagonal)
"""

import math


def calculate_angle(point_a: dict, point_b: dict, point_c: dict) -> float:
    """
    Calculate the interior angle (in degrees) at point_b, formed by the
    triangle point_a -- point_b -- point_c.

    Args:
        point_a: dict with 'x' and 'y' keys (MediaPipe normalised coords 0.0–1.0)
        point_b: dict with 'x' and 'y' keys — the VERTEX (joint being measured)
        point_c: dict with 'x' and 'y' keys

    Returns:
        Angle in degrees at point_b, in the range [0.0, 180.0].
        Returns 0.0 if either vector has zero length (coincident points).

    Time complexity:  O(1)
    Space complexity: O(1)
    """
    # Step 1: Form vector BA (from vertex B toward point A)
    ba_x = point_a['x'] - point_b['x']
    ba_y = point_a['y'] - point_b['y']

    # Step 2: Form vector BC (from vertex B toward point C)
    bc_x = point_c['x'] - point_b['x']
    bc_y = point_c['y'] - point_b['y']

    # Step 3: Dot product of BA and BC
    # dot(BA, BC) = BAx*BCx + BAy*BCy
    # Geometrically: dot = |BA| * |BC| * cos(angle)
    dot_product = ba_x * bc_x + ba_y * bc_y

    # Step 4: Magnitude of each vector  (Euclidean norm: sqrt(x² + y²))
    magnitude_ba = math.sqrt(ba_x ** 2 + ba_y ** 2)
    magnitude_bc = math.sqrt(bc_x ** 2 + bc_y ** 2)

    # Step 5: Edge case — zero-length vector means two landmarks coincide.
    # Division by zero would occur; return 0.0 as a safe default.
    if magnitude_ba == 0.0 or magnitude_bc == 0.0:
        return 0.0

    # Step 6: Cosine of the angle = dot / (|BA| * |BC|)
    cosine_angle = dot_product / (magnitude_ba * magnitude_bc)

    # Step 7: Clamp to [-1, 1] to handle floating-point drift.
    # Without clamping, values like 1.0000000002 would crash math.acos.
    cosine_angle = max(-1.0, min(1.0, cosine_angle))

    # Step 8: Inverse cosine gives the angle in radians
    angle_radians = math.acos(cosine_angle)

    # Step 9: Convert to degrees and return
    angle_degrees = angle_radians * (180.0 / math.pi)
    return round(angle_degrees, 4)
