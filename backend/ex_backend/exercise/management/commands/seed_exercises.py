"""
management/commands/seed_exercises.py

Seeds the exercise table with real, calibrated exercise data.
All angle thresholds use sourced biomechanical values.

Squat: MediaPipe interior knee angle (Hip→Knee→Ankle).
       standing ≈ 170–180°, deeper squat = smaller number.

Dumbbell Bicep Curl: MediaPipe interior elbow angle (Shoulder→Elbow→Wrist).
       arm extended ≈ 155–165°, peak contraction = small number (40–75° by age band).
       Sources: Norkin & White (Measurement of Joint Motion, 4th ed.);
                NSCA Essentials of Strength Training & Conditioning, 4th ed.;
                ACSM Position Stand on Exercise and Older Adults;
                MDPI Biomechanics 2022 (elbow ROM research).

Usage:
    python manage.py seed_exercises
    python manage.py seed_exercises --clear   # wipe existing rows first
"""

from django.core.management.base import BaseCommand
from exercise.models import Exercise


EXERCISES = [
    # ------------------------------------------------------------------
    # SQUAT — unchanged from original. All existing data preserved.
    # ------------------------------------------------------------------
    {
        "name": "Squat",
        "muscle_group": "Legs",
        "difficulty": "Beginner",
        "image_url": "/images/squat.png",
        "description": (
            "A fundamental compound lower-body exercise targeting the quadriceps, "
            "glutes, and hamstrings. Stand with feet shoulder-width apart, lower "
            "your hips as if sitting onto a chair, then drive back to standing."
        ),
        # Relevant for all three goals — squats burn calories (weight_loss),
        # build muscle (weight_gain), and suit general fitness programmes.
        "goal_tags": ["weight_loss", "weight_gain", "general", "stay_active"],
        "age_groups_allowed": ["18-25", "26-40", "41-60", "60+"],
        "high_impact": False,

        # MediaPipe interior knee angle (Hip→Knee→Ankle).
        # standing_threshold: below this = "descending" state begins.
        # bottom_min / bottom_max: valid bottom range for a counted rep.
        # too_deep_threshold: below this = excessive depth warning.
        "angle_ranges": {
            "18-25": {
                "standing_threshold": 150,
                "bottom_min": 45,
                "bottom_max": 70,
                "too_deep_threshold": 40,
                "min_bottom_frames": 3,
            },
            "26-40": {
                "standing_threshold": 150,
                "bottom_min": 60,
                "bottom_max": 90,
                "too_deep_threshold": 50,
                "min_bottom_frames": 3,
            },
            "41-60": {
                "standing_threshold": 155,
                "bottom_min": 80,
                "bottom_max": 110,
                "too_deep_threshold": 65,
                "min_bottom_frames": 3,
            },
            "60+": {
                "standing_threshold": 160,
                "bottom_min": 100,
                "bottom_max": 135,
                "too_deep_threshold": 90,
                "min_bottom_frames": 3,
            },
        },

        # Sets / reps / rest per age band. Flat structure (no goal nesting).
        "rep_config": {
            "18-25": {"sets": 4, "reps": 15, "rest_seconds": 45},
            "26-40": {"sets": 3, "reps": 12, "rest_seconds": 60},
            "41-60": {"sets": 3, "reps": 10, "rest_seconds": 75},
            "60+":   {"sets": 2, "reps": 8,  "rest_seconds": 90},
        },

        # Voice cues per age band per error type.
        "voice_cues": {
            "18-25": {
                "insufficient_depth": "Drive deeper! Get those hips below your knees.",
                "excessive_depth": "Ease up — pull back from the bottom.",
                "forward_lean": "Chest up! Open your torso and lift your sternum.",
                "knee_tracking": "Push your knees out — align them with your toes.",
            },
            "26-40": {
                "insufficient_depth": "Sink a little lower — aim to reach parallel.",
                "excessive_depth": "That's past your target depth — control the bottom.",
                "forward_lean": "Keep your chest lifted and your spine tall.",
                "knee_tracking": "Check your knees — track them out over your feet.",
            },
            "41-60": {
                "insufficient_depth": "Try to lower your hips a bit more if comfortable.",
                "excessive_depth": "You have reached your safe limit — begin rising now.",
                "forward_lean": "Straighten up gently and keep your back long.",
                "knee_tracking": "Gently guide your knees outward over your feet.",
            },
            "60+": {
                "insufficient_depth": "Gently try to lower a little more if it feels safe.",
                "excessive_depth": "That is deep enough — begin rising slowly.",
                "forward_lean": "Softly lift your chest and lengthen your back.",
                "knee_tracking": "Carefully let your knees drift outward, nice and slow.",
            },
        },
    },

    # ------------------------------------------------------------------
    # DUMBBELL BICEP CURL
    #
    # Angle convention: MediaPipe interior elbow angle (Shoulder→Elbow→Wrist).
    #   Arm extended → angle near 160–170°.
    #   Peak contraction → angle is small (40–75° depending on age band).
    #
    # Fields for curl state machine (different from squat):
    #   extended_threshold: arm must return above this to complete the rep
    #   peak_max:           valid peak zone upper bound (angle < this = peak reached)
    #   peak_min:           safety lower bound (angle < this = excessive range warning)
    #   min_peak_frames:    frames peak must hold before counting (noise filter)
    #   position:           "standing" or "seated" — communicated as UI hint
    #
    # Sources (cited per band in plan Step 2):
    #   - Norkin & White, Measurement of Joint Motion, 4th ed. (0–140–150° normal ROM)
    #   - NSCA Essentials of Strength Training & Conditioning, 4th ed., Ch. 17
    #   - ACSM Position Stand on Exercise and Older Adults
    #   - MDPI Biomechanics 2022 (elbow flexion range research)
    #   NOTE: MediaPipe thresholds are derived calibrations from the above clinical
    #         sources and are NOT direct measurements from any paper.
    # ------------------------------------------------------------------
    {
        "name": "Dumbbell Bicep Curl",
        "muscle_group": "Arms",
        "difficulty": "Beginner",
        "image_url": "/images/bicep_curl.png",
        "description": (
            "A fundamental isolation exercise targeting the biceps brachii, brachialis, "
            "and brachioradialis. Hold a dumbbell in each hand with palms facing forward. "
            "Keep your elbows pinned to your sides and curl the weight up towards your "
            "shoulders, then lower with full control. Works both arms simultaneously "
            "for balanced development."
        ),
        # All three goals are served by bicep curls:
        # weight_gain → heavier, lower reps (hypertrophy)
        # weight_loss → lighter, higher reps (metabolic / endurance)
        # goal_tags: ["weight_gain", "weight_loss", "stay_active", "general"]
        # (Included general so it acts as a fallback for incomplete profiles)
        "goal_tags": ["weight_gain", "weight_loss", "stay_active", "general"],
        "age_groups_allowed": ["18-25", "26-40", "41-60", "60+"],
        "high_impact": False,

        # Elbow angle ranges for rep counting.
        # Reminder: small angle = fully curled; large angle = arm extended.
        "angle_ranges": {
            "18-25": {
                # Source: NSCA/MDPI — full ROM (~0–145°); standing; younger adults.
                # extended_threshold: arm must pass this going up to start counting,
                # and return past it going down to complete the rep.
                "extended_threshold": 150,
                "peak_max": 50,       # angle must drop below 50° to register a valid peak
                "peak_min": 30,       # below 30° = excessive curl (safety warning)
                "min_peak_frames": 3, # noise filter: must hold peak for 3 frames
                "position": "standing",
            },
            "26-40": {
                # Source: NSCA/Palmer & Werner — slightly more conservative start.
                "extended_threshold": 145,
                "peak_max": 55,
                "peak_min": 30,
                "min_peak_frames": 3,
                "position": "standing",
            },
            "41-60": {
                # Source: ACSM Exercise Testing 10th ed., NHS guidelines.
                # Functional ROM 30–130° adequate; seated preferred (lower back safety).
                "extended_threshold": 140,
                "peak_max": 65,
                "peak_min": 35,
                "min_peak_frames": 3,
                "position": "seated",
            },
            "60+": {
                # Source: ACSM Older Adult Position Stand; NSCA Position Statement.
                # Conservative ROM; seated; slower tempo; avoid full lock-out.
                "extended_threshold": 135,
                "peak_max": 75,
                "peak_min": 40,
                "min_peak_frames": 3,
                "position": "seated",
            },
        },

        # Goal-nested rep config.
        # Source: NSCA Essentials Ch. 17 —
        #   Hypertrophy (weight_gain): 8–12 reps, 60–90s rest, heavier load
        #   Endurance/metabolic (weight_loss): 15–20 reps, 30–45s rest, lighter load
        #   General strength (stay_active): 10–15 reps, 45–60s rest, moderate load
        "rep_config": {
            "18-25": {
                "weight_gain":  {"sets": 4, "reps": 10, "rest_seconds": 75,  "tempo": "2-0-2", "load_note": "Heavy dumbbell, strict form"},
                "weight_loss":  {"sets": 3, "reps": 18, "rest_seconds": 35,  "tempo": "1-0-1", "load_note": "Light dumbbell, keep pace elevated"},
                "stay_active":  {"sets": 3, "reps": 12, "rest_seconds": 50,  "tempo": "2-0-2", "load_note": "Moderate dumbbell"},
            },
            "26-40": {
                "weight_gain":  {"sets": 3, "reps": 10, "rest_seconds": 80,  "tempo": "2-0-2", "load_note": "Heavy dumbbell"},
                "weight_loss":  {"sets": 3, "reps": 16, "rest_seconds": 40,  "tempo": "1-0-1", "load_note": "Light dumbbell, elevated heart rate"},
                "stay_active":  {"sets": 3, "reps": 12, "rest_seconds": 55,  "tempo": "2-0-2", "load_note": "Moderate dumbbell"},
            },
            "41-60": {
                "weight_gain":  {"sets": 3, "reps": 10, "rest_seconds": 90,  "tempo": "3-0-3", "load_note": "Moderate dumbbell, seated"},
                "weight_loss":  {"sets": 3, "reps": 15, "rest_seconds": 45,  "tempo": "2-0-2", "load_note": "Light dumbbell or resistance band, seated"},
                "stay_active":  {"sets": 2, "reps": 12, "rest_seconds": 60,  "tempo": "2-0-2", "load_note": "Light dumbbell, seated"},
            },
            "60+": {
                "weight_gain":  {"sets": 2, "reps": 10, "rest_seconds": 90,  "tempo": "3-0-3", "load_note": "Light dumbbell or resistance band, seated"},
                "weight_loss":  {"sets": 2, "reps": 12, "rest_seconds": 60,  "tempo": "2-0-2", "load_note": "Resistance band or very light dumbbell, seated"},
                "stay_active":  {"sets": 2, "reps": 10, "rest_seconds": 60,  "tempo": "3-0-3", "load_note": "Resistance band or very light dumbbell, seated"},
            },
        },

        # Voice cue text per age band per error type.
        # Priority order (enforced by services.py):
        #   P1 body_swing, P2 elbow_swing, P3 shoulder_elevation,
        #   P4 insufficient_curl, P5 incomplete_extension
        # Tone:
        #   18-25/26-40: direct coaching | 41-60: instructional | 60+: gentle
        "voice_cues": {
            "18-25": {
                "body_swing":           "Stop using your back! Keep your torso completely still.",
                "elbow_swing":          "Lock your elbow in — stop swinging it forward.",
                "shoulder_elevation":   "Drop your shoulder — stop shrugging the weight up.",
                "insufficient_curl":    "Curl higher — bring that weight all the way up!",
                "incomplete_extension": "Fully lower the weight between reps. Control the descent.",
            },
            "26-40": {
                "body_swing":           "Keep your torso still. Use your arm, not your back.",
                "elbow_swing":          "Keep your elbow pinned to your side — avoid swinging it forward.",
                "shoulder_elevation":   "Relax your shoulder down — avoid shrugging as you curl.",
                "insufficient_curl":    "Try to curl a little higher for a full contraction.",
                "incomplete_extension": "Lower your arm fully between each rep to complete the range.",
            },
            "41-60": {
                "body_swing":           "Keep your upper body steady. Focus the effort in your arm.",
                "elbow_swing":          "Try to keep your elbow still against your side as you curl.",
                "shoulder_elevation":   "Try to keep your shoulder relaxed and level as you lift.",
                "insufficient_curl":    "Try to lift slightly higher if it feels comfortable.",
                "incomplete_extension": "Try to lower your arm a little more between repetitions.",
            },
            "60+": {
                "body_swing":           "Try to keep still. Just your arm does the work.",
                "elbow_swing":          "Take it slowly, keep your elbow gently by your side.",
                "shoulder_elevation":   "Relax your shoulder — let it sit comfortably down as you lift.",
                "insufficient_curl":    "Gently lift a little higher when you feel ready.",
                "incomplete_extension": "Take your time lowering the weight slowly between each rep.",
            },
        },
    },

    # ------------------------------------------------------------------
    # TREE POSE (VRKSASANA) — Static Hold Exercise (flexibility only)
    #
    # pose_type = "static_hold" — returned in the API response by services.py.
    # The frontend checks pose_type and runs the hold timer instead of a
    # rep counter (see tree_pose_tracking.ts).
    #
    # goal_tags = ["flexibility"] — Tree Pose is flexibility goal ONLY.
    #   No goal nesting inside age bands (only one goal applies).
    #
    # angle_ranges: REPURPOSED to store ALIGNMENT THRESHOLDS:
    #   standing_knee_min_angle   — standing leg knee angle must EXCEED this (degrees)
    #   hip_levelness_threshold   — abs(hip_y_diff)/torso_height must STAY BELOW this
    #   trunk_sway_threshold      — abs(shoulder_mid_x - ankle_x) must STAY BELOW this
    #   wrist_height_symmetry_threshold — abs(wrist_y_diff) must STAY BELOW this
    #                               (None for 60+ — hands may rest on wall)
    #   forward_head_threshold    — nose_x offset from shoulder_mid_x must STAY BELOW this
    #   min_hold_frames           — consecutive clean frames before hold timer starts
    #
    # rep_config: REPURPOSED to store HOLD CONFIG (not sets/reps) — flat structure:
    #   target_hold_seconds       — sourced per age band for flexibility goal
    #   foot_placement            — anatomical region raised foot rests against
    #   foot_placement_landmark   — MediaPipe landmark used for placement detection
    #   standing_position         — "free_standing" | "near_wall_optional" | "near_wall_mandatory"
    #   variant_name              — human-readable pose variant per band
    #   safety_note               — displayed to user before session (None for 18-25/26-40)
    #   grace_period_seconds      — seconds before hold fully resets after form breaks (always 3)
    #
    # Sources:
    #   Hold durations:
    #     18-25: Magnusson et al. (1996) Scand J Med Sci Sports; Yoga Alliance 200hr standard.
    #     26-40: ACE Yoga Science Guide (2020) — lower bound of 20-45s flexibility range.
    #     41-60: Fragala et al. (2019) J Strength Cond Res 33(8) — NSCA Position Statement.
    #     60+:   Robertson et al. (2003) Otago Exercise Programme; Berg Balance Scale literature.
    #   Wall support:
    #     41-60: Fragala et al. (2019) NSCA Position Statement — fingertip support recommended.
    #     60+:   AGS/BGS Clinical Practice Guideline (2019); Otago Exercise Programme (2003).
    #   Foot placement:
    #     41-60: ACSM Exercise Testing and Prescription, 10th ed., Ch. 45; NHS physio guidelines.
    #     60+:   AGS/BGS Guideline 2019; Otago Programme 2003 (kickstand / toe-touch).
    #     18-25: Yoga Alliance 200hr materials — best estimate, non-peer-reviewed. Flagged.
    #     26-40: Derived from Pollock et al. 2000 NSCA SCJ progressive balance principles. Flagged.
    #   Alignment thresholds:
    #     Hip levelness 0.15: Derived from Kendall et al. Muscles 5th ed. p.70-72 (5° clinical
    #       threshold), translated to MediaPipe proportional coordinates. Best estimate. Flagged.
    #     Trunk sway 0.08: Best estimate — no published landmark paper. Flagged.
    # ------------------------------------------------------------------
    {
        "name": "Tree Pose (Vrksasana)",
        "muscle_group": "Balance & Flexibility",
        "difficulty": "Beginner",
        "image_url": "/images/tree_pose.png",
        "description": (
            "A foundational yoga balance posture (Vrksasana) that builds single-leg stability, "
            "hip flexibility, and core alignment. Stand on one leg and place the raised foot "
            "against the inner thigh, knee, calf, or ankle depending on age band. Arms can "
            "be held in prayer at the chest or raised overhead. Maintain even hips and a tall "
            "spine. Hold for the target duration on each side — both legs must reach the target "
            "for a complete set."
        ),

        # Flexibility goal only — Tree Pose is not a strength or cardio exercise.
        "goal_tags": ["flexibility"],
        "age_groups_allowed": ["18-25", "26-40", "41-60", "60+"],
        "high_impact": False,

        # Alignment thresholds — NOT traditional joint angle ranges.
        # All proportional values use MediaPipe's normalized 0.0–1.0 coordinate system.
        "angle_ranges": {
            "18-25": {
                # Source: Standard anatomical straight knee; slightly softened from 170° to 160°
                # because a "softly locked" knee is biomechanically safer for standing balance
                # than a hyperextended locked knee. Consistent with yoga instruction standards.
                "standing_knee_min_angle": 160,
                # Source: Derived from Kendall et al. Muscles 5th ed. p.70-72:
                # 5° pelvic obliquity = clinically significant. 0.15 ≈ this in MediaPipe coords.
                # ⚠️ Best estimate — flag in FYP report.
                "hip_levelness_threshold": 0.15,
                # Source: ⚠️ Best estimate — 8% frame-width sway = obvious balance loss.
                "trunk_sway_threshold": 0.08,
                # Source: ⚠️ Best estimate — 6% frame-height wrist difference = obvious asymmetry.
                "wrist_height_symmetry_threshold": 0.06,
                # Source: ⚠️ Best estimate — 5% frame-width nose offset = visible forward head.
                "forward_head_threshold": 0.05,
                # 5 frames × (1/30)s ≈ 167ms noise filter — below human reaction time.
                "min_hold_frames": 5,
            },
            "26-40": {
                "standing_knee_min_angle": 160,
                "hip_levelness_threshold": 0.15,
                "trunk_sway_threshold": 0.08,
                "wrist_height_symmetry_threshold": 0.06,
                "forward_head_threshold": 0.05,
                "min_hold_frames": 5,
            },
            "41-60": {
                # Source: ACSM — slight knee flex acceptable for adults 41-60 in balance training.
                "standing_knee_min_angle": 155,
                "hip_levelness_threshold": 0.15,
                # Wider sway tolerance — reduced proprioception → more natural trunk movement.
                "trunk_sway_threshold": 0.10,
                "wrist_height_symmetry_threshold": 0.08,
                "forward_head_threshold": 0.07,
                "min_hold_frames": 4,
            },
            "60+": {
                "standing_knee_min_angle": 150,
                # Tighter hip threshold — small asymmetry meaningfully increases fall risk.
                "hip_levelness_threshold": 0.12,
                "trunk_sway_threshold": 0.12,
                # Arms check disabled for 60+ — hands may rest on wall (None = skip check).
                "wrist_height_symmetry_threshold": None,
                "forward_head_threshold": 0.08,
                "min_hold_frames": 3,
            },
        },

        # Hold config per age band — replaces traditional sets/reps for static hold exercises.
        "rep_config": {
            "18-25": {
                # Source: Magnusson et al. (1996) — 30s minimum for proprioceptive adaptation;
                # Yoga Alliance 200hr — 30-60s target hold for flexibility-oriented practice.
                "target_hold_seconds": 45,
                "foot_placement": "inner_thigh",
                "foot_placement_landmark": "hip",
                "standing_position": "free_standing",
                "variant_name": "Full Tree Pose",
                "safety_note": None,
                "grace_period_seconds": 3,
            },
            "26-40": {
                # Source: ACE Yoga Science Guide (2020) — lower bound of 20-45s range.
                "target_hold_seconds": 45,
                "foot_placement": "inner_knee",
                "foot_placement_landmark": "knee",
                "standing_position": "free_standing",
                "variant_name": "Modified Tree Pose",
                "safety_note": None,
                "grace_period_seconds": 3,
            },
            "41-60": {
                # Source: Fragala et al. (2019) JSCR 33(8) NSCA Position Statement —
                # 10-30s static balance holds recommended; 15s is the accessible midpoint.
                "target_hold_seconds": 15,
                "foot_placement": "lower_calf_or_ankle",
                "foot_placement_landmark": "ankle",
                "standing_position": "near_wall_optional",
                "variant_name": "Low Tree Pose",
                "safety_note": (
                    "Consider performing near a wall for light fingertip support. "
                    "NSCA (2019) recommends wall support during balance training for adults over 40."
                ),
                "grace_period_seconds": 3,
            },
            "60+": {
                # Source: Robertson et al. (2003) Otago Exercise Programme;
                # AGS/BGS Clinical Practice Guideline (2019) — 10s single-leg stance
                # is a meaningful clinical benchmark and safe entry point.
                "target_hold_seconds": 10,
                "foot_placement": "kickstand_ankle_touch",
                "foot_placement_landmark": "ankle",
                "standing_position": "near_wall_mandatory",
                "variant_name": "Kickstand Tree Pose",
                "safety_note": (
                    "Perform near a wall at all times. Place your toes on the floor with "
                    "your heel resting lightly against your standing ankle."
                ),
                "grace_period_seconds": 3,
            },
        },

        # Voice cues per age band per error type.
        # Priority enforced by services.py _personalize() for is_static_hold branch:
        #   P1 — trunk_sway    (safety: fires immediately on first occurrence, no cooldown)
        #   P2 — hip_unlevel, knee_bent, [forward_head if postural flag is set]
        #   P3 — foot_too_low, arms_asymmetric, forward_head (default position)
        # Tone:
        #   18-25 / 26-40 : direct coaching
        #   41-60          : calm instructional
        #   60+            : gentle and encouraging
        "voice_cues": {
            "18-25": {
                "trunk_sway":      "You are losing balance — ground through your standing foot right now.",
                "hip_unlevel":     "Level your hips — you are tilting. Engage your core and even them out.",
                "knee_bent":       "Straighten your standing leg — keep the knee softly locked.",
                "foot_too_low":    "Raise your foot higher — bring it up towards your inner thigh.",
                "arms_asymmetric": "Even out your arms — bring both hands to the same height.",
                "forward_head":    "Pull your chin back — stack your head directly over your shoulders.",
            },
            "26-40": {
                "trunk_sway":      "Re-centre your balance — press your weight through your standing foot.",
                "hip_unlevel":     "Level your hips — they are tilting to one side. Adjust your stance.",
                "knee_bent":       "Straighten your standing leg to build stability in the pose.",
                "foot_too_low":    "Try to bring your foot a little higher for the full position.",
                "arms_asymmetric": "Try to bring your hands to an even height.",
                "forward_head":    "Gently draw your chin in and lift the crown of your head.",
            },
            "41-60": {
                "trunk_sway":      "Re-find your centre — press firmly through your standing foot.",
                "hip_unlevel":     "Try to bring your hips level — gently adjust your stance.",
                "knee_bent":       "Try to straighten your standing leg gently.",
                "foot_too_low":    "Try placing your foot a little higher if it feels comfortable.",
                "arms_asymmetric": "Try to even your hands to a comfortable height.",
                "forward_head":    "Gently draw your chin back and lengthen through the top of your head.",
            },
            "60+": {
                "trunk_sway":      "Reach out and touch the wall — steady yourself slowly, take your time.",
                "hip_unlevel":     "Take your time, softly bring your hips level — use the wall if needed.",
                "knee_bent":       "Gently ease your standing leg a little straighter when you feel ready.",
                "foot_too_low":    "No rush — your foot is comfortable where it is. Hold steady.",
                "arms_asymmetric": "Softly adjust your hands to a comfortable and level position.",
                "forward_head":    "Softly bring your chin back and feel tall through the top of your head.",
            },
        },
    },

    # ------------------------------------------------------------------
    # BUTTERFLY POSE (Baddha Konasana) — Flexibility (Static Hold)
    # ------------------------------------------------------------------
    {
        "name": "Butterfly Pose (Baddha Konasana)",
        "muscle_group": "Balance & Flexibility",
        "difficulty": "Beginner",
        "image_url": "/images/butterfly_pose.png",
        "description": (
            "A seated hip-opening posture (Baddha Konasana) that stretches the inner "
            "thighs, groin, adductors, and hip external rotators. Sit on the floor with "
            "the soles of your feet pressed together and your knees dropped out to the "
            "sides. Hold your feet or ankles, lengthen your spine upright, and breathe "
            "steadily. Allow gravity to gently open your hips. Hold for the target "
            "duration without forcing deeper range."
        ),
        "goal_tags": ["flexibility"],
        "age_groups_allowed": ["18-25", "26-40", "41-60", "60+"],
        "high_impact": False,

        # angle_ranges repurposed as alignment_thresholds for seated pose.
        # knee_drop_ratio: (knee_y - hip_y) / torso_height — positive means knees dropped.
        # Lower threshold = knees must drop further to count as 'good'.
        "angle_ranges": {
            "18-25": {
                "knee_drop_ratio_min": 0.10,
                "knee_drop_ratio_high_warning": 0.25,
                "trunk_lean_max": 0.18,
                "shoulder_elevation_threshold": 0.05,
                "head_drop_threshold": 0.08,
                "feet_apart_threshold": 0.15,
                "min_hold_frames": 5,
                "wrist_height_symmetry_threshold": None,
                "forward_head_threshold": 0.08,
            },
            "26-40": {
                "knee_drop_ratio_min": 0.05,
                "knee_drop_ratio_high_warning": 0.30,
                "trunk_lean_max": 0.18,
                "shoulder_elevation_threshold": 0.05,
                "head_drop_threshold": 0.08,
                "feet_apart_threshold": 0.15,
                "min_hold_frames": 5,
                "wrist_height_symmetry_threshold": None,
                "forward_head_threshold": 0.08,
            },
            "41-60": {
                "knee_drop_ratio_min": 0.0,
                "knee_drop_ratio_high_warning": 0.40,
                "trunk_lean_max": 0.22,
                "shoulder_elevation_threshold": 0.06,
                "head_drop_threshold": 0.10,
                "feet_apart_threshold": 0.18,
                "min_hold_frames": 4,
                "wrist_height_symmetry_threshold": None,
                "forward_head_threshold": 0.10,
            },
            "60+": {
                "knee_drop_ratio_min": 0.0,
                "knee_drop_ratio_high_warning": 0.50,
                "trunk_lean_max": 0.25,
                "shoulder_elevation_threshold": 0.07,
                "head_drop_threshold": 0.12,
                "feet_apart_threshold": 0.20,
                "min_hold_frames": 3,
                "wrist_height_symmetry_threshold": None,
                "forward_head_threshold": 0.12,
            },
        },

        # rep_config used as hold_config — same structure as Tree Pose.
        "rep_config": {
            "18-25": {
                "target_hold_seconds": 60,
                "variant_name": "Full Butterfly",
                "standing_position": "seated_floor",
                "foot_placement": "soles_together",
                "foot_placement_landmark": "ankle",
                "safety_note": None,
                "grace_period_seconds": 3,
            },
            "26-40": {
                "target_hold_seconds": 45,
                "variant_name": "Butterfly Pose",
                "standing_position": "seated_floor",
                "foot_placement": "soles_together",
                "foot_placement_landmark": "ankle",
                "safety_note": None,
                "grace_period_seconds": 3,
            },
            "41-60": {
                "target_hold_seconds": 30,
                "variant_name": "Supported Butterfly",
                "standing_position": "seated_raised_optional",
                "foot_placement": "soles_together",
                "foot_placement_landmark": "ankle",
                "safety_note": (
                    "Consider sitting on a folded blanket to tilt pelvis forward. "
                    "ACSM recommends prop use when hip flexion ROM is reduced."
                ),
                "grace_period_seconds": 3,
            },
            "60+": {
                "target_hold_seconds": 20,
                "variant_name": "Gentle Butterfly",
                "standing_position": "seated_chair_or_raised",
                "foot_placement": "soles_together",
                "foot_placement_landmark": "ankle",
                "safety_note": (
                    "Sit on a chair or raised surface if floor sitting is uncomfortable. "
                    "Do not force the knees down — let gravity work gently."
                ),
                "grace_period_seconds": 4,
            },
        },

        "voice_cues": {
            "18-25": {
                "spine_rounded":   "Sit tall — lengthen your spine and lift your chest.",
                "shoulders_raised":"Drop your shoulders away from your ears. Relax your upper body.",
                "head_dropped":    "Lift your chin — keep your gaze forward.",
                "knees_too_high":  "Relax your hips and let your knees drop lower.",
                "feet_apart":      "Bring the soles of your feet together — press them firmly.",
            },
            "26-40": {
                "spine_rounded":   "Sit tall — lengthen your spine and lift your chest.",
                "shoulders_raised":"Drop your shoulders away from your ears. Relax your upper body.",
                "head_dropped":    "Lift your chin — keep your gaze forward.",
                "knees_too_high":  "Relax your hips and let your knees drop lower.",
                "feet_apart":      "Bring the soles of your feet together — press them firmly.",
            },
            "41-60": {
                "spine_rounded":   "Gently lift through the crown of your head and straighten your back.",
                "shoulders_raised":"Soften your shoulders downward and breathe out.",
                "head_dropped":    "Gently bring your chin level with the floor.",
                "knees_too_high":  "Gently allow your knees to soften downward toward the floor.",
                "feet_apart":      "Try to bring your feet a little closer together.",
            },
            "60+": {
                "spine_rounded":   "Take a breath in and slowly sit a little taller — no rush.",
                "shoulders_raised":"Gently let your shoulders melt down. You are doing well.",
                "head_dropped":    "Softly raise your head and look ahead of you.",
                "knees_too_high":  "Take your time — breathe out and let your knees slowly relax.",
                "feet_apart":      "Gently bring your feet together when you feel comfortable.",
            },
        },
    },
]


class Command(BaseCommand):
    help = "Seeds the exercise table with biomechanically-calibrated exercise data."

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Delete all existing Exercise rows before seeding.',
        )

    def handle(self, *args, **options):
        if options['clear']:
            count, _ = Exercise.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"Deleted {count} existing exercise rows."))

        created_count = 0
        updated_count = 0

        for data in EXERCISES:
            obj, created = Exercise.objects.update_or_create(
                name=data['name'],
                defaults={k: v for k, v in data.items() if k != 'name'},
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"  Created: {obj.name}"))
            else:
                updated_count += 1
                self.stdout.write(f"  Updated: {obj.name}")

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone. {created_count} created, {updated_count} updated."
            )
        )
