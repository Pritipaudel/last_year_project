from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import date, time, timedelta
from doctors.models import DoctorProfile, Availability

DOCTORS = [
    {
        "name": "Dr. Sarah Jenkins",
        "specialty": "Physical Therapist",
        "rating": 4.90,
        "distance": "1.2 km",
        "image_url": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&q=80",
        "bio": "Dr. Jenkins specializes in musculoskeletal rehabilitation, sports injury recovery, and postural assessment follow-ups. She has over 8 years of clinical experience helping patients restore full mobility using customized recovery plans.",
        "experience": 8,
        "hospital": "Metropolitan Rehab Center",
        "is_available": True,
        "patients_count": 280,
        "response_time": "30 mins",
    },
    {
        "name": "Dr. Michael Chen",
        "specialty": "Sports Medicine",
        "rating": 4.80,
        "distance": "3.4 km",
        "image_url": "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&q=80",
        "bio": "Dr. Chen is double-board-certified in Family Medicine and Sports Medicine. He works closely with competitive athletes and fitness enthusiasts to treat joint pain, ligament sprains, and devise preventative biomechanical strategies.",
        "experience": 12,
        "hospital": "Elite Sports Clinic",
        "is_available": True,
        "patients_count": 520,
        "response_time": "1 hour",
    },
    {
        "name": "Dr. Emily Rodriguez",
        "specialty": "Orthopedic",
        "rating": 4.70,
        "distance": "5.0 km",
        "image_url": "https://images.unsplash.com/photo-1594824436998-da40d27ec09c?w=150&q=80",
        "bio": "Dr. Rodriguez represents outstanding care in orthopedic surgery and skeletal care. Her expertise covers spinal biomechanics, joint tracking, ligament reconstruction, and osteoarthritic care plans.",
        "experience": 15,
        "hospital": "City Orthopedic Hospital",
        "is_available": False,
        "patients_count": 640,
        "response_time": "2 hours",
    },
    {
        "name": "Dr. Alex Mercer",
        "specialty": "Cardiology",
        "rating": 4.95,
        "distance": "2.8 km",
        "image_url": "https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=150&q=80",
        "bio": "Dr. Mercer brings top-tier cardiology expertise, focusing on cardiovascular health improvements through exercise prescription. He acts as a key consultant for patients designing active lifestyle plans after cardiac milestones.",
        "experience": 10,
        "hospital": "Saint Jude Heart Institute",
        "is_available": True,
        "patients_count": 390,
        "response_time": "15 mins",
    },
    {
        "name": "Dr. Chloe Patel",
        "specialty": "Physical Therapist",
        "rating": 4.60,
        "distance": "4.1 km",
        "image_url": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&q=80",
        "bio": "Dr. Patel targets physical therapy with a focus on pediatric and young adult developmental progression. She runs interactive, posture-corrective therapies for computer-strain and occupational-related spine ailments.",
        "experience": 6,
        "hospital": "Westside Family Care",
        "is_available": True,
        "patients_count": 180,
        "response_time": "45 mins",
    }
]

TIME_SLOTS = [
    (time(9, 0), time(9, 30)),
    (time(10, 0), time(10, 30)),
    (time(11, 0), time(11, 30)),
    (time(14, 0), time(14, 30)),
    (time(15, 0), time(15, 30)),
    (time(16, 0), time(16, 30)),
]

class Command(BaseCommand):
    help = "Seeds the database with doctor profiles and availability slots for the next 7 days."

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Delete all existing Doctor profiles before seeding.',
        )

    def handle(self, *args, **options):
        if options['clear']:
            Availability.objects.all().delete()
            count, _ = DoctorProfile.objects.all().delete()
            self.stdout.write(self.style.WARNING(f"Cleared {count} existing doctor profiles."))

        today = date.today()
        seeded_doctors = []

        for doc_data in DOCTORS:
            doctor, created = DoctorProfile.objects.update_or_create(
                name=doc_data['name'],
                defaults={k: v for k, v in doc_data.items() if k != 'name'}
            )
            seeded_doctors.append(doctor)
            status_str = "Created" if created else "Updated"
            self.stdout.write(self.style.SUCCESS(f"{status_str} Doctor: {doctor.name}"))

        # Seed Availability slots for the next 30 days (including today)
        slots_count = 0
        for i in range(30):
            query_date = today + timedelta(days=i)
            # Skip Sundays for availability seeding (doctors rest)
            if query_date.weekday() == 6:
                continue
                
            for doctor in seeded_doctors:
                if not doctor.is_available:
                    continue
                    
                for start, end in TIME_SLOTS:
                    slot, created = Availability.objects.get_or_create(
                        doctor=doctor,
                        date=query_date,
                        start_time=start,
                        end_time=end,
                        defaults={"is_booked": False}
                    )
                    if created:
                        slots_count += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully seeded {len(seeded_doctors)} doctors and {slots_count} availability slots."))
