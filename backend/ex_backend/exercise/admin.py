from django.contrib import admin
from .models import Exercise, WorkoutSession, ExerciseLog, Doctor, Consultation

@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ('name', 'muscle_group', 'difficulty')
    list_filter = ('muscle_group', 'difficulty')
    search_fields = ('name',)

class ExerciseLogInline(admin.TabularInline):
    model = ExerciseLog
    extra = 1

@admin.register(WorkoutSession)
class WorkoutSessionAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'workout_type', 'duration_minutes', 'created_at')
    list_filter = ('workout_type', 'created_at')
    inlines = [ExerciseLogInline]

@admin.register(Doctor)
class DoctorAdmin(admin.ModelAdmin):
    list_display = ('name', 'specialty', 'rating', 'is_available')
    list_filter = ('specialty', 'is_available')

@admin.register(Consultation)
class ConsultationAdmin(admin.ModelAdmin):
    list_display = ('user', 'doctor', 'consultation_type', 'status', 'scheduled_at')
    list_filter = ('status', 'consultation_type', 'scheduled_at')
