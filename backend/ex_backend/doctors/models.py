from django.db import models
from django.contrib.auth.models import User

class DoctorProfile(models.Model):
    name = models.CharField(max_length=100)
    specialty = models.CharField(max_length=100)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=5.00)
    distance = models.CharField(max_length=50, default="1.0 km")
    image_url = models.TextField(blank=True, default="", help_text="URL or Base64 data of doctor avatar image")
    bio = models.TextField(blank=True, default="")
    experience = models.IntegerField(default=5, help_text="Years of experience")
    hospital = models.CharField(max_length=100, default="City Medical Center")
    address = models.TextField(default="Kathmandu, Nepal")
    phone = models.CharField(max_length=20, default="")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    availability_text = models.CharField(max_length=200, blank=True, default="")
    is_available = models.BooleanField(default=True)
    patients_count = models.IntegerField(default=150)
    response_time = models.CharField(max_length=50, default="1 hour")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


