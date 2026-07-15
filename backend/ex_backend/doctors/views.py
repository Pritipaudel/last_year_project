from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from datetime import datetime, date

from .models import DoctorProfile, Availability, Appointment, Message
from .serializers import (
    DoctorProfileSerializer, 
    AvailabilitySerializer, 
    AppointmentSerializer, 
    MessageSerializer
)

class DoctorListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = DoctorProfile.objects.all()
        
        # Filter by specialty
        specialty = request.query_params.get('specialty')
        if specialty and specialty.lower() != 'all':
            queryset = queryset.filter(specialty__iexact=specialty)
            
        # Search query matching name or specialty
        search_query = request.query_params.get('search')
        if search_query:
            queryset = queryset.filter(
                Q(name__icontains=search_query) | 
                Q(specialty__icontains=search_query)
            )

        serializer = DoctorProfileSerializer(queryset, many=True)
        return Response(serializer.data)


class DoctorDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            doctor = DoctorProfile.objects.get(pk=pk)
        except DoctorProfile.DoesNotExist:
            return Response({'detail': 'Doctor not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = DoctorProfileSerializer(doctor)
        return Response(serializer.data)


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
