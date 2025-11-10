"""FastAPI application entrypoint."""

from typing import Any, Dict, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

import auth
import drive
import folder_matcher
import pdf_processor
from models import (
    FolderInfo,
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


def _build_folder_suggestion(
    access_token: Optional[str],
    category: str,
    year: int,
    document_title: str,
    selected_parent_id: Optional[str] = None,
):
    if not access_token:
        default_path = f"{category.capitalize()}/{year}"
        return None, None, None, default_path

    folder_structure = drive.scan_drive_folders(access_token, max_depth=2)
    root_folders = [
        f for f in folder_structure.get("folders", []) if f.get("depth") == 0
    ]
    available_parent_folders = [
        FolderInfo(id=f["id"], name=f["name"], path=f["path"]) for f in root_folders
    ]

    category_capitalized = category.capitalize()
    parent_folder_to_use = None
    suggested_parent_folder = None
    suggested_parent_folder_id = None

    if selected_parent_id:
        selected_folder = next(
            (f for f in root_folders if f["id"] == selected_parent_id),
            None,
        )
        if selected_folder:
            parent_folder_to_use = {
                "folder_id": selected_folder["id"],
                "folder_name": selected_folder["name"],
            }
            suggested_parent_folder = selected_folder["name"]
            suggested_parent_folder_id = selected_folder["id"]
    else:
        parent_folder_to_use = folder_matcher.suggest_parent_folder(
            document_category=category,
            document_title=document_title,
            folder_structure=folder_structure,
        )
        if parent_folder_to_use:
            suggested_parent_folder = parent_folder_to_use["folder_name"]
            suggested_parent_folder_id = parent_folder_to_use["folder_id"]

    if parent_folder_to_use:
        folder_path = (
            f"{parent_folder_to_use['folder_name']}/"
            f"{category_capitalized}/{year}"
        )
    else:
        folder_path = f"{category_capitalized}/{year}"

    return (
        available_parent_folders,
        suggested_parent_folder,
        suggested_parent_folder_id,
        folder_path,
    )


@app.post("/process-document", response_model=ProcessDocumentResponse)
def process_document(
    request: ProcessDocumentRequest,
    _: Dict[str, Any] = Depends(require_user),
) -> ProcessDocumentResponse:
    """
    Analyze a PDF document with Gemini and suggest metadata/foldering.

    Uploads are handled separately via /upload-document.
    """
    try:
        pdf_bytes = _decode_pdf_bytes(request.pdfData)
        result = pdf_processor.process_pdf_with_gemini(pdf_bytes)

        (
            available_parent_folders,
            suggested_parent_folder,
            suggested_parent_folder_id,
            final_folder_path,
        ) = _build_folder_suggestion(
            access_token=request.googleAccessToken,
            category=result["category"],
            year=result["year"],
            document_title=result["title"],
            selected_parent_id=request.selectedParentFolderId,
        )

        return ProcessDocumentResponse(
            title=result["title"],
            category=result["category"],
            year=result["year"],
            inputTokens=result["input_tokens"],
            outputTokens=result["output_tokens"],
            estimatedCost=result["estimated_cost"],
            suggestedParentFolder=suggested_parent_folder,
            suggestedParentFolderId=suggested_parent_folder_id,
            availableParentFolders=available_parent_folders,
            finalFolderPath=final_folder_path,
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
    Upload the confirmed PDF to Google Drive using the supplied metadata.
    """
    try:
        # Validate PDF payload
        _decode_pdf_bytes(request.pdfData)

        parent_folder_name = None

        if request.googleAccessToken and request.selectedParentFolderId:
            folder_structure = drive.scan_drive_folders(
                request.googleAccessToken, max_depth=1
            )
            root_folders = [
                f for f in folder_structure.get("folders", [])
                if f.get("depth") == 0
            ]
            selected_folder = next(
                (f for f in root_folders if f["id"] == request.selectedParentFolderId),
                None,
            )
            if selected_folder:
                parent_folder_name = selected_folder["name"]

        category_capitalized = request.category.capitalize()
        path_parts = []
        if parent_folder_name:
            path_parts.append(parent_folder_name)
        path_parts.append(category_capitalized)
        path_parts.append(str(request.year))
        final_folder_path = "/".join(path_parts)

        folder_id = drive.ensure_folder_path(
            final_folder_path,
            request.googleAccessToken,
        )

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
