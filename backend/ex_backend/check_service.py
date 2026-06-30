from exercise.models import Exercise
from exercise.services import get_personalized_exercises
from django.contrib.auth.models import User

u = User.objects.filter(biometric_profile__isnull=False).first()
if u:
    print("User:", u.username)
    print("Profile goal:", u.biometric_profile.goal)
    print("Profile age_group:", u.biometric_profile.age_group)
    results = get_personalized_exercises(u)
    print("Personalized exercises returned:", len(results))
    for r in results:
        print("  ->", r["name"], "| band=", r["personalization"]["age_band"])
else:
    print("No user with biometric_profile found — testing fallback")
    u = User.objects.first()
    if u:
        results = get_personalized_exercises(u)
        print("Exercises returned (fallback):", len(results))
        for r in results:
            print("  ->", r["name"])
