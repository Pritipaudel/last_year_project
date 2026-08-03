from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import BiometricProfile, PosturalAssessment
from .serializers import BiometricProfileSerializer, PosturalAssessmentSerializer


class ProfileUpdateView(APIView):
    """
    GET    /biometrics/profile/  → Retrieve the current user's profile
    PATCH  /biometrics/profile/  → Create or partially update the profile
    DELETE /biometrics/profile/  → Delete the profile
    """
    permission_classes = [IsAuthenticated]

    def _get_or_create_profile(self, user):
        profile, _ = BiometricProfile.objects.get_or_create(user=user)
        return profile

    def get(self, request):
        profile = self._get_or_create_profile(request.user)
        serializer = BiometricProfileSerializer(profile, context={'request': request})
        return Response(serializer.data)

    def patch(self, request):
        profile = self._get_or_create_profile(request.user)
        serializer = BiometricProfileSerializer(
            profile,
            data=request.data,
            partial=True,          # allow partial updates (any subset of fields)
            context={'request': request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request):
        try:
            profile = BiometricProfile.objects.get(user=request.user)
            profile.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except BiometricProfile.DoesNotExist:
            return Response({'detail': 'No profile found.'}, status=status.HTTP_404_NOT_FOUND)


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
