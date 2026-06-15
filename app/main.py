import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import APP_NAME
from app.routers import admin, analytics, auth, bills as bills_router, districts, forecast, pages
from app.seed import seed_database


@asynccontextmanager
async def lifespan(_: FastAPI):
    seed_database()
    yield


app = FastAPI(
    title=APP_NAME,
    description="Интеллектуальная система учета, анализа и прогнозирования ЖКХ",
    version="10.0.0",
    lifespan=lifespan,
)

app.include_router(pages.router)
app.include_router(auth.router)
app.include_router(bills_router.router)
app.include_router(analytics.router)
app.include_router(forecast.router)
app.include_router(admin.router)
app.include_router(districts.router)

static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")
