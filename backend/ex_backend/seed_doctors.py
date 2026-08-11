import os
import sys
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ex_backend.settings')
django.setup()

from doctors.models import DoctorProfile
from doctors.utils import get_coordinates

DOCTORS_TO_SEED = [
    {
        "name": "Dr. Prasant Shrestha",
        "specialty": "Physical Therapist",
        "hospital": "Norvic International Hospital",
        "address": "Thapathali, Kathmandu",
        "phone": "+977-1-5970032",
        "availability_text": "Mon-Fri 10AM-4PM"
    },
    {
        "name": "Dr. Rina Maharjan",
        "specialty": "Orthopedic",
        "hospital": "Grande International Hospital",
        "address": "Dhapasi, Kathmandu",
        "phone": "+977-1-5159266",
        "availability_text": "Mon-Wed-Fri 9AM-1PM"
    },
    {
        "name": "Dr. Amit Thapa",
        "specialty": "Sports Medicine",
        "hospital": "B&B Hospital",
        "address": "Gwarko, Lalitpur",
        "phone": "+977-1-5531933",
        "availability_text": "Tue-Thu-Sat 2PM-6PM"
    },
    {
        "name": "Dr. Sita Sharma",
        "specialty": "Physical Therapist",
        "hospital": "Patan Hospital",
        "address": "Lagankhel, Lalitpur",
        "phone": "+977-1-5522266",
        "availability_text": "Mon-Fri 8AM-2PM"
    },
    {
        "name": "Dr. Ramesh Kunwar",
        "specialty": "Orthopedic",
        "hospital": "Bir Hospital",
        "address": "Kantipath, Kathmandu",
        "phone": "+977-1-4221119",
        "availability_text": "Sun-Thu 10AM-5PM"
    },
    {
        "name": "Dr. Nabin Bastola",
        "specialty": "Cardiology",
        "hospital": "Shahid Gangalal National Heart Centre",
        "address": "Bansbari, Kathmandu",
        "phone": "+977-1-4371322",
        "availability_text": "Wed-Sat 10AM-2PM"
    }
]

print("Seeding doctors...")
for doc in DOCTORS_TO_SEED:
    if DoctorProfile.objects.filter(name=doc["name"]).exists():
        print(f"Skipping {doc['name']} - already exists")
        continue

    print(f"Geocoding {doc['name']} at {doc['address']}...")
    lat, lng = get_coordinates(doc["address"])
    
    DoctorProfile.objects.create(
        name=doc["name"],
        specialty=doc["specialty"],
        hospital=doc["hospital"],
        address=doc["address"],
        phone=doc["phone"],
        availability_text=doc["availability_text"],
        latitude=Decimal(str(lat)) if lat else None,
        longitude=Decimal(str(lng)) if lng else None
    )
print("Finished seeding.")
