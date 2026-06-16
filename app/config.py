import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Response

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

APP_NAME = os.getenv("APP_NAME", "Система учета ЖКХ").strip()
YANDEX_MAPS_API_KEY = os.getenv("YANDEX_MAPS_API_KEY", "").strip()

ACCESS_TOKEN_COOKIE_NAME = "access_token"
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").strip().lower() in ("1", "true", "yes")
COOKIE_MAX_AGE = int(os.getenv("COOKIE_MAX_AGE", str(60 * 60)))


def attach_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
        secure=COOKIE_SECURE,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=ACCESS_TOKEN_COOKIE_NAME,
        path="/",
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
    )
