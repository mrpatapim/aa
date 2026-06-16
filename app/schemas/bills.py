from pydantic import BaseModel, field_validator
from datetime import datetime, timezone

READING_DATE_FUTURE_ERROR = "Некорректная дата: нельзя указывать дату в будущем"

class ServiceTypeBase(BaseModel):
    name: str
    unit: str

class ServiceTypeCreate(ServiceTypeBase):
    pass

class ServiceTypeOut(ServiceTypeBase):
    id: int

    class Config:
        from_attributes = True

class MeterCreate(BaseModel):
    service_type_id: int
    serial_number: str
    current_tariff: float

class MeterOut(BaseModel):
    id: int
    user_id: int
    service_type_id: int
    serial_number: str
    current_tariff: float

    class Config:
        from_attributes = True

class MeterReadingCreate(BaseModel):
    reading_value: float
    recorded_at: datetime | None = None

    @field_validator("recorded_at")
    @classmethod
    def recorded_at_not_in_future(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return value
        recorded = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        today_utc = datetime.now(timezone.utc).date()
        if recorded.date() > today_utc:
            raise ValueError(READING_DATE_FUTURE_ERROR)
        return value

class MeterReadingOut(BaseModel):
    id: int
    meter_id: int
    reading_value: float
    recorded_at: datetime
    consumed_volume: float | None
    calculated_cost: float | None

    class Config:
        from_attributes = True