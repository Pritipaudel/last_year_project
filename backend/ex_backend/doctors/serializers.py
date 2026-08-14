from rest_framework import serializers
from django.contrib.auth.models import User
from .models import DoctorProfile
from .utils import get_coordinates

class DoctorProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = DoctorProfile
        fields = [
            'id', 'name', 'specialty', 'rating', 'distance', 'image_url', 
            'bio', 'experience', 'hospital', 'is_available', 
            'patients_count', 'response_time',
            'address', 'phone', 'latitude', 'longitude', 'availability_text'
        ]
        read_only_fields = ['latitude', 'longitude']

    def validate(self, attrs):
        address = attrs.get('address')
        # On update, address might not be in attrs if it's a partial update,
        # so check if it's being modified.
        if address:
            lat, lng = get_coordinates(address)
            if lat is None or lng is None:
                raise serializers.ValidationError({"address": "Address could not be geocoded. Please provide a valid location."})
            attrs['latitude'] = lat
            attrs['longitude'] = lng
        return attrs
