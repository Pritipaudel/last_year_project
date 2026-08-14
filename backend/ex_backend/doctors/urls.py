from django.urls import path
from .views import (
    DoctorListView,
    DoctorDetailView,
    NearbyDoctorListView
)

urlpatterns = [
    path('', DoctorListView.as_view(), name='doctor-list'),
    path('nearby/', NearbyDoctorListView.as_view(), name='doctor-nearby'),
    path('<int:pk>/', DoctorDetailView.as_view(), name='doctor-detail'),
]
