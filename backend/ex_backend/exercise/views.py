from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import get_personalized_exercises, get_personalized_exercise_detail
from .serializers import (
    PersonalizedExerciseSerializer, 
    SessionSummarySerializer,
    HoldSessionSummarySerializer,
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


class HoldSessionSummaryCreateView(APIView):
    """
    POST /api/exercises/session/hold/
    Receives the hold duration summary from the frontend for static hold exercises
    (Tree Pose, etc.). Creates WorkoutSession + ExerciseLog with hold-specific metadata.
    """
    def post(self, request):
        serializer = HoldSessionSummarySerializer(
            data=request.data,
            context={'request': request}
        )
        if serializer.is_valid():
            result = serializer.create(serializer.validated_data)
            return Response(result, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DynamicTTSView(APIView):
    """
    GET /api/exercises/tts/?text=...
    Synthesizes or retrieves cached TTS audio for any given text string on the fly.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        import hashlib
        from pathlib import Path
        from django.conf import settings
        from django.http import FileResponse

        text = request.query_params.get('text', '').strip()
        if not text:
            return Response({'detail': 'text query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

        text_hash = hashlib.sha256(text.encode('utf-8')).hexdigest()[:16]
        output_dir = Path(settings.MEDIA_ROOT) / "voice_cues"
        output_dir.mkdir(parents=True, exist_ok=True)
        file_path = output_dir / f"dynamic_{text_hash}.mp3"

        if not file_path.exists():
            from gtts import gTTS
            tts = gTTS(text=text, lang="en")
            tts.save(str(file_path))

        return FileResponse(open(file_path, 'rb'), content_type="audio/mpeg")

