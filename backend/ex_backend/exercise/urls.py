from django.urls import path
from .views import (
    PersonalizedExerciseListView,
    PersonalizedExerciseDetailView,
    SessionSummaryCreateView,
    HoldSessionSummaryCreateView,
    WorkoutSessionListView,
    DynamicTTSView,
)

urlpatterns = [
    path('', PersonalizedExerciseListView.as_view(), name='exercise-list'),
    path('tts/', DynamicTTSView.as_view(), name='dynamic-tts'),
    path('<int:pk>/', PersonalizedExerciseDetailView.as_view(), name='exercise-detail'),
    path('session/', SessionSummaryCreateView.as_view(), name='session-summary'),
    path('session/hold/', HoldSessionSummaryCreateView.as_view(), name='hold-session-create'),
    path('sessions/', WorkoutSessionListView.as_view(), name='session-list'),
]

