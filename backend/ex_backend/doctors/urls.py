from django.urls import path
from .views import (
    DoctorListView,
    DoctorDetailView,
    NearbyDoctorListView,
    DoctorAvailabilityView,
    AppointmentListView,
    BookAppointmentView,
    DoctorMessageView
)

urlpatterns = [
    path('', DoctorListView.as_view(), name='doctor-list'),
    path('nearby/', NearbyDoctorListView.as_view(), name='doctor-nearby'),
    path('appointments/', AppointmentListView.as_view(), name='appointment-list'),
    path('<int:pk>/', DoctorDetailView.as_view(), name='doctor-detail'),
    path('<int:pk>/availability/', DoctorAvailabilityView.as_view(), name='doctor-availability'),
    path('<int:pk>/appointments/', BookAppointmentView.as_view(), name='book-appointment'),
    path('<int:pk>/messages/', DoctorMessageView.as_view(), name='doctor-messages'),
]
