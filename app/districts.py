import re
from typing import TypedDict

SAMARA_DISTRICTS = {
    "leninsky": "Ленинский",
    "sovetsky": "Советский",
    "oktyabrsky": "Октябрьский",
    "zheleznodorozhny": "Железнодорожный",
    "kirovsky": "Кировский",
    "promyshlenny": "Промышленный",
    "samarsky": "Самарский",
    "krasnoglinsky": "Красноглинский",
}

class StreetInfo(TypedDict):
    label: str
    district_id: str
    district_name: str


DEFAULT_DISTRICT = "kirovsky"


def normalize_street(value: str) -> str:
    text = str(value or "").lower().replace("ё", "е")
    text = re.sub(r"[.,]", " ", text)
    text = re.sub(r"-", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(
        r"^(улица|ул|проспект|пр-кт|пр|переулок|пер|бульвар|б-р|шоссе|ш|проезд)\s+",
        "",
        text,
    )
    return text


CANONICAL_STREETS: list[tuple[str, str]] = [
    ("ул. Куйбышева", "leninsky"),
    ("ул. Венцека", "leninsky"),
    ("ул. Степана Разина", "leninsky"),
    ("ул. Некрасовская", "leninsky"),
    ("ул. Демократическая", "leninsky"),
    ("ул. Самарская", "sovetsky"),
    ("ул. Чапаевская", "sovetsky"),
    ("ул. Галактионовская", "sovetsky"),
    ("ул. Молодогвардейская", "sovetsky"),
    ("ул. Фрунзе", "sovetsky"),
    ("ул. Ленинградская", "sovetsky"),
    ("ул. Полевая", "oktyabrsky"),
    ("ул. Осипенко", "oktyabrsky"),
    ("ул. Мичурина", "oktyabrsky"),
    ("ул. Партизанская", "oktyabrsky"),
    ("ул. Ново-Садовая", "zheleznodorozhny"),
    ("ул. Революционная", "zheleznodorozhny"),
    ("ул. Первомайская", "zheleznodorozhny"),
    ("проспект Ленина", "zheleznodorozhny"),
    ("ул. Авроры", "zheleznodorozhny"),
    ("ул. Аэродромная", "zheleznodorozhny"),
    ("проспект Кирова", "kirovsky"),
    ("ул. Победы", "kirovsky"),
    ("ул. Гагарина", "kirovsky"),
    ("ул. Советской Армии", "kirovsky"),
    ("ул. Ташкентская", "kirovsky"),
    ("ул. XXII Партсъезда", "kirovsky"),
    ("Московское шоссе", "promyshlenny"),
    ("ул. Карла Маркса", "promyshlenny"),
    ("ул. Ново-Вокзальная", "promyshlenny"),
    ("ул. Стара-Загора", "samarsky"),
    ("ул. Красноглинская", "krasnoglinsky"),
    ("ул. Красной Глинки", "krasnoglinsky"),
]

STREET_DISTRICT_MAP: dict[str, str] = {}
for street_label, district_id in CANONICAL_STREETS:
    STREET_DISTRICT_MAP[normalize_street(street_label)] = district_id


def _street_info(label: str, district_id: str) -> StreetInfo:
    return {
        "label": label,
        "district_id": district_id,
        "district_name": district_name(district_id),
    }


def _street_rank(query: str, label: str) -> int:
    normalized_query = normalize_street(query)
    normalized_label = normalize_street(label)
    if not normalized_query:
        return 0
    if normalized_label == normalized_query:
        return 0
    if normalized_label.startswith(normalized_query):
        return 1
    if normalized_query in normalized_label:
        return 2
    query_words = normalized_query.split()
    if any(word and word in normalized_label for word in query_words):
        return 3
    return 99


def suggest_streets(query: str, limit: int = 8) -> list[StreetInfo]:
    ranked: list[tuple[int, str, str]] = []
    for label, district_id in CANONICAL_STREETS:
        rank = _street_rank(query, label)
        if rank < 99:
            ranked.append((rank, label, district_id))
    ranked.sort(key=lambda item: (item[0], item[1]))
    return [_street_info(label, district_id) for _, label, district_id in ranked[:limit]]


def match_street(street: str | None) -> StreetInfo | None:
    normalized = normalize_street(street or "")
    if not normalized:
        return None

    for label, district_id in CANONICAL_STREETS:
        if normalize_street(label) == normalized:
            return _street_info(label, district_id)

    for label, district_id in CANONICAL_STREETS:
        label_norm = normalize_street(label)
        if normalized in label_norm or label_norm in normalized:
            return _street_info(label, district_id)

    return None


def resolve_district(street: str | None) -> str:
    normalized = normalize_street(street or "")
    if not normalized:
        return DEFAULT_DISTRICT

    if normalized in STREET_DISTRICT_MAP:
        return STREET_DISTRICT_MAP[normalized]

    for key, district_id in STREET_DISTRICT_MAP.items():
        if key in normalized or normalized in key:
            return district_id

    return DEFAULT_DISTRICT


def district_name(district_id: str) -> str:
    return SAMARA_DISTRICTS.get(district_id, SAMARA_DISTRICTS[DEFAULT_DISTRICT])
