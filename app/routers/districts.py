from typing import List

from fastapi import APIRouter, Query

from app.districts import SAMARA_DISTRICTS, district_name, match_street, resolve_district, suggest_streets
from app.schemas.districts import DistrictAssignItem, DistrictAssignResult, DistrictOut

router = APIRouter(prefix="/api", tags=["Districts"])


@router.get("/districts", response_model=List[DistrictOut])
def list_districts():
    return [DistrictOut(id=district_id, name=name) for district_id, name in SAMARA_DISTRICTS.items()]


@router.get("/streets/suggest")
def street_suggestions(q: str = Query("", max_length=100), limit: int = Query(8, ge=1, le=20)):
    return suggest_streets(q, limit)


@router.get("/streets/validate")
def validate_street(street: str = Query(..., min_length=2, max_length=200)):
    matched = match_street(street)
    if not matched:
        return {"valid": False, "suggestions": suggest_streets(street, 5)}
    return {"valid": True, **matched}


@router.post("/districts/assign", response_model=List[DistrictAssignResult])
def assign_districts(items: List[DistrictAssignItem]):
    results: list[DistrictAssignResult] = []
    for item in items:
        district_id = resolve_district(item.street)
        results.append(DistrictAssignResult(
            id=item.id,
            district_id=district_id,
            district_name=district_name(district_id),
        ))
    return results
