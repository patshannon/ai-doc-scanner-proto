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
    UploadDocumentRequest,
    UploadDocumentResponse,
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


def _decode_pdf_bytes(data_uri: str) -> bytes:
    import base64

    if not data_uri.startswith("data:application/pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid data URI format - expected PDF"
        )

    parts = data_uri.split(",", 1)
    if len(parts) != 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid data URI: missing base64 data"
        )

    return base64.b64decode(parts[1])


@app.post("/process-document", response_model=ProcessDocumentResponse)
def process_document(
    request: ProcessDocumentRequest,
    _: Dict[str, Any] = Depends(require_user),
) -> ProcessDocumentResponse:
    """
    Analyze a PDF document with Gemini using context from existing Drive folder structure.

    This endpoint:
    1. Scans the user's Drive folders (2-3 levels deep)
    2. Passes folder context to AI for intelligent categorization and path selection
    3. Returns document metadata + suggested storage location

    Uploads are handled separately via /upload-document.

    Requires:
        - Google Drive access token (for folder scanning)
    """
    try:
        # Decode PDF bytes
        pdf_bytes = _decode_pdf_bytes(request.pdfData)

        # Scan Drive folders FIRST to get organizational context
        folder_structure = drive.scan_drive_folders(request.googleAccessToken, max_depth=2)
        existing_folders = folder_structure.get("paths", [])

        # Analyze PDF with folder context in a single AI call
        result = pdf_processor.analyze_pdf_with_folder_context(pdf_bytes, existing_folders)

        return ProcessDocumentResponse(
            title=result["title"],
            category=result["category"],
            year=result["year"],
            inputTokens=result["input_tokens"],
            outputTokens=result["output_tokens"],
            estimatedCost=result["estimated_cost"],
            suggestedPath=result["suggested_path"],
            pathReason=result["path_reason"],
            isExistingPath=result["is_existing_path"],
        )

    except drive.DriveError as drive_exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Drive folder scan failed: {drive_exc}",
        ) from drive_exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document processing failed: {exc}",
        ) from exc


@app.post("/upload-document", response_model=UploadDocumentResponse)
def upload_document(
    request: UploadDocumentRequest,
    _: Dict[str, Any] = Depends(require_user),
) -> UploadDocumentResponse:
    """
    Upload the confirmed PDF to Google Drive using the user-confirmed metadata and path.

    The confirmedPath should be the full folder path (e.g., '/Work/Resumes/2025')
    as confirmed by the user in the frontend.
    """
    try:
        # Validate PDF payload
        _decode_pdf_bytes(request.pdfData)

        # Use the confirmed path from frontend (strip leading slash if present)
        final_folder_path = request.confirmedPath.lstrip("/")

        # Ensure the folder path exists in Drive (create if needed)
        folder_id = drive.ensure_folder_path(
            final_folder_path,
            request.googleAccessToken,
        )

        # Upload the PDF file
        filename = f"{request.title}.pdf"
        drive_file_id, drive_url = drive.upload_file(
            file_data_uri=request.pdfData,
            filename=filename,
            folder_id=folder_id,
            mime_type="application/pdf",
            access_token=request.googleAccessToken,
        )

        return UploadDocumentResponse(
            driveFileId=drive_file_id,
            driveUrl=drive_url,
            finalFolderPath=final_folder_path,
        )

    except drive.DriveError as drive_exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Drive upload failed: {drive_exc}",
        ) from drive_exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document upload failed: {exc}",
        ) from exc


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
