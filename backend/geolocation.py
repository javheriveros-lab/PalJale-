import math
from typing import Optional

EARTH_RADIUS_KM = 6371.0

def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_KM * c

def delivery_fee(distance_km: float, base: float = 150.0, per_km: float = 12.0) -> float:
    if distance_km <= 0:
        return 0.0
    return round(base + (distance_km * per_km), 2)
