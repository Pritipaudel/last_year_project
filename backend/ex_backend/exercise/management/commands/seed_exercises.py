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
        "image_url": "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=500&q=80",
        "description": (
            "A fundamental compound lower-body exercise targeting the quadriceps, "
            "glutes, and hamstrings. Stand with feet shoulder-width apart, lower "
            "your hips as if sitting onto a chair, then drive back to standing."
        ),
        # Relevant for all three goals — squats burn calories (weight_loss),
        # build muscle (weight_gain), and suit general fitness programmes.
        "goal_tags": ["weight_loss", "weight_gain", "general"],

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
        "image_url": "https://images.unsplash.com/photo-1581009137042-c552e485697a?w=500&q=80",
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
