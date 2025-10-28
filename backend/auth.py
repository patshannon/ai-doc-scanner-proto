"""
Firebase authentication helpers.

Verifies incoming Firebase ID tokens and provides an opt-in bypass for
local development via the FIREBASE_SKIP_AUTH environment variable.
"""

import os
from functools import lru_cache
from typing import Any, Dict

from firebase_admin import App, auth as firebase_auth, credentials, get_app, initialize_app


class AuthError(Exception):
    """Raised when Firebase authentication fails."""


def _should_skip_auth() -> bool:
    return os.getenv("FIREBASE_SKIP_AUTH", "").strip().lower() in {"1", "true", "yes"}


@lru_cache(maxsize=1)
def _get_firebase_app() -> App:
    """Initialises a Firebase app instance (cached)."""
    try:
        return get_app()
    except ValueError:
        project_id = os.getenv("FIREBASE_PROJECT_ID")
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

        cred = None
        if cred_path:
            cred = credentials.Certificate(cred_path)
        else:
            try:
                cred = credentials.ApplicationDefault()
            except Exception as exc:  # pragma: no cover - setup dependent
                raise AuthError(f"Firebase credentials not configured: {exc}") from exc

        options = {"projectId": project_id} if project_id else None

        try:
            return initialize_app(cred, options)
        except Exception as exc:  # pragma: no cover - firebase admin handles errors
            raise AuthError(f"Failed to initialize Firebase app: {exc}") from exc


def verify_id_token(id_token: str) -> Dict[str, Any]:
    """
    Verify a Firebase ID token and return its decoded claims.

    Raises:
        AuthError: if the token is invalid or verification fails.
    """
    if not id_token:
        raise AuthError("Missing ID token")

    if _should_skip_auth():
        # Return minimal claims so downstream code can proceed in local dev.
        return {"uid": "local-dev", "email": "local@example.com"}

    try:
        app = _get_firebase_app()
        return firebase_auth.verify_id_token(id_token, app=app)
    except Exception as exc:  # pragma: no cover - firebase admin handles errors
        raise AuthError(f"Failed to verify ID token: {exc}") from exc


def is_auth_disabled() -> bool:
    """Expose whether auth is bypassed (useful for FastAPI dependency wiring)."""
    return _should_skip_auth()
