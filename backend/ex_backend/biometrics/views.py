from rest_framework import generics, status
from rest_framework.response import Response
from .models import BiometricProfile, PosturalAssessment
from .serializers import BiometricProfileSerializer, PosturalAssessmentSerializer

class ProfileUpdateView(generics.CreateAPIView, generics.RetrieveUpdateAPIView, generics.DestroyAPIView):
    serializer_class = BiometricProfileSerializer

    def get_queryset(self):
        return BiometricProfile.objects.filter(user=self.request.user)

    def get_object(self):
        obj, created = BiometricProfile.objects.get_or_create(user=self.request.user)
        return obj

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class PoseAssessmentIngestView(generics.CreateAPIView):
    serializer_class = PosturalAssessmentSerializer

    def post(self, request, *args, **kwargs):
        # Graceful handling if landmarks are missing or malformed
        try:
            profile = BiometricProfile.objects.get(user=request.user)
        except BiometricProfile.DoesNotExist:
            return Response(
                {"error": "Biometric profile must be created before assessment."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Add profile to data if not provided
        data = request.data.copy()
        data['profile'] = profile.id
        
        serializer = self.get_serializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
