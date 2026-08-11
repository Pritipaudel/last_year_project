from django.db import models
from django.contrib.auth.models import User

class BiometricProfile(models.Model):
    """
    Independent physiological profile. 
    Decoupled from auth: deletion of this model shouldn't break login.
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

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='biometric_profile')
    age_group = models.CharField(max_length=20, choices=AGE_GROUPS, null=True, blank=True)
    sex = models.CharField(max_length=20, choices=SEX_CHOICES, null=True, blank=True)
    height = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    weight = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    bmi = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    
    goal = models.CharField(max_length=100, null=True, blank=True)
    privacy_consent_timestamp = models.DateTimeField(null=True, blank=True)
    onboarding_complete = models.BooleanField(
        default=False,
        help_text="Set when the user finishes the onboarding flow. Explicitly recorded rather than "
                  "inferred from assessments, so users who skip the body scan are not looped back.",
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Biometrics for {self.user.username}"

class PosturalAssessment(models.Model):
    """
    Ingests landmark data and postural flags from MediaPipe.
    """
    profile = models.ForeignKey(BiometricProfile, on_delete=models.CASCADE, related_name='assessments')
    
    # Visual and Skeletal Data
    image = models.TextField(null=True, blank=True, help_text="Base64 Data URL of the image")
    raw_landmarks = models.JSONField(null=True, blank=True, help_text="Raw 33 landmarks coordinates {x, y, z, visibility}")
    
    # Store joint angles and raw landmark data as JSON for flexibility
    joint_angles = models.JSONField(help_text="Dictionary of joint angles (e.g. {'right_knee': 175})")
    deviations = models.JSONField(help_text="Detected postural deviations (e.g. {'forward_head': True})")
    
    # Optional image reference if needed
    scan_reference_id = models.CharField(max_length=100, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Assessment for {self.profile.user.username} at {self.created_at}"
