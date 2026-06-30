"""
management/commands/seed_exercises.py

Seeds the exercise table with real, calibrated exercise data.
All angle thresholds use the sourced biomechanical values (ACSM/NSCA/Escamilla).
MediaPipe interior angle convention: standing ≈ 170–180°, deeper squat = smaller number.

Usage:
    python manage.py seed_exercises
    python manage.py seed_exercises --clear   # wipe existing rows first
"""

from django.core.management.base import BaseCommand
from exercise.models import Exercise


EXERCISES = [
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

        # Sets / reps / rest per age band.
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
