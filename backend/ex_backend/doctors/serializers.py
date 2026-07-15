from rest_framework import serializers
from django.contrib.auth.models import User
from .models import DoctorProfile, Availability, Appointment, Message

class AvailabilitySerializer(serializers.ModelSerializer):
    formatted_time = serializers.SerializerMethodField()

    class Meta:
        model = Availability
        fields = ['id', 'date', 'start_time', 'end_time', 'is_booked', 'formatted_time']

    def get_formatted_time(self, obj):
        start = obj.start_time.strftime('%I:%M %p')
        end = obj.end_time.strftime('%I:%M %p')
        return f"{start} - {end}"


class DoctorProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = DoctorProfile
        fields = [
            'id', 'name', 'specialty', 'rating', 'distance', 'image_url', 
            'bio', 'experience', 'hospital', 'is_available', 
            'patients_count', 'response_time'
        ]


class AppointmentSerializer(serializers.ModelSerializer):
    doctor_detail = DoctorProfileSerializer(source='doctor', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Appointment
        fields = [
            'id', 'user', 'username', 'doctor', 'doctor_detail', 'slot', 
            'date', 'time_slot', 'reason', 'status', 'created_at'
        ]
        read_only_fields = ['user', 'status']

    def create(self, validated_data):
        # Assign current authenticated user
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['user'] = request.user
        
        # Mark slot as booked if slot is provided
        slot = validated_data.get('slot')
        if slot:
            slot.is_booked = True
            slot.save()
            
        appointment = super().create(validated_data)
        return appointment


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.username', read_only=True)
    doctor_name = serializers.CharField(source='doctor.name', read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'sender', 'sender_name', 'doctor', 'doctor_name', 'content', 'timestamp', 'is_from_doctor']
        read_only_fields = ['sender', 'timestamp']

    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['sender'] = request.user
        return super().create(validated_data)
