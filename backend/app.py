"""FastAPI application entrypoint."""

import time
import logging
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

# Configure logging to show performance logs
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s:     %(message)s',
    force=True
)
logger = logging.getLogger(__name__)

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
    user: Dict[str, Any] = Depends(require_user),
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
        request_start = time.time()
        logger.info("="*80)
        logger.info("[PERF] Starting /process-document request")
        
        # Decode PDF bytes
        decode_start = time.time()
        pdf_bytes = _decode_pdf_bytes(request.pdfData)
        decode_time = time.time() - decode_start
        logger.info(f"[PERF] PDF decode: {decode_time:.3f}s (size: {len(pdf_bytes):,} bytes)")

        # Get user ID for caching
        user_id = user.get("uid")

        # === PHASE 1: Quick top-level scan (1 level deep) ===
        scan_start = time.time()
        logger.info("[PERF] Phase 1: Scanning top-level folders only")
        
        top_level_structure = drive.scan_drive_folders(
            request.googleAccessToken, 
            max_depth=1,  # Only top level for speed
            user_id=user_id,
            use_cache=True
        )
        top_level_folders = top_level_structure.get("paths", [])
        phase1_time = time.time() - scan_start
        logger.info(f"[PERF] Phase 1 complete: {phase1_time:.3f}s (found {len(top_level_folders)} top-level folders)")

        # === AI ANALYSIS: Determine category and suggested path ===
        ai_start = time.time()
        result = pdf_processor.analyze_pdf_with_folder_context(pdf_bytes, top_level_folders)
        suggested_path = result.get("suggested_path", "")
        
        # === PHASE 2: Deep scan of specific parent folder (if nested) ===
        phase2_time = 0
        all_folders = top_level_folders.copy()
        
        # Check if AI suggested a nested path (e.g., "/Car/Mazda CX-5/2022")
        path_parts = [p for p in suggested_path.split('/') if p]
        if len(path_parts) > 1:
            # Extract parent folder (e.g., "/Car" from "/Car/Mazda CX-5/2022")
            parent_folder = f"/{path_parts[0]}"
            logger.info(f"[PERF] Phase 2: Drilling into '{parent_folder}' for deeper folders")
            
            phase2_start = time.time()
            # Scan children of the suggested parent folder
            deeper_folders = drive.scan_folder_children(parent_folder, request.googleAccessToken)
            deeper_paths = [f["path"] for f in deeper_folders]
            all_folders.extend(deeper_paths)
            
            phase2_time = time.time() - phase2_start
            logger.info(f"[PERF] Phase 2 complete: {phase2_time:.3f}s (found {len(deeper_paths)} folders in {parent_folder})")
        else:
            logger.info(f"[PERF] Phase 2: Skipped (top-level path suggested)")
        
        ai_time = time.time() - ai_start
        scan_time = phase1_time + phase2_time
        logger.info(f"[PERF] Drive folder scan total: {scan_time:.3f}s (phase1={phase1_time:.1f}s, phase2={phase2_time:.1f}s)")
        logger.info(f"[PERF] AI processing: {ai_time:.3f}s")
        
        total_time = time.time() - request_start
        logger.info(f"[PERF] TOTAL /process-document: {total_time:.3f}s")
        logger.info(f"[PERF] Breakdown: decode={decode_time:.1f}s, scan={scan_time:.1f}s, AI={ai_time:.1f}s")
        logger.info("="*80)

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
    user: Dict[str, Any] = Depends(require_user),
) -> UploadDocumentResponse:
    """
    Upload the confirmed PDF to Google Drive using the user-confirmed metadata and path.

    The confirmedPath should be the full folder path (e.g., '/Work/Resumes/2025')
    as confirmed by the user in the frontend.
    """
    try:
        # Validate PDF payload
        _decode_pdf_bytes(request.pdfData)

        # Get user ID for cache management
        user_id = user.get("uid")

        # Use the confirmed path from frontend (strip leading slash if present)
        final_folder_path = request.confirmedPath.lstrip("/")

        # Ensure the folder path exists in Drive (create if needed)
        folder_id, created_new_folder = drive.ensure_folder_path(
            final_folder_path,
            request.googleAccessToken,
        )
        
        # If new folders were created, clear the cache so next scan gets fresh data
        if created_new_folder and user_id:
            drive.clear_folder_cache(user_id)

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
