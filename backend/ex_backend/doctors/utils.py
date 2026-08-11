import math
import json
import urllib.request
import urllib.parse


def get_coordinates(address: str):
    """
    Geocodes an address to latitude and longitude using OpenStreetMap Nominatim API.
    Uses built-in urllib — no third-party package required.
    Returns (lat, lng) as floats or (None, None) if not found/error.
    """
    if not address:
        return None, None

    params = urllib.parse.urlencode({'q': address, 'format': 'json', 'limit': 1})
    url = f"https://nominatim.openstreetmap.org/search?{params}"
    req = urllib.request.Request(url, headers={'User-Agent': 'ExerciseTrackerApp/1.0'})

    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            if data and len(data) > 0:
                return float(data[0]['lat']), float(data[0]['lon'])
    except Exception as e:
        print(f"Geocoding error: {e}")

    return None, None


def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance in kilometers between two points
    on the earth (specified in decimal degrees).
    Pure Python — no external library needed.
    """
    if None in (lat1, lon1, lat2, lon2):
        return float('inf')

    # Convert decimal degrees to radians
    lon1, lat1, lon2, lat2 = map(math.radians, [float(lon1), float(lat1), float(lon2), float(lat2)])

    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    r = 6371  # Radius of earth in kilometers
    return c * r
