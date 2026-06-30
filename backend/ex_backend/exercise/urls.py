from django.urls import path
from .views import (
    PersonalizedExerciseListView,
    PersonalizedExerciseDetailView,
    SessionSummaryCreateView,
    WorkoutSessionListView,
)

urlpatterns = [
    path('', PersonalizedExerciseListView.as_view(), name='exercise-list'),
    path('<int:pk>/', PersonalizedExerciseDetailView.as_view(), name='exercise-detail'),
    path('session/', SessionSummaryCreateView.as_view(), name='session-summary'),
    path('sessions/', WorkoutSessionListView.as_view(), name='session-list'),
]
