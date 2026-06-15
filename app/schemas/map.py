from pydantic import BaseModel


class MapResident(BaseModel):
    id: int
    username: str
    email: str
    street: str | None
    house: str | None
    apartment: str | None
    floor: str | None
    district_name: str | None


class MapPoint(BaseModel):
    lat: float
    lon: float
    address: str
    residents: list[MapResident]


class ResidentsMapOut(BaseModel):
    center_lat: float
    center_lon: float
    zoom: int
    api_key: str
    points: list[MapPoint]
    skipped: int
