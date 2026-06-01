from django.db import models
from django.contrib.auth.models import User

class UserProfile(models.Model):
    """
    Extends the base User with physiological data and onboarding preferences.
    Captured during the 3-step onboarding wizard.
    """
    SEX_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
        ('prefer-not-to-say', 'Prefer not to say'),
    ]
    
    AGE_GROUPS = [
        ('18-25', '18-25'),
        ('26-40', '26-40'),
        ('41-60', '41-60'),
        ('60+', '60+'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    age_group = models.CharField(max_length=20, choices=AGE_GROUPS, db_index=True)
    sex = models.CharField(max_length=20, choices=SEX_CHOICES)
    height = models.DecimalField(max_digits=5, decimal_places=2, help_text="Height in cm")
    weight = models.DecimalField(max_digits=5, decimal_places=2, help_text="Weight in kg")
    bmi = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    
    selected_goal = models.CharField(max_length=100, null=True, blank=True)
    onboarding_complete = models.BooleanField(default=False)
    avatar_url = models.URLField(null=True, blank=True)
    photo_taken = models.BooleanField(default=False)
    camera_allowed = models.BooleanField(null=True, blank=True)
    
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s Profile"

class Exercise(models.Model):
    """
    Library of available exercises (Push-ups, Squats, etc.)
    """
    DIFFICULTY_CHOICES = [
        ('Beginner', 'Beginner'),
        ('Intermediate', 'Intermediate'),
        ('Advanced', 'Advanced'),
    ]

    name = models.CharField(max_length=255, unique=True)
    muscle_group = models.CharField(max_length=100, db_index=True) # e.g., Chest, Back, Legs
    difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES)
    image_url = models.URLField()
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class WorkoutSession(models.Model):
    """
    Represents a completed workout activity.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='workout_sessions')
    title = models.CharField(max_length=255, default="New Workout") # e.g., 'Upper Body Strength'
    workout_type = models.CharField(max_length=50, db_index=True) # e.g., Strength, Cardio, Core, Mobility
    duration_minutes = models.PositiveIntegerField(default=0)
    calories_burned = models.PositiveIntegerField(default=0)
    date = models.DateTimeField(auto_now_add=True, db_index=True)
    
    metadata = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"{self.title} on {self.date.strftime('%Y-%m-%d')}"

class ExerciseLog(models.Model):
    """
    Specific performance data for an exercise within a session.
    """
    session = models.ForeignKey(WorkoutSession, on_delete=models.CASCADE, related_name='exercise_logs')
    exercise = models.ForeignKey(Exercise, on_delete=models.PROTECT)
    
    sets = models.PositiveIntegerField(default=1)
    reps = models.PositiveIntegerField(null=True, blank=True)
    weight_kg = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.exercise.name} Log - {self.session.id}"

class Doctor(models.Model):
    """
    Specialist profiles for consultation.
    """
    name = models.CharField(max_length=255)
    specialty = models.CharField(max_length=100, db_index=True)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=5.0)
    distance_km = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    image_url = models.URLField()
    is_available = models.BooleanField(default=True)

    def __str__(self):
        return self.name

class Consultation(models.Model):
    """
    User consultation requests with specialists.
    """
    STATUS_CHOICES = [
        ('Scheduled', 'Scheduled'),
        ('Completed', 'Completed'),
        ('Cancelled', 'Cancelled'),
    ]
    
    TYPE_CHOICES = [
        ('Call', 'Call'),
        ('Video', 'Consult'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='consultations')
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name='appointments')
    consultation_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Scheduled')
    scheduled_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} w/ {self.doctor.name} ({self.status})"
