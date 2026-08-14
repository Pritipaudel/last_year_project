from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.db.models import Q

from .utils import haversine_distance
from .models import DoctorProfile
from .serializers import DoctorProfileSerializer

class DoctorListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        queryset = DoctorProfile.objects.all().order_by('-created_at')
        serializer = DoctorProfileSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = DoctorProfileSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DoctorDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return DoctorProfile.objects.get(pk=pk)
        except DoctorProfile.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound(detail="Doctor not found.")

    def get(self, request, pk):
        doctor = self.get_object(pk)
        serializer = DoctorProfileSerializer(doctor)
        return Response(serializer.data)

    def put(self, request, pk):
        if not request.user.is_staff:
            return Response({"detail": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)
        doctor = self.get_object(pk)
        serializer = DoctorProfileSerializer(doctor, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        if not request.user.is_staff:
            return Response({"detail": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)
        doctor = self.get_object(pk)
        doctor.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class NearbyDoctorListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')
        limit = int(request.query_params.get('limit', 10))

        if not lat or not lng:
            return Response({'detail': 'Latitude and longitude are required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            lat, lng = float(lat), float(lng)
        except ValueError:
            return Response({'detail': 'Invalid coordinates.'}, status=status.HTTP_400_BAD_REQUEST)

        doctors = DoctorProfile.objects.filter(latitude__isnull=False, longitude__isnull=False)
        doctors_with_distance = []

        for doc in doctors:
            dist = haversine_distance(lat, lng, doc.latitude, doc.longitude)
            doctors_with_distance.append((dist, doc))

        doctors_with_distance.sort(key=lambda x: x[0])
        nearest_doctors = [doc for dist, doc in doctors_with_distance[:limit]]
        
        serializer = DoctorProfileSerializer(nearest_doctors, many=True)
        data = serializer.data
        
        for item, (dist, doc) in zip(data, doctors_with_distance[:limit]):
            item['distanceKm'] = round(dist, 2)

        return Response(data)
