from rest_framework import serializers
from .models import BiometricProfile, PosturalAssessment


class BiometricProfileSerializer(serializers.ModelSerializer):
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    
    class Meta:
        model = BiometricProfile
        fields = ('user', 'age_group', 'sex', 'height', 'weight', 'bmi', 'goal',
                  'privacy_consent_timestamp', 'onboarding_complete')
        read_only_fields = ('bmi',) # BMI is strictly server-calculated

    def validate(self, data):
        # Only validate fields if they are present in the request (support partial updates)
        
        # Privacy Consent Check (if provided)
        if 'privacy_consent_timestamp' in data and not data['privacy_consent_timestamp']:
            raise serializers.ValidationError({"privacy_consent_timestamp": "Privacy consent is mandatory."})
            
        # BMI Calculation (only if BOTH height and weight are provided in this request)
        height_cm = data.get('height')
        weight_kg = data.get('weight')
        
        if height_cm and weight_kg:
            try:
                if float(height_cm) > 0:
                    height_m = float(height_cm) / 100
                    data['bmi'] = round(float(weight_kg) / (height_m ** 2), 1)
                else:
                    raise serializers.ValidationError({"height": "Height must be greater than zero."})
            except (ZeroDivisionError, ValueError, TypeError):
                raise serializers.ValidationError({"bmi": "Error calculating BMI."})
            
        return data

class PosturalAssessmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PosturalAssessment
        fields = ('id', 'profile', 'image', 'raw_landmarks', 'joint_angles', 'deviations', 'created_at')
        read_only_fields = ('created_at',)

    def validate(self, attrs):
        profile = attrs.get('profile')
        if not profile.privacy_consent_timestamp:
            raise serializers.ValidationError("Cannot ingest postural data without user privacy consent.")
        return attrs
