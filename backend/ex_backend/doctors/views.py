from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.db.models import Q
from datetime import datetime, date

from .utils import haversine_distance
from .models import DoctorProfile, Availability, Appointment, Message
from .serializers import (
    DoctorProfileSerializer, 
    AvailabilitySerializer, 
    AppointmentSerializer, 
    MessageSerializer
)

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


class DoctorAvailabilityView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            doctor = DoctorProfile.objects.get(pk=pk)
        except DoctorProfile.DoesNotExist:
            return Response({'detail': 'Doctor not found.'}, status=status.HTTP_404_NOT_FOUND)

        date_str = request.query_params.get('date')
        if not date_str:
            # Default to today
            query_date = date.today()
        else:
            try:
                query_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        # Get all slots for this doctor on this day that are not booked
        slots = Availability.objects.filter(doctor=doctor, date=query_date, is_booked=False)
        serializer = AvailabilitySerializer(slots, many=True)
        return Response(serializer.data)


class AppointmentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Return appointments for authenticated web user
        appointments = Appointment.objects.filter(user=request.user).order_by('-date', 'time_slot')
        serializer = AppointmentSerializer(appointments, many=True)
        return Response(serializer.data)


class BookAppointmentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            doctor = DoctorProfile.objects.get(pk=pk)
        except DoctorProfile.DoesNotExist:
            return Response({'detail': 'Doctor not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data.copy()
        data['doctor'] = doctor.id

        serializer = AppointmentSerializer(data=data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DoctorMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            doctor = DoctorProfile.objects.get(pk=pk)
        except DoctorProfile.DoesNotExist:
            return Response({'detail': 'Doctor not found.'}, status=status.HTTP_404_NOT_FOUND)

        messages = Message.objects.filter(sender=request.user, doctor=doctor).order_by('timestamp')
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)

    def post(self, request, pk):
        try:
            doctor = DoctorProfile.objects.get(pk=pk)
        except DoctorProfile.DoesNotExist:
            return Response({'detail': 'Doctor not found.'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data.copy()
        data['doctor'] = doctor.id

        serializer = MessageSerializer(data=data, context={'request': request})
        if serializer.is_valid():
            user_msg = serializer.save()
            
            # Interactive response simulation
            import random
            replies = [
                f"Hello! I checked your message regarding '{user_msg.content}'. Make sure you keep working on stabilizing your core alignment during assessments.",
                "Thank you for the update! Please make sure to check my availability calendar and book a consultation slot so we can review this thoroughly.",
                "Hello. I suggest physical mobility therapies twice a week. Let me know if you would like me to review your biomechanical logs in detail.",
                "Excellent work on your workouts! Keep monitoring your knee-tracking deviations. Try to stay tall and focus on form.",
                "Hey there, thanks for reaching out. Please schedule an online consultation time so we can run through your postural scans together."
            ]
            
            Message.objects.create(
                sender=request.user,
                doctor=doctor,
                content=random.choice(replies),
                is_from_doctor=True
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
