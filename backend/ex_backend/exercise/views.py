from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import get_personalized_exercises, get_personalized_exercise_detail
from .serializers import (
    PersonalizedExerciseSerializer, 
    SessionSummarySerializer,
    WorkoutSessionSerializer
)
from .models import WorkoutSession, Exercise


class PersonalizedExerciseListView(APIView):
    """
    GET /api/exercises/
    Returns the list of exercises filtered and personalised for the
    authenticated user based on their BiometricProfile (age_group + goal).
    """
    def get(self, request):
        exercises = get_personalized_exercises(request.user)
        serializer = PersonalizedExerciseSerializer(exercises, many=True)
        return Response(serializer.data)


class PersonalizedExerciseDetailView(APIView):
    """
    GET /api/exercises/<id>/
    Returns a single exercise with thresholds and voice cues already adjusted.
    """
    def get(self, request, pk):
        result = get_personalized_exercise_detail(request.user, pk)
        if result is None:
            return Response({'detail': 'Exercise not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = PersonalizedExerciseSerializer(result)
        return Response(serializer.data)


class SessionSummaryCreateView(APIView):
    """
    POST /api/exercises/session/
    Receives the rep count and form error summary from the frontend.
    """
    def post(self, request):
        serializer = SessionSummarySerializer(
            data=request.data,
            context={'request': request}
        )
        if serializer.is_valid():
            result = serializer.create(serializer.validated_data)
            return Response(result, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class WorkoutSessionListView(APIView):
    """
    GET /api/exercises/sessions/
    Returns the authenticated user's workout history.
    """
    def get(self, request):
        sessions = WorkoutSession.objects.filter(user=request.user).order_by('-created_at')[:10]
        serializer = WorkoutSessionSerializer(sessions, many=True)
        return Response(serializer.data)
