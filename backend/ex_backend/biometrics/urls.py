from django.urls import path
from .views import ProfileUpdateView, PoseAssessmentIngestView

urlpatterns = [
    path('profile/', ProfileUpdateView.as_view(), name='biometrics_profile'),
    path('assess/', PoseAssessmentIngestView.as_view(), name='biometrics_assess'),
]
