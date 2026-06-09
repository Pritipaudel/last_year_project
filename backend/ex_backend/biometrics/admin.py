from django.contrib import admin
from .models import BiometricProfile, PosturalAssessment

@admin.register(BiometricProfile)
class BiometricProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'age_group', 'sex', 'bmi', 'goal', 'privacy_consent_timestamp')
    search_fields = ('user__username', 'goal')
    list_filter = ('age_group', 'sex')

@admin.register(PosturalAssessment)
class PosturalAssessmentAdmin(admin.ModelAdmin):
    list_display = ('profile', 'created_at')
    readonly_fields = ('created_at',)
