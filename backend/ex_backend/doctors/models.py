from django.db import models
from django.contrib.auth.models import User

class DoctorProfile(models.Model):
    name = models.CharField(max_length=100)
    specialty = models.CharField(max_length=100)
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=5.00)
    distance = models.CharField(max_length=50, default="1.0 km")
    image_url = models.TextField(help_text="URL or Base64 data of doctor avatar image")
    bio = models.TextField(blank=True, default="")
    experience = models.IntegerField(default=5, help_text="Years of experience")
    hospital = models.CharField(max_length=100, default="City Medical Center")
    is_available = models.BooleanField(default=True)
    patients_count = models.IntegerField(default=150)
    response_time = models.CharField(max_length=50, default="1 hour")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class Availability(models.Model):
    doctor = models.ForeignKey(DoctorProfile, on_delete=models.CASCADE, related_name='availabilities')
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_booked = models.BooleanField(default=False)

    class Meta:
        ordering = ['date', 'start_time']
        verbose_name_plural = "Availabilities"

    def __str__(self):
        return f"{self.doctor.name} - {self.date} @ {self.start_time.strftime('%I:%M %p')}"


class Appointment(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('cancelled', 'Cancelled'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='appointments')
    doctor = models.ForeignKey(DoctorProfile, on_delete=models.CASCADE, related_name='appointments')
    slot = models.ForeignKey(Availability, on_delete=models.SET_NULL, null=True, blank=True)
    date = models.DateField()
    time_slot = models.CharField(max_length=50) # e.g. "09:00 AM - 09:30 AM"
    reason = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='confirmed')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', 'time_slot']

    def __str__(self):
        return f"Appointment for {self.user.username} with {self.doctor.name} on {self.date}"


class Message(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_doctor_messages')
    doctor = models.ForeignKey(DoctorProfile, on_delete=models.CASCADE, related_name='messages')
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_from_doctor = models.BooleanField(default=False)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        type_str = "Doctor -> Patient" if self.is_from_doctor else "Patient -> Doctor"
        return f"Message: {type_str} on {self.timestamp.strftime('%Y-%m-%d %H:%M')}"
