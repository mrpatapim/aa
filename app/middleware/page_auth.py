"""Защита HTML-страниц (аналог middleware в Laravel)."""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import RedirectResponse, Response

from app.config import ACCESS_TOKEN_COOKIE_NAME
from app.security import validate_access_token

_GUEST_ONLY_PATHS = {"/"}
_PROTECTED_PATHS = {"/dashboard"}


class PageAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path.rstrip("/") or "/"

        if self._is_public_asset(path):
            return await call_next(request)

        token = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
        is_authenticated = validate_access_token(token)

        if path in _PROTECTED_PATHS:
            if not is_authenticated:
                return RedirectResponse(url="/", status_code=302)
            return await call_next(request)

        if path in _GUEST_ONLY_PATHS and is_authenticated:
            return RedirectResponse(url="/dashboard", status_code=302)

        return await call_next(request)

    @staticmethod
    def _is_public_asset(path: str) -> bool:
        if path.startswith("/static"):
            return True
        if path in ("/login", "/register", "/logout", "/openapi.json"):
            return True
        if path.startswith("/docs") or path.startswith("/redoc"):
            return True
        if path.startswith("/api/"):
            return True
        return False
