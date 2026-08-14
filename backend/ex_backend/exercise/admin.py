from django.contrib import admin
from .models import Exercise, WorkoutSession, ExerciseLog


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
