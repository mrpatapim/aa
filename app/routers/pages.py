import os

from fastapi import APIRouter
from fastapi.responses import FileResponse

static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
router = APIRouter(tags=["Pages"])


@router.get("/")
def route_login():
    return FileResponse(os.path.join(static_dir, "index.html"))


@router.get("/dashboard")
def route_dashboard():
    return FileResponse(os.path.join(static_dir, "dashboard.html"))
