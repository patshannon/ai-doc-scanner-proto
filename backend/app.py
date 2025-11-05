"""FastAPI application entrypoint."""

from typing import Any, Dict, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

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
    Process a PDF document:
    1. Extract text from PDF
    2. Use Gemini 2.5 Flash to generate title and category
    3. Upload to Google Drive in appropriate folder

    This is the new simplified workflow for document processing.
    """
    try:
        # Decode PDF from base64 data URI
        import base64

        if not request.pdfData.startswith("data:"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid data URI format"
            )

        parts = request.pdfData.split(",", 1)
        if len(parts) != 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid data URI: missing base64 data"
            )

        pdf_bytes = base64.b64decode(parts[1])

        # Process PDF: extract text and generate title/category
        extracted_text, title, category = pdf_processor.process_pdf_document(pdf_bytes)

        # Create folder path based on category
        from datetime import datetime
        current_year = datetime.now().year
        folder_path = f"Documents/{category}/{current_year}"

        # Ensure folder exists
        folder_id = drive.ensure_folder_path(
            folder_path,
            access_token=request.googleAccessToken
        )

        # Generate filename with title (sanitized)
        import re
        safe_title = re.sub(r'[^\w\s-]', '', title).strip()
        safe_title = re.sub(r'[-\s]+', '_', safe_title)
        filename = f"{safe_title}.pdf"

        # Upload PDF to Google Drive
        file_id, web_view_link = drive.upload_file(
            request.pdfData,
            filename,
            folder_id,
            mime_type="application/pdf",
            access_token=request.googleAccessToken
        )

        return ProcessDocumentResponse(
            title=title,
            category=category,
            fileId=file_id,
            webViewLink=web_view_link,
            folderId=folder_id,
            extractedText=extracted_text[:500]  # Return first 500 chars for reference
        )

    except HTTPException:
        raise
    except drive.DriveError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Google Drive error: {exc}"
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document processing failed: {exc}",
        ) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
