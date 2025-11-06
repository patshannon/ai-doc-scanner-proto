"""FastAPI application entrypoint."""

from typing import Any, Dict, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

import auth
import drive
import pdf_processor
from models import (
    ProcessDocumentRequest,
    ProcessDocumentResponse,
)

app = FastAPI(title="Document Analyzer API", version="0.1.0")

# Allow development clients by default; production should override.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _parse_bearer_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )
    prefix = "Bearer "
    if not authorization.startswith(prefix):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header",
        )
    token = authorization[len(prefix) :].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization token empty",
        )
    return token


def require_user(
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    if auth.is_auth_disabled():
        return {"uid": "local-dev"}
    token = _parse_bearer_token(authorization)
    try:
        return auth.verify_id_token(token)
    except auth.AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)
        ) from exc


@app.get("/healthz")
def healthcheck() -> Dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/process-document", response_model=ProcessDocumentResponse)
def process_document(
    request: ProcessDocumentRequest,
    _: Dict[str, Any] = Depends(require_user),
) -> ProcessDocumentResponse:
    """
    Process a document image:
    1. Use Gemini Vision to analyze the image
    2. Generate title and category
    
    Returns title and category only (simplified for testing).
    """
    try:
        import base64

        if not request.imageData.startswith("data:image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid data URI format - expected image"
            )

        parts = request.imageData.split(",", 1)
        if len(parts) != 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid data URI: missing base64 data"
            )

        image_bytes = base64.b64decode(parts[1])

        # Process image with Gemini Vision
        title, category = pdf_processor.process_image_with_gemini(image_bytes)

        return ProcessDocumentResponse(
            title=title,
            category=category
        )

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document processing failed: {exc}",
        ) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
