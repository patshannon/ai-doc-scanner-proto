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
    1. Use Gemini Vision to analyze the PDF
    2. Generate title and category
    3. Upload to Google Drive (if access token provided)

    Returns title, category, token usage info, and Drive info.
    """
    try:
        import base64

        if not request.pdfData.startswith("data:application/pdf"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid data URI format - expected PDF"
            )

        parts = request.pdfData.split(",", 1)
        if len(parts) != 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid data URI: missing base64 data"
            )

        pdf_bytes = base64.b64decode(parts[1])

        # Use user-provided values if available, otherwise analyze with Gemini
        if request.title and request.category and request.year:
            # User already edited values - skip re-analysis
            result = {
                'title': request.title,
                'category': request.category,
                'year': request.year,
                'input_tokens': 0,
                'output_tokens': 0,
                'estimated_cost': 0.0
            }
        else:
            # Process PDF with Gemini Vision
            result = pdf_processor.process_pdf_with_gemini(pdf_bytes)

        # Upload to Google Drive if access token provided
        drive_file_id = None
        drive_url = None
        suggested_parent_folder = None
        suggested_parent_folder_id = None
        available_parent_folders = None
        final_folder_path = None

        if request.googleAccessToken:
            try:
                # Scan user's Drive folders for smart organization
                folder_structure = drive.scan_drive_folders(
                    request.googleAccessToken,
                    max_depth=2
                )

                # Get root-level folders for user selection
                root_folders = [
                    f for f in folder_structure.get('folders', [])
                    if f.get('depth') == 0
                ]
                available_parent_folders = [
                    FolderInfo(
                        id=f['id'],
                        name=f['name'],
                        path=f['path']
                    )
                    for f in root_folders
                ]

                # Determine which parent folder to use
                category_capitalized = result['category'].capitalize()
                parent_folder_to_use = None

                if request.selectedParentFolderId:
                    # User manually selected a parent folder
                    selected_folder = next(
                        (f for f in root_folders if f['id'] == request.selectedParentFolderId),
                        None
                    )
                    if selected_folder:
                        parent_folder_to_use = {
                            'folder_id': selected_folder['id'],
                            'folder_name': selected_folder['name']
                        }
                        suggested_parent_folder = selected_folder['name']
                        suggested_parent_folder_id = selected_folder['id']
                else:
                    # Use AI to suggest best parent folder
                    parent_folder_to_use = folder_matcher.suggest_parent_folder(
                        document_category=result['category'],
                        document_title=result['title'],
                        folder_structure=folder_structure
                    )
                    if parent_folder_to_use:
                        suggested_parent_folder = parent_folder_to_use['folder_name']
                        suggested_parent_folder_id = parent_folder_to_use['folder_id']

                # Build folder path
                if parent_folder_to_use:
                    # ParentFolder/Category/Year
                    folder_path = f"{parent_folder_to_use['folder_name']}/{category_capitalized}/{result['year']}"
                else:
                    # Category/Year (root)
                    folder_path = f"{category_capitalized}/{result['year']}"

                final_folder_path = folder_path

                # Only upload if skipUpload is false
                if not request.skipUpload:
                    # Ensure folder path exists
                    folder_id = drive.ensure_folder_path(
                        folder_path,
                        request.googleAccessToken
                    )

                    # Upload PDF with AI-generated title
                    filename = f"{result['title']}.pdf"
                    drive_file_id, drive_url = drive.upload_file(
                        file_data_uri=request.pdfData,
                        filename=filename,
                        folder_id=folder_id,
                        mime_type="application/pdf",
                        access_token=request.googleAccessToken
                    )
            except drive.DriveError as drive_exc:
                # Log the error but don't fail the request
                print(f"Drive upload failed: {drive_exc}")

        return ProcessDocumentResponse(
            title=result['title'],
            category=result['category'],
            year=result['year'],
            inputTokens=result['input_tokens'],
            outputTokens=result['output_tokens'],
            estimatedCost=result['estimated_cost'],
            driveFileId=drive_file_id,
            driveUrl=drive_url,
            suggestedParentFolder=suggested_parent_folder,
            suggestedParentFolderId=suggested_parent_folder_id,
            availableParentFolders=available_parent_folders,
            finalFolderPath=final_folder_path
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
