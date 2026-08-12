# PoseFit — Complete System Documentation

> **Version:** 1.0 · **Date:** August 2026 · **Stack:** Django REST Framework + React (TypeScript) + MediaPipe

This document is the single source of truth for the PoseFit backend architecture, all algorithms used, how they connect to the frontend, and a step-by-step guide for adding a new exercise to the system.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Backend Architecture](#2-backend-architecture)
   - [Directory Structure](#21-directory-structure)
   - [Django Apps](#22-django-apps)
3. [All Algorithms — Deep Dive](#3-all-algorithms--deep-dive)
   - [Algorithm 1 — Joint Angle Calculation (Vector Dot Product)](#algorithm-1--joint-angle-calculation-vector-dot-product)
   - [Algorithm 2 — EMA Smoothing (Exponential Moving Average)](#algorithm-2--ema-smoothing-exponential-moving-average)
   - [Algorithm 3 — Form Score Calculation (Weighted Deviation Scoring)](#algorithm-3--form-score-calculation-weighted-deviation-scoring)
   - [Algorithm 4 — Exercise Recommendation (Content-Based Filtering + Cosine Similarity)](#algorithm-4--exercise-recommendation-content-based-filtering--cosine-similarity)
   - [Algorithm 5 — Doctor Distance Ranking (Haversine Formula)](#algorithm-5--doctor-distance-ranking-haversine-formula)
4. [Backend File-by-File Breakdown](#4-backend-file-by-file-breakdown)
5. [API Endpoints Reference](#5-api-endpoints-reference)
6. [Frontend Connection & Data Flow](#6-frontend-connection--data-flow)
7. [How to Add a New Exercise — Step-by-Step Guide](#7-how-to-add-a-new-exercise--step-by-step-guide)

---

## 1. System Overview

PoseFit is a personalized, real-time exercise tracking platform. The system has three major responsibilities:

| Responsibility | Where it happens |
|---|---|
| **Pose detection** — identify body landmarks in webcam feed | Frontend (MediaPipe via CDN) |
| **Angle calculation + smoothing** | Frontend (`camera_mediapipe.ts`, `ema_smoothing.ts`) |
| **Rep counting / hold timing + form feedback** | Frontend (tracking modules: `curl_tracking.ts`, `tree_pose_tracking.ts`, etc.) |
| **Personalization** — which exercises to show, at what intensity | Backend (`exercise/services.py` + algorithms) |
| **Recommendation ranking** | Backend (`exercise/algorithms/recommendation.py`) |
| **Form score calculation** | Backend (`exercise/algorithms/scoring.py`) |
| **Doctor proximity** | Backend (`doctors/utils.py`) |
| **Session persistence** | Backend (`exercise/serializers.py` → `WorkoutSession` + `ExerciseLog` models) |

The core design principle is: **The frontend does all real-time computation (no network round-trips during tracking). The backend stores and personalises.**

---

## 2. Backend Architecture

### 2.1 Directory Structure

```
backend/
└── ex_backend/
    ├── manage.py
    ├── ex_backend/              ← Django project root (settings, main urls.py, wsgi)
    ├── accounts/                ← Auth: registration, JWT login
    │   ├── views.py             ← RegisterView, LoginView
    │   └── serializers.py
    ├── biometrics/              ← User health profile (age, weight, BMI, goal)
    │   ├── models.py            ← BiometricProfile, PosturalAssessment
    │   ├── views.py
    │   └── serializers.py
    ├── doctors/                 ← Doctor profiles, appointments, Haversine ranking
    │   ├── models.py            ← DoctorProfile, Availability, Appointment, Message
    │   ├── views.py             ← NearbyDoctorListView uses Haversine
    │   └── utils.py             ← haversine_distance(), get_coordinates()
    └── exercise/                ← Core exercise logic
        ├── models.py            ← Exercise, WorkoutSession, ExerciseLog
        ├── serializers.py       ← SessionSummarySerializer (calls Algorithm 3)
        ├── services.py          ← get_personalized_exercises() (calls Algorithm 4)
        ├── views.py             ← All exercise API views
        ├── urls.py
        ├── algorithms/
        │   ├── angle.py         ← Algorithm 1: Vector Dot Product
        │   ├── scoring.py       ← Algorithm 3: Weighted Deviation Scoring
        │   └── recommendation.py← Algorithm 4: Content-Based Filtering
        └── management/commands/
            └── seed_exercises.py← Populates the Exercise table with calibrated data
```

### 2.2 Django Apps

| App | Responsibility |
|---|---|
| `accounts` | User registration and JWT login. Supports email OR username login with case-insensitive lookup. |
| `biometrics` | Stores the `BiometricProfile` (age_group, weight_kg, height_cm, BMI, goal) and `PosturalAssessment` records. This data drives Algorithm 4. |
| `doctors` | Manages `DoctorProfile`, `Availability`, `Appointment`, and `Message` records. The `NearbyDoctorListView` uses Algorithm 5 (Haversine) to return sorted results. |
| `exercise` | The core app. Holds the exercise library, session logging, personalization pipeline, and all recommendation algorithms. |

---

## 3. All Algorithms — Deep Dive

### Algorithm 1 — Joint Angle Calculation (Vector Dot Product)

| Property | Value |
|---|---|
| **Name** | Joint Angle Calculation — Vector Dot Product |
| **Backend file** | `exercise/algorithms/angle.py` → `calculate_angle()` |
| **Frontend file** | `frontend/src/lib/camera_mediapipe.ts` → `calculateAngle()` |
| **Time complexity** | O(1) — fixed arithmetic, independent of input size |
| **Space complexity** | O(1) — only scalar variables |

#### Why this algorithm?

Given three points (A, B, C) where B is the joint vertex, we need the interior angle at B. There are two common approaches:

1. **atan2 (old approach):** Computes the angle of each individual ray, then subtracts. Can give inconsistent signs when the angle wraps past 180°.
2. **Vector Dot Product (used here):** Directly computes the cosine of the angle between the two vectors BA and BC. Always returns a value in **[0°, 180°]** with no wrap-around. Numerically stable because it clamps the cosine before calling `acos`.

#### Which attributes are used?

MediaPipe provides 33 landmark points per frame, each with `x`, `y`, `z`, and `visibility`. This algorithm uses only `x` and `y` (normalized 0.0–1.0 coordinates). Key landmarks:

| Landmark Index | Body Part | Used For |
|---|---|---|
| 11 | Left shoulder | Squat spine angle, curl arm |
| 12 | Right shoulder | Squat spine angle, curl arm |
| 13 | Left elbow | Bicep curl elbow angle |
| 14 | Right elbow | Bicep curl elbow angle |
| 15 | Left wrist | Bicep curl |
| 16 | Right wrist | Bicep curl |
| 23 | Left hip | Squat knee angle |
| 24 | Right hip | Squat knee angle |
| 25 | Left knee | Squat knee angle (VERTEX) |
| 26 | Right knee | Squat knee angle (VERTEX) |
| 27 | Left ankle | Squat knee angle |
| 28 | Right ankle | Squat knee angle |

#### Step-by-step formula

Given three points A, B (vertex), and C:

```
Step 1: BA = (A.x - B.x, A.y - B.y)          ← vector from B toward A
Step 2: BC = (C.x - B.x, C.y - B.y)          ← vector from B toward C
Step 3: dot = BA.x * BC.x + BA.y * BC.y       ← dot product = |BA||BC|cos(θ)
Step 4: |BA| = sqrt(BA.x² + BA.y²)            ← Euclidean magnitude
        |BC| = sqrt(BC.x² + BC.y²)
Step 5: if |BA| == 0 or |BC| == 0 → return 0  ← edge case: coincident points
Step 6: cos(θ) = dot / (|BA| * |BC|)
Step 7: clamp cos(θ) to [-1, 1]               ← prevents floating-point crash in acos
Step 8: θ_rad = acos(cos(θ))
Step 9: θ_deg = θ_rad × (180 / π)            ← result always in [0°, 180°]
```

#### Example (Squat knee angle)

For a standing user, the Hip→Knee→Ankle angle is approximately **170°**. As the user squats down, this angle decreases. For a 26-40 age user, a valid squat bottom is when the angle is between **60° and 90°**.

---

### Algorithm 2 — EMA Smoothing (Exponential Moving Average)

| Property | Value |
|---|---|
| **Name** | Exponential Moving Average (EMA) Smoothing |
| **Frontend file** | `frontend/src/lib/ema_smoothing.ts` → `ExponentialMovingAverage` class |
| **Applied in** | `camera_mediapipe.ts` → `buildFrameHandler()` |
| **Time complexity** | O(1) per call |
| **Space complexity** | O(k) where k = number of distinct joints tracked |

#### Why EMA and not a Simple Moving Average (SMA)?

| | SMA | EMA |
|---|---|---|
| Storage per joint | O(N) — stores last N raw readings | O(1) — stores only previous smoothed value |
| Time per call | O(N) — sums N values | O(1) — one multiply + one add |
| Recency bias | No — all readings weighted equally | Yes — recent frames weighted more |
| Correct for real-time? | No | **Yes** |

For real-time pose tracking, the current frame matters more than old history. EMA gives more weight to recent readings while still smoothing out per-frame jitter.

#### The Formula

```
smoothed[t] = alpha × raw[t] + (1 - alpha) × smoothed[t-1]
```

- **alpha = 0.3** (chosen empirically)
- At ~15fps: produces ~2-frame lag (2/15 ≈ 133ms)
- This is within ACSM's 200ms feedback window for effective form coaching
- First call for a joint: returns raw value directly (bootstrap — no previous to blend)

#### How alpha was chosen

| alpha value | Effect |
|---|---|
| 1.0 | No smoothing — raw value passes through |
| 0.3 (this system) | ~2-frame noise window eliminated, 133ms lag |
| → 0.0 | Infinite lag — output barely moves |

#### Which joints are smoothed?

The EMA instance (`alpha=0.3`) in `camera_mediapipe.ts` smooths these named joints:

| Joint name key | What it is |
|---|---|
| `'knee'` | Average knee angle for squat |
| `'spine'` | Spine angle for forward lean detection |
| `'elbow_left'` | Left elbow angle for bicep curl |
| `'elbow_right'` | Right elbow angle for bicep curl |
| `'trunk_left'` | Left trunk angle for body swing detection |
| `'trunk_right'` | Right trunk angle for body swing detection |

#### Where EMA feeds into

After smoothing, the values are passed to the `onResults` callback which is consumed by the exercise-specific tracking module (`curl_tracking.ts`, `tree_pose_tracking.ts`, etc.) for state machine evaluation.

The **EMA-smoothed angle readings are also collected per-frame** and sent to the backend inside `angle_readings[]` in the `POST /api/exercises/session/` payload. The backend then runs Algorithm 3 on this list to compute the form score.

---

### Algorithm 3 — Form Score Calculation (Weighted Deviation Scoring)

| Property | Value |
|---|---|
| **Name** | Weighted Deviation Scoring |
| **Backend file** | `exercise/algorithms/scoring.py` → `calculate_form_score()` |
| **Called from** | `exercise/serializers.py` → `SessionSummarySerializer.create()` |
| **Time complexity** | O(n) — single pass over angle_readings list |
| **Space complexity** | O(1) — scalar accumulators only |

#### Why this algorithm?

A simple boolean "inside range / outside range" would not distinguish between a minor 3° deviation and a severe 40° deviation. Weighted deviation scoring converts raw angular error into a normalized **0–100 score** where the **penalty is proportional to the deviation relative to the ideal range width**. This is clinically meaningful: a 10° error out of a 30° range is penalised more than a 10° error out of a 60° range.

#### Which attributes are used?

- `angle_readings`: List of EMA-smoothed joint angles (one per frame, collected during the live session)
- `ideal_min` / `ideal_max`: The `bottom_min` and `bottom_max` from `Exercise.angle_ranges[user_age_band]` (for squats) or `peak_min` / `peak_max` (for curls)

#### Step-by-step formula

```
Step 1: n = len(angle_readings)
        if n == 0: return 100.0        ← no data = no penalty
        ideal_range = ideal_max - ideal_min
        if ideal_range <= 0: return 100.0   ← undefined range

Step 2: total_penalty = 0.0

Step 3: for each angle in angle_readings:
            if ideal_min <= angle <= ideal_max:
                penalty = 0.0           ← inside range: no penalty
            elif angle < ideal_min:
                deviation = ideal_min - angle
                penalty = (deviation / ideal_range) × 10.0
            else:
                deviation = angle - ideal_max
                penalty = (deviation / ideal_range) × 10.0
            total_penalty += penalty

Step 4: average_penalty = total_penalty / n

Step 5: raw_score = 100.0 - average_penalty

Step 6: return clamp(raw_score, 0.0, 100.0)  ← never below 0
```

#### Example

Ideal squat range for age 26-40: `bottom_min=60°, bottom_max=90°` → `ideal_range=30°`

- Frame reads 75° → inside range → penalty = 0
- Frame reads 45° → below min → deviation = 60-45 = 15° → penalty = (15/30)×10 = **5.0**
- Frame reads 110° → above max → deviation = 110-90 = 20° → penalty = (20/30)×10 = **6.67**

If a 30-second session has average penalty of 2.5 → **score = 100 - 2.5 = 97.5**

#### Where it's stored

`form_score` is saved inside `WorkoutSession.metadata['form_score']` and can be viewed in the dashboard history or doctor review.

---

### Algorithm 4 — Exercise Recommendation (Content-Based Filtering + Cosine Similarity)

| Property | Value |
|---|---|
| **Name** | Content-Based Filtering — Cosine Similarity + Insertion Sort |
| **Backend file** | `exercise/algorithms/recommendation.py` |
| **Entry point** | `rank_exercises_by_suitability(exercises, profile)` |
| **Called from** | `exercise/services.py` → `get_personalized_exercises()` |

This system recommends exercises based on the **features of the exercises themselves** matched against the **features of the user**. It works with zero other users and no interaction history.

#### Three sub-algorithms inside this file

**4a. Feature Vector Encoding (`extract_exercise_vector`, `extract_user_vector`)**

Both user and each exercise are encoded into a **7-dimensional numeric vector**:

| Dimension | Exercise vector | User vector |
|---|---|---|
| 0 | `1.0` if `'weight_loss'` in goal_tags, else `0.0` | `1.0` if user's goal == `'weight_loss'`, else `0.0` |
| 1 | `1.0` if `'weight_gain'` in goal_tags, else `0.0` | `1.0` if user's goal == `'weight_gain'`, else `0.0` |
| 2 | `1.0` if `'flexibility'` in goal_tags, else `0.0` | `1.0` if user's goal == `'flexibility'`, else `0.0` |
| 3 | `1.0` if `'stay_active'` in goal_tags, else `0.0` | `1.0` if user's goal == `'stay_active'`, else `0.0` |
| 4 | Age band encoded: `18-25→1.0`, `26-40→2.0`, `41-60→3.0`, `60+→4.0` | Same encoding for user's age group |
| 5 | `difficulty_score / 5.0` (Beginner=0.2, Intermediate=0.4, Advanced=0.6) | Age-appropriate difficulty / 5.0 |
| 6 | `1.0` if `high_impact=True`, else `0.0` | `0.0` if BMI > 30 (intolerant), else `1.0` |

**4b. Cosine Similarity (`calculate_cosine_similarity`)**

```
cosine_similarity(User, Exercise) = (User · Exercise) / (|User| × |Exercise|)
```

- Returns value in [-1.0, 1.0] (higher = better match)
- **Returns 0.0** if either vector has zero magnitude (avoids division by zero)
- Scaled to [0, 100] for the final score: `score = max(0, sim × 100)`

**4c. Ranking — Insertion Sort (`_insertion_sort_descending`)**

Custom insertion sort chosen deliberately (not Python's built-in `sorted()`) to meet algorithmic implementation requirements:

- Sorts the `[{exercise, score}]` list in-place, descending by score
- Time complexity: O(n²) worst case (acceptable for small exercise libraries, typically < 20 items)

#### Execution flow

```
1. get_personalized_exercises(user) called
2. BiometricProfile fetched → age_band, goal, bmi extracted
3. goal text normalized → canonical tag (e.g. "lose weight" → "weight_loss")
4. ALL exercises fetched from DB: Exercise.objects.all()
5. For each exercise:
     a. extract_exercise_vector(exercise, age_band)
     b. calculate_cosine_similarity(user_vector, exercise_vector) → [0, 100]
6. _insertion_sort_descending(scored_list)
7. Filter: only exercises with score > 0 are returned
8. Each exercise is personalized (_personalize()) with age-specific thresholds
```

#### Which `Exercise` model attributes are read?

| Attribute | Used in | Purpose |
|---|---|---|
| `goal_tags` | Dimensions 0–3 of exercise vector | Goal alignment |
| `age_groups_allowed` | Dimension 4 (0.0 if band not allowed) | Age appropriateness |
| `difficulty` | Dimension 5 | Difficulty matching |
| `high_impact` | Dimension 6 | BMI safety penalty |
| `angle_ranges` | `_personalize()` | Per-age thresholds for rep counting |
| `rep_config` | `_personalize()` | Per-age sets/reps/rest |
| `voice_cues` | `_personalize()` | Per-age coaching text |

---

### Algorithm 5 — Doctor Distance Ranking (Haversine Formula)

| Property | Value |
|---|---|
| **Name** | Haversine Formula — Great Circle Distance |
| **Backend file** | `doctors/utils.py` → `haversine_distance()` |
| **Called from** | `doctors/views.py` → `NearbyDoctorListView.get()` |
| **Time complexity** | O(1) per doctor pair — fixed trigonometric operations |
| **Space complexity** | O(1) |

#### Why Haversine?

The Earth is a sphere, not a flat plane. Using simple Euclidean distance on latitude/longitude coordinates would be inaccurate because:
- 1 degree of latitude ≈ 111 km (constant)
- 1 degree of longitude varies from 111 km (equator) to 0 km (poles)

The **Haversine formula** computes the **great-circle distance** (shortest path along the Earth's surface) between two latitude/longitude points, correctly accounting for the Earth's curvature.

#### Which attributes are used?

- **User's GPS:** `lat` and `lng` query parameters sent from the frontend (browser `navigator.geolocation`)
- **Doctor's stored location:** `DoctorProfile.latitude` and `DoctorProfile.longitude` (stored in DB, geocoded from their address using OpenStreetMap Nominatim)

#### Step-by-step formula

```
Input: (lat1, lon1) = user's location
       (lat2, lon2) = doctor's location

Step 1: Convert all 4 values from decimal degrees to radians
        (multiply by π/180)

Step 2: dlon = lon2 - lon1    (longitude difference)
        dlat = lat2 - lat1    (latitude difference)

Step 3: a = sin(dlat/2)² + cos(lat1) × cos(lat2) × sin(dlon/2)²

Step 4: c = 2 × asin(√a)     (central angle in radians)

Step 5: distance = c × R     where R = 6371 km (Earth's radius)
        Returns distance in kilometers
```

#### Where it's used

`NearbyDoctorListView.get()` in `doctors/views.py`:

1. Frontend sends `GET /api/doctors/nearby/?lat=&lng=`
2. Backend fetches all doctors with non-null coordinates
3. Calls `haversine_distance(user_lat, user_lng, doc.latitude, doc.longitude)` for each doctor
4. Sorts the list using Python's built-in `.sort(key=lambda x: x[0])` ascending
5. Returns the top `limit` (default 10) nearest doctors with `distanceKm` in the response

---

## 4. Backend File-by-File Breakdown

### `accounts/views.py`

**Purpose:** Authentication — user registration and JWT login.

**Why this file exists:** Django's built-in auth doesn't support email login or JWT tokens out of the box. This file adds that.

**What happens here:**

- `RegisterView` — Creates a new `User` object. No token is returned here (security: force explicit login after register).
- `LoginView` — Extends simplejwt's `TokenObtainPairView`:
  1. Normalizes the username input to lowercase
  2. Tries `email` lookup first, then `username` lookup (supports both)
  3. Injects the actual DB username into the request before simplejwt validates
  4. Returns `access` + `refresh` JWT tokens + user data in one response

**Frontend connection:** `frontend/src/services/authService.ts` calls `POST /api/auth/login/` and stores the returned tokens in `localStorage`.

---

### `biometrics/models.py`

**Purpose:** Stores the user's health profile (`BiometricProfile`) and postural scan results (`PosturalAssessment`).

**Key fields on `BiometricProfile`:**

| Field | Type | Used by Algorithm |
|---|---|---|
| `age_group` | `CharField` (e.g. `"26-40"`) | Algorithm 4 (user vector dimension 4) |
| `goal` | `CharField` (e.g. `"weight_loss"`) | Algorithm 4 (user vector dimensions 0–3) |
| `bmi` | `DecimalField` | Algorithm 4 (user vector dimension 6) |
| `weight_kg` | `DecimalField` | Displayed in dashboard |
| `height_cm` | `DecimalField` | Used to calculate BMI |

**Why needed:** Without `BiometricProfile`, the recommendation algorithm falls back to defaults (`age_band='26-40'`, `goal='general'`, `bmi=25.0`).

---

### `exercise/models.py`

**Purpose:** Defines the three core data models for the exercise system.

**`Exercise` model — key fields:**

| Field | Type | Why it exists |
|---|---|---|
| `name` | CharField unique | Exercise identifier |
| `muscle_group` | CharField | Used as `workout_type` in session |
| `goal_tags` | JSONField (list) | Algorithm 4 vector dimensions 0–3 |
| `age_groups_allowed` | JSONField (list) | Algorithm 4 vector dimension 4 |
| `high_impact` | BooleanField | Algorithm 4 vector dimension 6 |
| `angle_ranges` | JSONField (dict) | Per-age thresholds for rep counting |
| `rep_config` | JSONField (dict) | Per-age sets/reps or hold config |
| `voice_cues` | JSONField (dict) | Per-age coaching cue text |
| `voice_cue_audio` | JSONField (dict) | Pre-rendered TTS audio URLs |

**`WorkoutSession` model:** One row per completed exercise session. Contains `duration_minutes`, `workout_type`, and a `metadata` JSON blob that includes `form_score`, `form_errors`, and per-arm rep counts.

**`ExerciseLog` model:** One row per exercise inside a session. Stores `reps`, `duration_seconds`, and links back to both `WorkoutSession` and `Exercise`.

---

### `exercise/algorithms/angle.py`

**Purpose:** Provides the `calculate_angle(point_a, point_b, point_c)` function — the backend's server-side implementation of Algorithm 1.

**Why it also exists in the backend:** The backend may receive raw angle data for score calculation or re-validation. The frontend and backend implementations are identical (same formula, different language).

**Connection to frontend:** The frontend's `calculateAngle()` in `camera_mediapipe.ts` is a TypeScript port of this exact function. Both produce identical results for identical inputs.

---

### `exercise/algorithms/scoring.py`

**Purpose:** Provides `calculate_form_score(angle_readings, ideal_min, ideal_max)` — Algorithm 3.

**When it's called:** At session end, when the frontend sends `POST /api/exercises/session/`. The serializer extracts `angle_readings[]` from the payload and passes them here.

**Why it's on the backend:** Form score is a persistent analytics metric. It must be calculated server-side and stored in `WorkoutSession.metadata` so doctors can review it.

---

### `exercise/algorithms/recommendation.py`

**Purpose:** Contains all of Algorithm 4 — feature vector extraction, cosine similarity, and insertion sort ranking.

**Public function:** `rank_exercises_by_suitability(exercises, profile)` — takes a list of Exercise ORM objects and a BiometricProfile, returns a sorted scored list.

**Why it's in `algorithms/` not `services.py`:** Separation of concerns. The algorithm logic is pure math (no Django ORM calls). `services.py` is responsible for the database queries and calling the algorithm with the results.

---

### `exercise/services.py`

**Purpose:** The personalization pipeline — the brain of the exercise system. Crosses app boundaries (reads `biometrics` data to personalize `exercise` data).

**Three public functions:**

| Function | What it does |
|---|---|
| `get_personalized_exercises(user)` | Fetches all exercises → runs Algorithm 4 → personalizes each result for user's age band |
| `get_personalized_exercise_detail(user, exercise_id)` | Same but for a single exercise by ID |
| `_personalize(user, exercise, band, goal_tag)` | Private helper — selects correct angle thresholds, rep config, voice cues, TTS audio, and cue priority order for `band` |

**Voice cue priority logic inside `_personalize()`:**

- **Squat/default:** `insufficient_depth` → `excessive_depth` → `forward_lean` → `knee_tracking`
- **Bicep Curl:** `body_swing` (P1 safety) → `elbow_swing` → `shoulder_elevation` → `insufficient_curl` → `incomplete_extension`
- **Tree Pose:** `trunk_sway` (P1 safety) → `hip_unlevel` → `knee_bent` → `foot_too_low` → `arms_asymmetric` → `forward_head`
- **Butterfly Pose:** `spine_rounded` (P1 lumbar safety) → `shoulders_raised` → `head_dropped` → `knees_too_high` → `feet_apart`

The priority order changes dynamically if the user's `PosturalAssessment` has flagged deviations (e.g., `forward_head` or `rounded_shoulders` elevates the relevant cue to P2).

---

### `exercise/serializers.py`

**Purpose:** Data validation and session creation at the `POST /api/exercises/session/` endpoint.

**`SessionSummarySerializer.create()`:** This is where Algorithm 3 is invoked:
1. Receives `angle_readings[]` from frontend payload
2. Looks up the exercise's `angle_ranges` for the user's band
3. Calls `calculate_form_score(angle_readings, ideal_min, ideal_max)`
4. Stores result in `WorkoutSession.metadata['form_score']`

**`HoldSessionSummarySerializer.create()`:** For static hold exercises (Tree Pose, Butterfly):
- Records `left_leg_hold_duration_seconds` and `right_leg_hold_duration_seconds`
- Stores `left_leg_success = hold >= target` flags in metadata
- Duration stored in `ExerciseLog.duration_seconds` = minimum of both legs (conservative)

---

### `exercise/views.py`

**Purpose:** Thin HTTP layer — delegates to services/serializers.

| View class | Route | What it does |
|---|---|---|
| `PersonalizedExerciseListView` | `GET /api/exercises/` | Calls `get_personalized_exercises(user)` |
| `PersonalizedExerciseDetailView` | `GET /api/exercises/<id>/` | Calls `get_personalized_exercise_detail(user, pk)` |
| `SessionSummaryCreateView` | `POST /api/exercises/session/` | Validates and saves rep-based session |
| `HoldSessionSummaryCreateView` | `POST /api/exercises/session/hold/` | Validates and saves static hold session |
| `WorkoutSessionListView` | `GET /api/exercises/sessions/` | Returns last 10 sessions for history |
| `DynamicTTSView` | `GET /api/exercises/tts/?text=` | Synthesizes voice cue audio on-the-fly using gTTS |

---

### `exercise/management/commands/seed_exercises.py`

**Purpose:** A Django management command that populates the `Exercise` table with real, biomechanically-calibrated data.

**How to run:**
```bash
python manage.py seed_exercises           # Add/update exercises
python manage.py seed_exercises --clear   # Delete all existing exercises first
```

**What it seeds:** Currently 4 exercises (Squat, Dumbbell Bicep Curl, Tree Pose, Butterfly Pose) with full calibration for all 4 age bands. Each exercise includes `angle_ranges`, `rep_config`, `voice_cues`, `goal_tags`, and `age_groups_allowed`.

**Key design:** Uses `update_or_create(name=data['name'], defaults=...)` so running the command multiple times is safe — it updates existing exercises rather than creating duplicates.

---

### `doctors/utils.py`

**Purpose:** Two standalone utility functions for the doctor search feature.

- `get_coordinates(address)` — Geocodes a text address to (lat, lng) using the free OpenStreetMap Nominatim API. Used when a doctor profile is created/updated in the admin.
- `haversine_distance(lat1, lon1, lat2, lon2)` — Algorithm 5. Returns distance in km.

**Why pure Python:** No external geocoding or geography libraries needed. `math` is sufficient for the Haversine formula.

---

## 5. API Endpoints Reference

### Auth (`/api/auth/`)

| Method | URL | Description |
|---|---|---|
| POST | `/api/auth/register/` | Create account |
| POST | `/api/auth/login/` | Get JWT tokens + user |
| POST | `/api/auth/token/refresh/` | Refresh access token |

### Exercises (`/api/exercises/`)

| Method | URL | Description |
|---|---|---|
| GET | `/api/exercises/` | Personalized exercise list (Algorithm 4) |
| GET | `/api/exercises/<id>/` | Single personalized exercise |
| POST | `/api/exercises/session/` | Save rep-based session (calls Algorithm 3) |
| POST | `/api/exercises/session/hold/` | Save static hold session |
| GET | `/api/exercises/sessions/` | Workout history (last 10) |
| GET | `/api/exercises/tts/?text=<str>` | Synthesize TTS audio clip |

### Doctors (`/api/doctors/`)

| Method | URL | Description |
|---|---|---|
| GET | `/api/doctors/nearby/?lat=&lng=` | Doctors sorted by Haversine distance |
| GET | `/api/doctors/<id>/availability/?date=` | Available time slots |
| POST | `/api/doctors/<id>/book/` | Book appointment |
| GET | `/api/doctors/<id>/messages/` | Message thread |
| POST | `/api/doctors/<id>/messages/` | Send message |

### Biometrics (`/api/biometrics/`)

| Method | URL | Description |
|---|---|---|
| GET/POST | `/api/biometrics/profile/` | Get or create biometric profile |
| PATCH | `/api/biometrics/profile/` | Update profile |

---

## 6. Frontend Connection & Data Flow

### Full Data Flow Diagram

```
User opens exercise page
        │
        ▼
exerciseService.getExercises()
  → GET /api/exercises/
        │
        ▼
Backend: get_personalized_exercises(user)
  → Algorithm 4 (Cosine Similarity Recommendation)
  → _personalize() → per-age thresholds + voice cues
        │
        ▼
Frontend receives Exercise[] with full `personalization` block:
  {
    angle_ranges: { standing_threshold, bottom_min, bottom_max, ... },
    rep_config: { sets, reps, rest_seconds },
    voice_cues: { insufficient_depth: "...", ... },
    voice_cue_priority: ["body_swing", "elbow_swing", ...],
    pose_type: "rep_based" | "static_hold"
  }
        │
        ▼
User starts session → camera opens
  initializeCamera() in camera_mediapipe.ts
        │
        ▼
MediaPipe Pose runs on each frame (~15-30fps)
  buildFrameHandler():
    1. Extract landmarks[11-28] from results
    2. calculateAngle() for all joints → Algorithm 1
    3. ema.smooth() for each joint → Algorithm 2
    4. Fire onResults({ knee_angle, elbow_angle_left, ... })
        │
        ▼
Exercise-specific tracking module processes results:
  ┌─ Squat      → squat state machine (not shown separately)
  ├─ Bicep Curl → curl_tracking.ts
  ├─ Tree Pose  → tree_pose_tracking.ts
  └─ Butterfly  → butterfly_pose_tracking.ts
  
  These modules:
    • Detect rep completion / hold timer
    • Collect angle_readings[] per frame (EMA-smoothed)
    • Detect form errors → trigger voice cues (cueAudio.ts)
        │
        ▼
Session ends → user clicks "Finish"
        │
        ▼
exerciseService.submitSessionSummary({
  exercise_id, reps_completed, duration_seconds,
  form_errors, angle_readings    ← sent for Algorithm 3
})
  → POST /api/exercises/session/
        │
        ▼
Backend: SessionSummarySerializer.create()
  → Algorithm 3: calculate_form_score(angle_readings, ideal_min, ideal_max)
  → WorkoutSession created with form_score in metadata
  → ExerciseLog created
        │
        ▼
Frontend: Summary page shown to user
```

### Key Frontend Files

| File | Purpose | Connects to Backend via |
|---|---|---|
| `src/lib/camera_mediapipe.ts` | MediaPipe setup, Algorithm 1 & 2, landmark drawing | Does not call API directly |
| `src/lib/ema_smoothing.ts` | Algorithm 2 — EMA class | No API calls |
| `src/lib/curl_tracking.ts` | Bicep curl state machine + rep counter | No API during session |
| `src/lib/tree_pose_tracking.ts` | Tree Pose hold timer + form checker | No API during session |
| `src/lib/butterfly_pose_tracking.ts` | Butterfly Pose hold timer | No API during session |
| `src/lib/cueAudio.ts` | Voice cue playback (audio file or Web Speech fallback) | `GET /api/exercises/tts/` |
| `src/services/exerciseService.ts` | Typed API calls for all exercise endpoints | All exercise endpoints |
| `src/services/authService.ts` | Login / register / token refresh | `/api/auth/` |
| `src/services/doctorService.ts` | Doctor search, booking, messaging | `/api/doctors/` |

---

## 7. How to Add a New Exercise — Step-by-Step Guide

This section walks through **exactly** what you need to do to add a completely new exercise to PoseFit — for example, adding "Push-Up".

> **Checklist-style guide — complete every step in order.**

---

### Step 1: Decide your exercise's properties

Before you write any code, answer these questions:

| Question | Example answer (Push-Up) |
|---|---|
| What is the exercise name? | `"Push-Up"` |
| What muscle group? | `"Chest"` |
| What difficulty? | `"Beginner"` |
| Which goals does it serve? | `["weight_gain", "weight_loss", "general", "stay_active"]` |
| Which age bands is it safe for? | `["18-25", "26-40", "41-60"]` |
| Is it high impact (jumping, HIIT)? | `False` |
| Is it **rep-based** or **static hold**? | Rep-based |
| Which joint angle are you tracking? | Elbow angle (Shoulder→Elbow→Wrist) → same as curl |
| What are the ideal angle ranges per age band? | (calibrate from biomechanics literature) |
| What are the form error types? | `elbow_flare`, `hip_drop`, `insufficient_depth`, `bar_too_high` |

---

### Step 2: Add the exercise to `seed_exercises.py`

**File:** `backend/ex_backend/exercise/management/commands/seed_exercises.py`

Add a new dict entry to the `EXERCISES` list. Follow the exact same structure as the existing exercises:

```python
{
    "name": "Push-Up",
    "muscle_group": "Chest",
    "difficulty": "Beginner",
    "image_url": "/images/push_up.png",   # You'll add this image in Step 6
    "description": "A fundamental bodyweight compound exercise...",
    "goal_tags": ["weight_gain", "weight_loss", "general", "stay_active"],
    "age_groups_allowed": ["18-25", "26-40", "41-60"],
    "high_impact": False,

    # Elbow angle: Shoulder→Elbow→Wrist
    # At top position (arms extended) ≈ 160-170°
    # At bottom (chest near ground) ≈ 70-90° depending on body type
    "angle_ranges": {
        "18-25": {
            "extended_threshold": 155,  # must pass this going up to reset
            "peak_max": 75,             # valid bottom reached when angle < 75°
            "peak_min": 50,             # below 50° = going too deep
            "min_peak_frames": 3,       # must hold for 3 frames
        },
        "26-40": {
            "extended_threshold": 150,
            "peak_max": 80,
            "peak_min": 55,
            "min_peak_frames": 3,
        },
        "41-60": {
            "extended_threshold": 145,
            "peak_max": 90,
            "peak_min": 60,
            "min_peak_frames": 3,
        },
    },

    "rep_config": {
        "18-25": {"sets": 4, "reps": 20, "rest_seconds": 45},
        "26-40": {"sets": 3, "reps": 15, "rest_seconds": 60},
        "41-60": {"sets": 3, "reps": 10, "rest_seconds": 75},
    },

    "voice_cues": {
        "18-25": {
            "elbow_flare":         "Tuck your elbows in — keep them at 45 degrees.",
            "hip_drop":            "Keep your core tight — your hips are sagging.",
            "insufficient_depth":  "Go lower — chest should nearly touch the floor.",
        },
        "26-40": {
            "elbow_flare":         "Keep your elbows tucked close to your body.",
            "hip_drop":            "Engage your core and keep your hips level.",
            "insufficient_depth":  "Try to lower a little further for a full rep.",
        },
        "41-60": {
            "elbow_flare":         "Gently bring your elbows closer to your sides.",
            "hip_drop":            "Try to keep your body in a straight line.",
            "insufficient_depth":  "Try to lower a little more if it feels safe.",
        },
    },
},
```

**Run the command** to apply this to the database:
```bash
cd backend/ex_backend
python manage.py seed_exercises
```

You should see: `Created: Push-Up` (or `Updated:` if it already exists).

---

### Step 3: Add the exercise image

Place your image file in:
```
frontend/public/images/push_up.png
```

The `image_url` field value in Step 2 (`"/images/push_up.png"`) resolves to this public folder. The frontend `<img src={exercise.image_url} />` will load it automatically.

---

### Step 4: Create a frontend tracking module

**File:** `frontend/src/lib/push_up_tracking.ts` *(create this new file)*

The tracking module is the frontend state machine that:
1. Receives the EMA-smoothed angles from `camera_mediapipe.ts` each frame
2. Runs the rep-counting state machine
3. Detects form errors and triggers voice cues
4. Accumulates `angle_readings[]` for the form score

Copy the structure of `curl_tracking.ts` as a template (since push-up uses elbow angle like curl). Key functions to implement:

```typescript
/**
 * push_up_tracking.ts
 * State machine for Push-Up rep counting.
 */

export interface PushUpState {
  repCount: number;
  phase: 'up' | 'descending' | 'bottom' | 'ascending';
  formErrors: { error_type: string; count: number }[];
  angleReadings: number[];
}

export function initPushUpState(): PushUpState {
  return {
    repCount: 0,
    phase: 'up',
    formErrors: [],
    angleReadings: [],
  };
}

/**
 * Called once per frame with the latest angle data.
 * Returns updated state + any cue to fire.
 */
export function processPushUpFrame(
  state: PushUpState,
  elbowAngle: number | null,      // from camera_mediapipe.ts onResults.elbow_angle_left
  thresholds: any,                 // exercise.personalization.angle_ranges from API
  voiceCues: any,                  // exercise.personalization.voice_cues from API
): { state: PushUpState; cueKey: string | null } {
  if (elbowAngle === null) return { state, cueKey: null };

  // Collect angle for form score (Algorithm 3)
  state.angleReadings.push(elbowAngle);

  const { extended_threshold, peak_max, min_peak_frames } = thresholds;
  let cueKey: string | null = null;

  // State machine
  if (state.phase === 'up' && elbowAngle < extended_threshold) {
    state.phase = 'descending';
  } else if (state.phase === 'descending' && elbowAngle <= peak_max) {
    state.phase = 'bottom';
  } else if (state.phase === 'bottom' && elbowAngle > peak_max) {
    state.repCount += 1;
    state.phase = 'ascending';
  } else if (state.phase === 'ascending' && elbowAngle >= extended_threshold) {
    state.phase = 'up';
  }

  return { state, cueKey };
}
```

---

### Step 5: Wire the tracking module into the exercise player page

**File:** `frontend/src/pages/ExercisePage.tsx` (or whatever page handles live tracking)

In the `onResults` callback (which receives data from `camera_mediapipe.ts`):

```typescript
// Detect exercise type from the exercise object returned by the API
import { processPushUpFrame, initPushUpState } from '@/lib/push_up_tracking';

// In component:
const [pushUpState, setPushUpState] = useState(initPushUpState());

// In the onResults handler:
if (exercise.name.toLowerCase().includes('push-up')) {
  const { state: newState, cueKey } = processPushUpFrame(
    pushUpState,
    results.elbow_angle_left,       // or right, pick dominant arm
    exercise.personalization.angle_ranges,
    exercise.personalization.voice_cues,
  );
  setPushUpState(newState);
  if (cueKey) triggerCue(cueKey);
}
```

---

### Step 6: Update `exerciseService.ts` if needed

**File:** `frontend/src/services/exerciseService.ts`

If your new exercise introduces new angle range fields not already in `AngleRange` or `RepConfig`, add them to the TypeScript interfaces:

```typescript
export interface PushUpAngleRange {
  extended_threshold: number;
  peak_max: number;
  peak_min: number;
  min_peak_frames: number;
}

// Add to AngleRange union:
export type AngleRange = SquatAngleRange & Partial<CurlAngleRange> & Partial<PushUpAngleRange>;
```

Also make sure `isStaticHoldExercise()` still correctly returns `false` for push-ups (it should — the check is by name/pose_type).

---

### Step 7: Submit session data to the backend

At the end of the session, call the existing API endpoint (no backend change needed):

```typescript
await exerciseService.submitSessionSummary({
  exercise_id: exercise.id,
  reps_completed: pushUpState.repCount,
  duration_seconds: sessionDuration,
  form_errors: pushUpState.formErrors,
  angle_readings: pushUpState.angleReadings,  // Algorithm 3 will score these
});
```

The backend will automatically:
- Calculate form score using Algorithm 3 with the push-up's `peak_min`/`peak_max` thresholds
- Save a `WorkoutSession` + `ExerciseLog`
- The workout history page will show it immediately

---

### Step 8: Verify end-to-end

1. **Backend:** `python manage.py seed_exercises` → confirms `Push-Up` appears
2. **API:** `GET /api/exercises/` → Push-Up appears in the response with correct `personalization`
3. **Frontend:** Exercise card appears on the exercise list page (if cosine similarity > 0 for your test user's profile)
4. **Tracking:** Open the live session → camera activates → reps count correctly → form errors trigger voice cues
5. **Session end:** `POST /api/exercises/session/` returns `session_id` → workout history shows the session

---

### Summary: Files changed when adding a new exercise

| File | What you do |
|---|---|
| `seed_exercises.py` | Add data dict (angle_ranges, rep_config, voice_cues, goal_tags) |
| `frontend/public/images/` | Add the exercise image |
| `frontend/src/lib/push_up_tracking.ts` | **NEW** — tracking state machine |
| `frontend/src/pages/ExercisePage.tsx` | Wire new tracking module into onResults |
| `frontend/src/services/exerciseService.ts` | Add new angle range types if needed |

> **You do NOT need to change:** `models.py`, `views.py`, `serializers.py`, `recommendation.py`, `scoring.py`, or `angle.py`. The backend is data-driven — all the intelligence is in the `seed_exercises.py` data.

---

---

## 8. Full CRUD Operations — Every View Explained

This section lists every HTTP view in the system, what database operation it executes, what the serializer validates/transforms, and which HTTP status code is returned.

---

### 8.1 `accounts` App — Authentication

#### `RegisterView` → `POST /api/auth/register/`

| Stage | Detail |
|---|---|
| **Serializer** | `RegisterSerializer` |
| **DB operation** | `CREATE` — `User.objects.create_user(...)` |
| **Validation** | Email uniqueness (via `UniqueValidator`), password match, `PasswordStrengthValidator` |
| **Special logic** | `password_confirm` is popped before saving — never stored |
| **On success** | HTTP `201 Created` + serialized user (no token — user must login separately) |
| **On failure** | HTTP `400 Bad Request` + field-level errors |

**Request body:**
```json
{
  "username": "priti",
  "email": "priti@gmail.com",
  "password": "Str0ng#Pass",
  "password_confirm": "Str0ng#Pass",
  "first_name": "Priti",
  "last_name": "Paudel"
}
```

**Response (201):**
```json
{
  "user": {
    "id": 5,
    "username": "priti",
    "email": "priti@gmail.com",
    "first_name": "Priti",
    "last_name": "Paudel",
    "onboarding_complete": false,
    "isAdmin": false
  },
  "message": "User created successfully. Please log in to get your token."
}
```

`onboarding_complete` is a `SerializerMethodField` — it reads `user.biometric_profile.onboarding_complete`. Since no `BiometricProfile` exists yet, it returns `false`.

---

#### `LoginView` → `POST /api/auth/login/`

| Stage | Detail |
|---|---|
| **Serializer** | simplejwt `TokenObtainPairSerializer` + `UserSerializer` |
| **DB operation** | `READ` — `User.objects.get(email__iexact=...)` then `User.objects.get(username__iexact=...)` |
| **Validation** | Credentials validated by Django's `authenticate()` inside simplejwt |
| **On success** | HTTP `200 OK` + access token + refresh token + user object |
| **On failure** | HTTP `401 Unauthorized` |

**Response (200):**
```json
{
  "access":  "eyJ0eXAiOiJKV1Qi...",
  "refresh": "eyJ0eXAiOiJKV1Qi...",
  "user": {
    "id": 5,
    "username": "priti",
    "email": "priti@gmail.com",
    "first_name": "Priti",
    "onboarding_complete": true,
    "isAdmin": false
  }
}
```

The `access` token is stored in `localStorage` by `authService.ts` and sent as `Authorization: Bearer <token>` on every subsequent API call.

---

### 8.2 `biometrics` App — Health Profile

All routes protected by `IsAuthenticated`. The profile is auto-created on `GET` if it doesn't exist yet (`get_or_create`).

#### `ProfileUpdateView` → `GET /api/biometrics/profile/`

| Stage | Detail |
|---|---|
| **DB operation** | `READ` — `BiometricProfile.objects.get_or_create(user=request.user)` |
| **Serializer** | `BiometricProfileSerializer` |
| **On success** | HTTP `200 OK` + profile JSON |

**Response (200):**
```json
{
  "age_group": "26-40",
  "sex": "female",
  "height": "165.00",
  "weight": "60.00",
  "bmi": "22.0",
  "goal": "weight_loss",
  "onboarding_complete": true
}
```

> `bmi` is `read_only` — it is never accepted from the client. The serializer's `validate()` method calculates it automatically when both `height` and `weight` are provided.

---

#### `ProfileUpdateView` → `PATCH /api/biometrics/profile/`

| Stage | Detail |
|---|---|
| **DB operation** | `UPDATE` — `profile.save()` via serializer |
| **Serializer** | `BiometricProfileSerializer(partial=True)` |
| **Special logic** | BMI is auto-calculated if both `height` + `weight` are in the same request |
| **On success** | HTTP `200 OK` + updated profile |
| **On failure** | HTTP `400 Bad Request` |

The `partial=True` flag means the frontend can send only the fields being changed during onboarding (e.g., send only `goal` on the goal step, only `age_group` and `sex` on the demographics step).

---

#### `ProfileUpdateView` → `DELETE /api/biometrics/profile/`

| Stage | Detail |
|---|---|
| **DB operation** | `DELETE` — `profile.delete()` |
| **On success** | HTTP `204 No Content` (empty body) |
| **On failure** | HTTP `404 Not Found` |

---

#### `PoseAssessmentIngestView` → `POST /api/biometrics/assessment/`

| Stage | Detail |
|---|---|
| **DB operation** | `CREATE` — `PosturalAssessment.objects.create(...)` |
| **Serializer** | `PosturalAssessmentSerializer` |
| **Validation** | `profile.privacy_consent_timestamp` must be set — if user has not consented, `400` is returned |
| **What is saved** | Base64 image, raw 33 MediaPipe landmarks, computed joint angles dict, deviation flags dict |
| **On success** | HTTP `201 Created` |

**Request body (abbreviated):**
```json
{
  "image": "data:image/png;base64,iVBOR...",
  "raw_landmarks": [ {"x": 0.51, "y": 0.23, "z": -0.01, "visibility": 0.99}, ... ],
  "joint_angles": { "right_knee": 172, "left_knee": 175, "right_hip": 168 },
  "deviations": { "forward_head": true, "rounded_shoulders": false }
}
```

The `deviations` dict is later read by `exercise/services.py → _personalize()` to adjust voice cue priority orders.

---

### 8.3 `exercise` App — Exercise Library & Sessions

#### `PersonalizedExerciseListView` → `GET /api/exercises/`

| Stage | Detail |
|---|---|
| **DB operation** | `READ ALL` — `Exercise.objects.all()` then Algorithm 4 ranking |
| **Serializer** | `PersonalizedExerciseSerializer` |
| **Special logic** | Calls `get_personalized_exercises(user)` → Algorithm 4 → `_personalize()` |
| **On success** | HTTP `200 OK` + ordered list of personalized exercises |
| **Filtering** | Only exercises with `cosine_similarity > 0` are included |

**Response (abbreviated, 200):**
```json
[
  {
    "id": 1,
    "name": "Squat",
    "muscle_group": "Legs",
    "difficulty": "Beginner",
    "image_url": "/images/squat.png",
    "description": "A fundamental compound lower-body exercise...",
    "goal_tags": ["weight_loss", "weight_gain", "general", "stay_active"],
    "personalization": {
      "age_band": "26-40",
      "goal": "weight_loss",
      "angle_ranges": {
        "standing_threshold": 150,
        "bottom_min": 60,
        "bottom_max": 90,
        "too_deep_threshold": 50,
        "min_bottom_frames": 3
      },
      "rep_config": { "sets": 3, "reps": 12, "rest_seconds": 60 },
      "voice_cues": {
        "insufficient_depth": "Sink a little lower — aim to reach parallel.",
        "excessive_depth": "That's past your target depth — control the bottom.",
        "forward_lean": "Keep your chest lifted and your spine tall.",
        "knee_tracking": "Check your knees — track them out over your feet."
      },
      "voice_cue_priority": ["insufficient_depth", "excessive_depth", "forward_lean", "knee_tracking"],
      "cue_cooldown_seconds": 8
    }
  }
]
```

---

#### `PersonalizedExerciseDetailView` → `GET /api/exercises/<id>/`

| Stage | Detail |
|---|---|
| **DB operation** | `READ ONE` — `Exercise.objects.get(pk=exercise_id)` |
| **Serializer** | `PersonalizedExerciseSerializer` |
| **On success** | HTTP `200 OK` + single personalized exercise |
| **On failure** | HTTP `404 Not Found` |

Used when the user taps a specific exercise card to open the preview page before starting the live session.

---

#### `SessionSummaryCreateView` → `POST /api/exercises/session/`

| Stage | Detail |
|---|---|
| **DB operation** | `CREATE` — `WorkoutSession.objects.create(...)` + `ExerciseLog.objects.create(...)` |
| **Serializer** | `SessionSummarySerializer` |
| **Algorithm called** | Algorithm 3 — `calculate_form_score(angle_readings, ideal_min, ideal_max)` |
| **On success** | HTTP `201 Created` + session summary |
| **On failure** | HTTP `400 Bad Request` |

**Request body:**
```json
{
  "exercise_id": 1,
  "reps_completed": 12,
  "duration_seconds": 95,
  "form_errors": [
    { "error_type": "forward_lean", "count": 3, "timestamp": "2026-08-11T10:30:00Z" }
  ],
  "angle_readings": [168.2, 160.4, 150.1, 88.3, 65.2, 61.0, 72.4, 89.1, 145.2, 170.0],
  "goal_context": "weight_loss"
}
```

**What the serializer does with this:**
1. Fetches `Exercise` from DB using `exercise_id`
2. Reads `angle_ranges` from the exercise to get `ideal_min=60`, `ideal_max=90`
3. Calls `calculate_form_score([...], 60, 90)` → e.g. `97.4`
4. Builds `metadata` dict with `form_score=97.4`, `form_errors`, `source='live_tracking'`
5. Creates `WorkoutSession` (duration_minutes = max(1, 95//60) = 1)
6. Creates `ExerciseLog` (reps=12, duration_seconds=95)

**Response (201):**
```json
{
  "session_id": 42,
  "exercise": "Squat",
  "reps_completed": 12,
  "duration_seconds": 95
}
```

---

#### `HoldSessionSummaryCreateView` → `POST /api/exercises/session/hold/`

| Stage | Detail |
|---|---|
| **DB operation** | `CREATE` — `WorkoutSession.objects.create(...)` + `ExerciseLog.objects.create(...)` |
| **Serializer** | `HoldSessionSummarySerializer` |
| **On success** | HTTP `201 Created` |

**Request body:**
```json
{
  "exercise_id": 3,
  "left_leg_hold_duration_seconds": 42.5,
  "right_leg_hold_duration_seconds": 38.1,
  "target_hold_duration_seconds": 45.0,
  "form_errors_triggered": [
    { "error_type": "trunk_sway", "count": 2, "leg": "right" }
  ],
  "goal_context": "flexibility",
  "age_group": "26-40"
}
```

**Metadata stored in `WorkoutSession`:**
```json
{
  "source": "live_tracking",
  "pose_type": "static_hold",
  "left_leg_hold_seconds": 42.5,
  "right_leg_hold_seconds": 38.1,
  "target_hold_seconds": 45.0,
  "left_leg_success": false,
  "right_leg_success": false,
  "form_errors": [...],
  "goal_context": "flexibility",
  "age_group": "26-40"
}
```

`ExerciseLog.duration_seconds` = `min(42.5, 38.1)` = **38** — stores the weaker leg (conservative metric).

---

#### `WorkoutSessionListView` → `GET /api/exercises/sessions/`

| Stage | Detail |
|---|---|
| **DB operation** | `READ (filtered)` — `WorkoutSession.objects.filter(user=request.user).order_by('-created_at')[:10]` |
| **Serializer** | `WorkoutSessionSerializer` |
| **Special methods** | `get_exercise_name()` — reads `session.exercise_logs.first().exercise.name` (cross-model) |
| **On success** | HTTP `200 OK` + list of last 10 sessions |

---

#### `DynamicTTSView` → `GET /api/exercises/tts/?text=<str>`

| Stage | Detail |
|---|---|
| **DB operation** | None — file system only |
| **Logic** | SHA-256 hashes the text → checks if `.mp3` already exists → if not, creates it with gTTS → serves file |
| **Permission** | `AllowAny` — no authentication needed |
| **On success** | HTTP `200 OK` + `audio/mpeg` binary stream |

This allows the frontend to play voice cues as audio files without requiring the user to have browser speech synthesis available.

---

### 8.4 `doctors` App — Doctor Search, Booking, Messaging

#### `NearbyDoctorListView` → `GET /api/doctors/nearby/?lat=&lng=`

| Stage | Detail |
|---|---|
| **DB operation** | `READ (filtered)` — `DoctorProfile.objects.filter(latitude__isnull=False, longitude__isnull=False)` |
| **Algorithm** | Algorithm 5 — `haversine_distance()` per doctor, then Python `.sort()` |
| **Serializer** | `DoctorProfileSerializer` |
| **Extra field** | `distanceKm` appended to each result after serialization |
| **On success** | HTTP `200 OK` + sorted doctor list |

---

#### `DoctorProfileSerializer` — Special: Auto-Geocoding on CREATE/UPDATE

When an admin creates or updates a `DoctorProfile`, the **serializer's `validate()` method** automatically calls `get_coordinates(address)` (OpenStreetMap Nominatim API) to resolve `latitude` and `longitude`. These are then stored on the model. This is why `latitude` and `longitude` are `read_only` — they are never accepted directly from the client, only derived from the address.

---

#### `BookAppointmentView` → `POST /api/doctors/<id>/book/`

| Stage | Detail |
|---|---|
| **DB operation** | `CREATE` — `Appointment.objects.create(...)` + `UPDATE` — `slot.is_booked = True` |
| **Serializer** | `AppointmentSerializer` |
| **Special logic** | `create()` marks the `Availability` slot as booked (prevents double-booking) |
| **On success** | HTTP `201 Created` + appointment with nested `doctor_detail` |

---

#### `DoctorMessageView` → `POST /api/doctors/<id>/messages/`

| Stage | Detail |
|---|---|
| **DB operation** | `CREATE` x2 — user message + auto-generated doctor reply |
| **Serializer** | `MessageSerializer` |
| **Special logic** | After saving the user's message, a random simulated doctor reply is created immediately (`is_from_doctor=True`) |
| **On success** | HTTP `201 Created` + the user's message object |

---

## 9. Data Transformation Pipeline — DB → JSON → Frontend UI

This section traces **exactly** how data flows from a raw database row through the API into a rendered React UI element, for each major feature.

---

### 9.1 Exercise List Page — Full Trace

```
DATABASE (PostgreSQL)
┌─────────────────────────────────────────────────────────────────┐
│ exercise_exercise table                                          │
│ id=1, name="Squat", muscle_group="Legs",                        │
│ difficulty="Beginner", image_url="/images/squat.png",           │
│ goal_tags=["weight_loss","weight_gain","general","stay_active"], │
│ age_groups_allowed=["18-25","26-40","41-60","60+"],             │
│ angle_ranges={ "26-40": { bottom_min:60, bottom_max:90, ... }}, │
│ rep_config={ "26-40": { sets:3, reps:12, rest_seconds:60 }},    │
│ voice_cues={ "26-40": { insufficient_depth: "Sink lower..." }}  │
└─────────────────────────────────────────────────────────────────┘
        │
        │  Exercise.objects.all() — Python ORM object
        ▼
ALGORITHM LAYER (recommendation.py)
  extract_exercise_vector(exercise, "26-40") → [0, 1, 0, 1, 2.0, 0.2, 0.0]
  extract_user_vector("26-40", "weight_loss", 22.0) → [1, 0, 0, 0, 2.0, 0.4, 1.0]
  cosine_similarity(user_vec, ex_vec) → 0.76
  score = 0.76 × 100 = 76.0
        │
        │  _personalize(user, exercise, "26-40", "weight_loss")
        ▼
SERVICES LAYER — Python dict built in memory:
  {
    "id": 1,
    "name": "Squat",
    "muscle_group": "Legs",
    "difficulty": "Beginner",
    "image_url": "/images/squat.png",
    "goal_tags": ["weight_loss", ...],
    "personalization": {
      "age_band": "26-40",
      "goal": "weight_loss",
      "angle_ranges": { "standing_threshold": 150, "bottom_min": 60, ... },
      "rep_config": { "sets": 3, "reps": 12, "rest_seconds": 60 },
      "voice_cues": { "insufficient_depth": "Sink a little lower...", ... },
      "voice_cue_priority": ["insufficient_depth", "excessive_depth", ...],
      "cue_cooldown_seconds": 8
    }
  }
        │
        │  PersonalizedExerciseSerializer(data).data
        ▼
JSON RESPONSE (HTTP 200)
  [
    {
      "id": 1,
      "name": "Squat",
      "muscle_group": "Legs",
      "difficulty": "Beginner",
      "image_url": "/images/squat.png",
      "description": "...",
      "goal_tags": [...],
      "personalization": { ... }
    }
  ]
        │
        │  exerciseService.getExercises() → normaliseExercise(raw)
        │  adds: muscleGroup = raw.muscle_group, imageUrl = raw.image_url
        ▼
REACT STATE (ExerciseSelectionPage.tsx)
  const [exercises, setExercises] = useState<Exercise[]>([]);
  // After API call: exercises = [{ id:1, name:"Squat", muscleGroup:"Legs",
  //                                imageUrl:"/images/squat.png", ... }]
        │
        │  filteredExercises.map((exercise) => ...)
        ▼
RENDERED UI ELEMENT
  <Card>
    <img src={exercise.imageUrl} alt={exercise.name} />      ← "/images/squat.png"
    <span>{exercise.difficulty}</span>                         ← "Beginner"
    <h3>{exercise.name}</h3>                                   ← "Squat"
    <span>{exercise.muscleGroup}</span>                        ← "Legs"
    <button>Start →</button>                                   ← navigates to /exercises/1
  </Card>
```

---

### 9.2 Live Session — Angle → Voice Cue Trace

```
MEDIAIPE POSE MODEL (runs in browser)
  Outputs 33 landmarks: [{ x: 0.51, y: 0.63, z: -0.02, visibility: 0.98 }, ...]
        │
        │  camera_mediapipe.ts → buildFrameHandler()
        │  landmark[24]=right_hip, [26]=right_knee, [28]=right_ankle
        ▼
ALGORITHM 1: calculateAngle(right_hip, right_knee, right_ankle)
  → raw angle = 87.3°
        │
        │  ema.smooth('knee', 87.3)
        ▼
ALGORITHM 2: EMA smoothing
  → smoothed angle = 0.3 × 87.3 + 0.7 × 92.1 = 90.66°
        │
        │  onResults({ knee_angle: 90.66, ... }) fired
        ▼
SQUAT TRACKING MODULE (curl_tracking.ts or similar)
  State machine:
    phase = "bottom"
    angle (90.66) > bottom_max (90) → "excessive_depth" error detected
        │
        │  cue priority order: ["insufficient_depth", "excessive_depth", ...]
        │  "excessive_depth" is priority 2 — fires after cooldown check
        ▼
cueAudio.ts → triggerCue("excessive_depth")
  1. Check preRenderedAudio["excessive_depth"] exists?
     → YES: play audio file from /media/voice_cues/<hash>.mp3 via HTMLAudioElement
     → NO:  use Web Speech API: speechSynthesis.speak("That's past your target depth...")
        │
        │  angle pushed to angleReadings[] for form score
        ▼
UI ELEMENT (ActiveWorkoutPage.tsx)
  <RepCounter count={repCount} />                    ← increments when rep complete
  <AngleBadge angle={90.66} color="amber" />         ← drawn at knee landmark on canvas
  <FeedbackBanner text="EXCESSIVE DEPTH" />          ← shown 3s then auto-hides
  Canvas overlay: full skeleton drawn in white,      ← drawConnectors()
                  elbow/knee angles shown in circles ← drawAngleLabel()
```

---

### 9.3 Session Save — POST to DB Trace

```
SESSION ENDS — user clicks "Finish"
        │
        │  exerciseService.submitSessionSummary({...})
        ▼
HTTP POST /api/exercises/session/
  Body:
    { exercise_id:1, reps_completed:12, duration_seconds:95,
      form_errors:[{error_type:"forward_lean", count:3}],
      angle_readings:[168.2, 160.1, 88.3, 65.2, 61.0, 87.4, 150.1, 170.0] }
        │
        │  SessionSummarySerializer.is_valid()
        │    - validates exercise_id exists
        │    - validates reps_completed >= 0
        │    - validates duration_seconds >= 0
        ▼
ALGORITHM 3: calculate_form_score([168.2,...,170.0], 60, 90)
  ideal_range = 90 - 60 = 30
  frame 168.2 → deviation = 168.2 - 90 = 78.2 → penalty = (78.2/30)×10 = 26.1
  frame  88.3 → inside [60,90] → penalty = 0
  frame  65.2 → inside [60,90] → penalty = 0
  frame  61.0 → inside [60,90] → penalty = 0
  average_penalty ≈ 3.7
  form_score = 100 - 3.7 = 96.3
        │
        ▼
DATABASE WRITES
┌──────────────────────────────────────────────────────┐
│ exercise_workoutsession table                        │
│  id=42, user_id=5, title="Squat Session",            │
│  workout_type="Legs", duration_minutes=1,            │
│  metadata={                                          │
│    "form_score": 96.3,                               │
│    "form_errors": [{error_type:"forward_lean",...}], │
│    "source": "live_tracking",                        │
│    "angle_readings_count": 8                         │
│  }                                                   │
├──────────────────────────────────────────────────────┤
│ exercise_exerciselog table                           │
│  id=67, session_id=42, exercise_id=1,               │
│  sets=1, reps=12, duration_seconds=95               │
└──────────────────────────────────────────────────────┘
        │
        │  HTTP 201
        ▼
FRONTEND: navigate to /sessions/42/summary
  <SessionSummaryPage>
    <h2>Squat Complete!</h2>
    <StatCard label="Reps"     value={12} />
    <StatCard label="Duration" value="1m 35s" />
    <StatCard label="Form Score" value="96.3 / 100" />
    <ErrorList errors={[{error_type:"forward_lean", count:3}]} />
  </SessionSummaryPage>
```

---

### 9.4 Nearby Doctor List — Haversine Trace

```
FRONTEND (doctorService.ts)
  navigator.geolocation.getCurrentPosition(pos => {
    doctorService.getNearbyDoctors(pos.coords.latitude, pos.coords.longitude)
  })
  → GET /api/doctors/nearby/?lat=27.7172&lng=85.3240
        │
        ▼
DATABASE READ
  DoctorProfile.objects.filter(latitude__isnull=False, longitude__isnull=False)
  → returns all doctors with GPS coordinates
        │
        │  for each doctor:
        ▼
ALGORITHM 5: haversine_distance(27.7172, 85.3240, doc.latitude, doc.longitude)
  dlon = 85.3100 - 85.3240 = -0.0140 rad
  dlat = 27.7050 - 27.7172 = -0.0122 rad
  a    = sin(-0.0061)² + cos(27.7172°) × cos(27.7050°) × sin(-0.0070)²
       = 0.0000372 + 0.886 × 0.886 × 0.0000490
       ≈ 0.0000757
  c    = 2 × asin(√0.0000757) ≈ 0.01739 rad
  dist = 0.01739 × 6371 ≈ 1.108 km
        │
        │  doctors_with_distance.sort(key=lambda x: x[0])
        │  DoctorProfileSerializer(nearest_doctors, many=True)
        │  item['distanceKm'] = round(dist, 2)  ← appended AFTER serialization
        ▼
JSON RESPONSE (200)
  [
    {
      "id": 3,
      "name": "Dr. Sita Sharma",
      "specialty": "Physiotherapist",
      "rating": "4.80",
      "hospital": "Patan Hospital",
      "is_available": true,
      "distanceKm": 1.11
    },
    ...
  ]
        │
        ▼
REACT UI ELEMENT (DoctorCard component)
  <Card>
    <img src={doctor.image_url} />
    <h3>Dr. Sita Sharma</h3>
    <span>Physiotherapist</span>
    <span>⭐ 4.80</span>
    <span>📍 1.11 km away</span>
    <button>Book Appointment</button>
  </Card>
```

---

### 9.5 Biometric Profile Save — Onboarding Step Trace

```
ONBOARDING STEP 3: User enters height 165cm, weight 60kg
FRONTEND (onboarding page)
  biometricService.updateProfile({ height: 165, weight: 60 })
  → PATCH /api/biometrics/profile/
        │
        ▼
BiometricProfileSerializer(profile, data={height:165, weight:60}, partial=True)
  validate():
    height_cm = 165, weight_kg = 60
    height_m = 1.65
    bmi = round(60 / 1.65², 1) = round(60 / 2.7225, 1) = 22.0
    data['bmi'] = 22.0    ← injected by serializer, NOT sent by client
  save():
    UPDATE biometrics_biometricprofile
    SET height=165, weight=60, bmi=22.0
    WHERE user_id=5
        │
        ▼
JSON RESPONSE (200)
  {
    "age_group": "26-40",
    "height": "165.00",
    "weight": "60.00",
    "bmi": "22.0",       ← calculated server-side and returned
    "goal": "weight_loss",
    "onboarding_complete": false
  }
        │
        ▼
ALGORITHM 4 IMPACT (next time exercises are fetched):
  extract_user_vector("26-40", "weight_loss", 22.0)
    → bmi=22.0 < 30 → bmi_impact_tolerance = 1.0  (can do high-impact)
    → full feature vector: [1, 0, 0, 0, 2.0, 0.4, 1.0]
  Exercises with high_impact=True will now score higher for this user.
```

---

### 9.6 Summary: Serializer Roles at Each Layer

| Serializer | Layer role | Key transforms |
|---|---|---|
| `RegisterSerializer` | Input validation + DB write | Validates email uniqueness, hashes password, pops `password_confirm` |
| `UserSerializer` | Output shaping | Adds computed `onboarding_complete` via `SerializerMethodField` |
| `BiometricProfileSerializer` | Input validation + DB write | Auto-calculates BMI from height/weight, enforces `bmi` is read-only |
| `PosturalAssessmentSerializer` | Input gate | Blocks save if privacy consent not recorded |
| `PersonalizedExerciseSerializer` | Output shaping | Serializes in-memory dict (not a model) — passes personalization block as-is |
| `SessionSummarySerializer` | Input validation + computation + DB write | Calls Algorithm 3, builds metadata, creates 2 DB rows |
| `HoldSessionSummarySerializer` | Input validation + DB write | Calculates `min(left, right)` for ExerciseLog, records success flags |
| `WorkoutSessionSerializer` | Output shaping | Adds computed `exercise_name` and `reps` via `SerializerMethodField` (cross-model read) |
| `DoctorProfileSerializer` | Input validation + geocoding + DB write | Auto-geocodes `address` → `latitude/longitude` via OpenStreetMap |
| `AppointmentSerializer` | Input validation + DB write (x2) | Sets `user` from request, marks `Availability.is_booked = True` |
| `MessageSerializer` | Input validation + DB write | Sets `sender` from request context |
| `AvailabilitySerializer` | Output shaping | Adds `formatted_time` (e.g. "09:00 AM - 09:30 AM") via `SerializerMethodField` |

---

*End of PoseFit System Documentation*

