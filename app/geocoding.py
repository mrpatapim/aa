import json
import urllib.error
import urllib.parse
import urllib.request

SAMARA_CENTER = (53.195878, 50.100202)
SAMARA_BOUNDS = {
    "min_lat": 53.05,
    "max_lat": 53.35,
    "min_lon": 49.85,
    "max_lon": 50.35,
}

_geocode_cache: dict[str, tuple[float, float] | None] = {}


def format_user_address(street: str | None, house: str | None, apartment: str | None = None) -> str:
    parts = ["Самара", "Россия"]
    if street:
        parts.append(street.strip())
    if house:
        parts.append(f"д. {house.strip()}")
    if apartment:
        parts.append(f"кв. {apartment.strip()}")
    return ", ".join(parts)


def address_group_key(street: str | None, house: str | None) -> str:
    return f"{(street or '').strip().lower()}|{(house or '').strip().lower()}"


def _in_samara(lat: float, lon: float) -> bool:
    return (
        SAMARA_BOUNDS["min_lat"] <= lat <= SAMARA_BOUNDS["max_lat"]
        and SAMARA_BOUNDS["min_lon"] <= lon <= SAMARA_BOUNDS["max_lon"]
    )


def geocode_address(address: str, api_key: str) -> tuple[float, float] | None:
    normalized = address.strip()
    if not normalized:
        return None
    if normalized in _geocode_cache:
        return _geocode_cache[normalized]
    if not api_key:
        _geocode_cache[normalized] = None
        return None

    params = urllib.parse.urlencode({
        "apikey": api_key,
        "geocode": normalized,
        "format": "json",
        "results": 1,
    })
    url = f"https://geocode-maps.yandex.ru/1.x/?{params}"
    try:
        with urllib.request.urlopen(url, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError):
        _geocode_cache[normalized] = None
        return None

    members = (
        payload.get("response", {})
        .get("GeoObjectCollection", {})
        .get("featureMember", [])
    )
    if not members:
        _geocode_cache[normalized] = None
        return None

    pos = members[0].get("GeoObject", {}).get("Point", {}).get("pos", "")
    if not pos:
        _geocode_cache[normalized] = None
        return None

    lon_str, lat_str = pos.split()
    lat, lon = float(lat_str), float(lon_str)
    if not _in_samara(lat, lon):
        _geocode_cache[normalized] = None
        return None

    coords = (lat, lon)
    _geocode_cache[normalized] = coords
    return coords
