from pydantic import BaseModel


class DistrictOut(BaseModel):
    id: str
    name: str


class DistrictAssignItem(BaseModel):
    id: int
    street: str | None = None


class DistrictAssignResult(BaseModel):
    id: int
    district_id: str
    district_name: str
