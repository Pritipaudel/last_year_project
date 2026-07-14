from django.contrib.auth.models import User
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from .serializers import RegisterSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response({
                "user": UserSerializer(user, context=self.get_serializer_context()).data,
                "message": "User created successfully. Please log in to get your token.",
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(TokenObtainPairView):
    """
    POST /api/auth/login/
    Customizes simplejwt login to return user data and handle email lookup.
    """
    permission_classes = (AllowAny,)
    
    def post(self, request, *args, **kwargs):
        # 1. Normalize username/email to lowercase
        email_or_username = request.data.get('username', '').strip().lower()
        
        # 2. Try to find the user to ensure we can handle case-insensitive lookup
        # SimpleJWT is strict, so we'll normalize the username in the request if needed
        user = None
        try:
            user = User.objects.get(email__iexact=email_or_username)
        except User.DoesNotExist:
            try:
                user = User.objects.get(username__iexact=email_or_username)
            except User.DoesNotExist:
                return Response(
                    {"detail": "No account found with this email/username."},
                    status=status.HTTP_401_UNAUTHORIZED
                )

        # 3. Update request data with the exact username from DB (handles case-insensitive and email login)
        if hasattr(request.data, '_mutable'):
            request.data._mutable = True
        request.data['username'] = user.username

        try:
            response = super().post(request, *args, **kwargs)
            if response.status_code == 200:
                response.data['user'] = UserSerializer(user).data
            return response
        except (InvalidToken, TokenError):
            return Response(
                {"detail": "Incorrect password. Please try again."},
                status=status.HTTP_401_UNAUTHORIZED
            )
        except Exception as e:
            return Response(
                {"detail": f"An unexpected error occurred: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
