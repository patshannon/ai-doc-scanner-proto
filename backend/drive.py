"""Google Drive integration for uploading documents."""

import base64
import io
import os
from typing import Optional, Tuple

from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload


class DriveError(Exception):
    """Custom exception for Google Drive errors."""

    pass


def _get_service_account_credentials():
    """Get Google Drive API credentials from service account (for backend operations)."""
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not creds_path:
        raise DriveError("GOOGLE_APPLICATION_CREDENTIALS not set")

    if not os.path.exists(creds_path):
        raise DriveError(f"Credentials file not found: {creds_path}")

    scopes = ["https://www.googleapis.com/auth/drive.file"]
    credentials = service_account.Credentials.from_service_account_file(
        creds_path, scopes=scopes
    )
    return credentials


def _get_user_credentials(access_token: str):
    """Create credentials from user's OAuth access token."""
    if not access_token:
        raise DriveError("Access token is required")

    credentials = Credentials(token=access_token)
    return credentials


def _get_drive_service(access_token: Optional[str] = None):
    """
    Create and return a Google Drive API service instance.

    Args:
        access_token: Optional user OAuth access token. If provided, uses user's credentials.
                     If not provided, falls back to service account.
    """
    if access_token:
        credentials = _get_user_credentials(access_token)
    else:
        credentials = _get_service_account_credentials()

    service = build("drive", "v3", credentials=credentials)
    return service


def _find_folder(service, folder_name: str, parent_id: Optional[str] = None) -> Optional[str]:
    """
    Find a folder by name, optionally within a parent folder.

    Args:
        service: Google Drive API service instance
        folder_name: Name of the folder to find
        parent_id: ID of the parent folder (None for root)

    Returns:
        Folder ID if found, None otherwise
    """
    query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    if parent_id:
        query += f" and '{parent_id}' in parents"

    results = service.files().list(
        q=query,
        spaces="drive",
        fields="files(id, name)",
        pageSize=1
    ).execute()

    items = results.get("files", [])
    return items[0]["id"] if items else None


def _create_folder(service, folder_name: str, parent_id: Optional[str] = None) -> str:
    """
    Create a folder in Google Drive.

    Args:
        service: Google Drive API service instance
        folder_name: Name of the folder to create
        parent_id: ID of the parent folder (None for root)

    Returns:
        ID of the created folder
    """
    file_metadata = {
        "name": folder_name,
        "mimeType": "application/vnd.google-apps.folder"
    }
    if parent_id:
        file_metadata["parents"] = [parent_id]

    folder = service.files().create(
        body=file_metadata,
        fields="id"
    ).execute()

    return folder.get("id")


def ensure_folder_path(folder_path: str, access_token: Optional[str] = None) -> str:
    """
    Ensure a folder path exists in Google Drive, creating folders as needed.

    Args:
        folder_path: Folder path like "Documents/2024/Receipts"
        access_token: Optional user OAuth access token

    Returns:
        ID of the final folder in the path

    Raises:
        DriveError: If folder creation fails
    """
    try:
        service = _get_drive_service(access_token)

        # Split path into components
        path_parts = [p.strip() for p in folder_path.split("/") if p.strip()]

        if not path_parts:
            raise DriveError("Empty folder path")

        # Traverse/create each folder in the path
        parent_id = None
        for folder_name in path_parts:
            # Check if folder exists
            folder_id = _find_folder(service, folder_name, parent_id)

            if not folder_id:
                # Create folder if it doesn't exist
                folder_id = _create_folder(service, folder_name, parent_id)

            parent_id = folder_id

        return parent_id

    except Exception as e:
        raise DriveError(f"Failed to ensure folder path: {e}") from e


def upload_file(
    image_data_uri: str,
    filename: str,
    folder_id: Optional[str] = None,
    mime_type: str = "image/jpeg",
    access_token: Optional[str] = None
) -> Tuple[str, str]:
    """
    Upload a file to Google Drive.

    Args:
        image_data_uri: Base64-encoded image data URI
        filename: Name for the file in Google Drive
        folder_id: ID of the folder to upload to (None for root)
        mime_type: MIME type of the file
        access_token: Optional user OAuth access token

    Returns:
        Tuple of (file_id, web_view_link)

    Raises:
        DriveError: If upload fails
    """
    try:
        service = _get_drive_service(access_token)

        # Extract base64 data from data URI
        if not image_data_uri.startswith("data:"):
            raise DriveError("Invalid data URI format")

        parts = image_data_uri.split(",", 1)
        if len(parts) != 2:
            raise DriveError("Invalid data URI: missing base64 data")

        # Decode the base64 data
        file_data = base64.b64decode(parts[1])
        file_stream = io.BytesIO(file_data)

        # Prepare file metadata
        file_metadata = {"name": filename}
        if folder_id:
            file_metadata["parents"] = [folder_id]

        # Upload the file
        media = MediaIoBaseUpload(
            file_stream,
            mimetype=mime_type,
            resumable=True
        )

        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields="id, webViewLink"
        ).execute()

        file_id = file.get("id")
        web_view_link = file.get("webViewLink")

        return file_id, web_view_link

    except Exception as e:
        raise DriveError(f"Failed to upload file: {e}") from e
