"""Google Drive integration for uploading documents."""

import base64
import io
import os
import time
import logging
from typing import Dict, List, Optional, Tuple

from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

logger = logging.getLogger(__name__)

# In-memory cache for Drive folder structures
# Format: {user_id: {"folders": {...}, "paths": [...], "expires_at": timestamp}}
_folder_cache: Dict[str, Dict] = {}
_CACHE_TTL_SECONDS = 300  # 5 minutes


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

    # Required scopes for Drive operations:
    # - drive.file: Create and manage files created by this app
    # - drive.metadata.readonly: Read folder structure for smart organization
    scopes = [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive.metadata.readonly"
    ]
    credentials = service_account.Credentials.from_service_account_file(
        creds_path, scopes=scopes
    )
    return credentials


def _get_user_credentials(access_token: str):
    """
    Create credentials from user's OAuth access token.

    Note: User access tokens must be obtained with these scopes:
    - https://www.googleapis.com/auth/drive.file (upload files)
    - https://www.googleapis.com/auth/drive.metadata.readonly (scan folders)

    Scopes are requested during OAuth flow in the frontend.
    """
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


def _build_folder_tree(folders: List[Dict], max_depth: int = 2) -> List[Dict]:
    """
    Build hierarchical folder tree from flat list of folders.

    Args:
        folders: Flat list of folder dicts with 'id', 'name', and 'parents'
        max_depth: Maximum depth to include (0 = root level only)

    Returns:
        List of root-level folders with nested 'children' arrays
    """
    # Create lookup map: folder_id -> folder
    folder_map = {f["id"]: {**f, "children": []} for f in folders}

    # Build parent-child relationships
    root_folders = []
    for folder in folders:
        if "parents" in folder and folder["parents"]:
            parent_id = folder["parents"][0]  # First parent
            if parent_id in folder_map:
                folder_map[parent_id]["children"].append(folder_map[folder["id"]])
        else:
            # No parents means root-level folder
            root_folders.append(folder_map[folder["id"]])

    return root_folders


def clear_folder_cache(user_id: str) -> None:
    """
    Clear the cached folder structure for a specific user.
    
    Call this when folders are created to ensure fresh data on next scan.
    
    Args:
        user_id: Unique identifier for the user (e.g., Firebase UID)
    """
    if user_id in _folder_cache:
        logger.info(f"Clearing folder cache for user: {user_id}")
        del _folder_cache[user_id]


def _get_cached_folders(user_id: str) -> Optional[Dict]:
    """
    Get cached folder structure if valid (not expired).
    
    Args:
        user_id: Unique identifier for the user
        
    Returns:
        Cached folder data or None if cache miss/expired
    """
    if user_id not in _folder_cache:
        return None
        
    cached_data = _folder_cache[user_id]
    now = time.time()
    
    if cached_data["expires_at"] <= now:
        logger.info(f"Folder cache expired for user: {user_id}")
        del _folder_cache[user_id]
        return None
    
    logger.info(f"Using cached folder structure for user: {user_id} (expires in {cached_data['expires_at'] - now:.0f}s)")
    return cached_data


def _set_cached_folders(user_id: str, folder_data: Dict) -> None:
    """
    Store folder structure in cache with TTL.
    
    Args:
        user_id: Unique identifier for the user
        folder_data: Folder structure to cache
    """
    now = time.time()
    _folder_cache[user_id] = {
        **folder_data,
        "expires_at": now + _CACHE_TTL_SECONDS
    }
    logger.info(f"Cached folder structure for user: {user_id} (TTL: {_CACHE_TTL_SECONDS}s)")


def scan_folder_children(parent_path: str, access_token: str) -> List[Dict]:
    """
    Scan immediate children (1 level deep) of a specific folder.
    
    Used for phase 2 of progressive scanning - after identifying a top-level category,
    scan deeper only within that specific folder.
    
    Args:
        parent_path: Path to parent folder (e.g., '/Car' or '/Finance')
        access_token: User's OAuth access token
        
    Returns:
        List of child folders with paths like ['/Car/Mazda CX-5', '/Car/Toyota Camry']
        
    Example:
        children = scan_folder_children('/Car', token)
        # Returns: [
        #   {'id': '123', 'name': 'Mazda CX-5', 'path': '/Car/Mazda CX-5'},
        #   {'id': '456', 'name': 'Toyota Camry', 'path': '/Car/Toyota Camry'}
        # ]
    """
    try:
        service = _get_drive_service(access_token)
        
        # First, find the parent folder ID
        parent_path = parent_path.strip('/')
        path_parts = [p.strip() for p in parent_path.split('/') if p.strip()]
        
        parent_id = None
        for folder_name in path_parts:
            folder_id = _find_folder(service, folder_name, parent_id)
            if not folder_id:
                logger.warning(f"Parent folder not found: {parent_path}")
                return []
            parent_id = folder_id
        
        # Now scan children of this parent
        query = f"mimeType='application/vnd.google-apps.folder' and trashed=false and '{parent_id}' in parents"
        
        results = service.files().list(
            q=query,
            spaces="drive",
            fields="files(id, name)",
            pageSize=100
        ).execute()
        
        folders = results.get("files", [])
        children = []
        for folder in folders:
            child_path = f"/{parent_path}/{folder['name']}"
            children.append({
                "id": folder["id"],
                "name": folder["name"],
                "path": child_path
            })
        
        logger.info(f"  [CACHE] Found {len(children)} children in {parent_path}")
        return children
        
    except Exception as e:
        logger.warning(f"Failed to scan children of {parent_path}: {e}")
        return []


def scan_drive_folders(access_token: str, max_depth: int = 2, user_id: Optional[str] = None, use_cache: bool = True) -> Dict:
    """
    Scan user's Google Drive for existing folder structure up to specified depth.

    Args:
        access_token: User's OAuth access token
        max_depth: Maximum depth to scan (0 = root only, 1 = root + children, etc.)

    Returns:
        {
            'folders': [  # Flat list of all folders with complete paths
                {'id': str, 'name': str, 'path': str, 'depth': int}
            ],
            'paths': [str]  # List of complete folder paths for AI context
        }

    Example:
        {
            'folders': [
                {'id': '123', 'name': 'Work', 'path': '/Work', 'depth': 0},
                {'id': '456', 'name': 'Resumes', 'path': '/Work/Resumes', 'depth': 1},
                {'id': '789', 'name': '2025', 'path': '/Work/Resumes/2025', 'depth': 2}
            ],
            'paths': ['/Work', '/Work/Resumes', '/Work/Resumes/2025']
        }

    Raises:
        DriveError: If scanning fails
    """
    # Check cache if user_id provided and caching is enabled
    logger.info(f"  [CACHE] scan_drive_folders called: user_id={user_id}, use_cache={use_cache}")
    
    if use_cache and user_id:
        logger.info(f"  [CACHE] Attempting cache lookup for user_id: {user_id}")
        logger.info(f"  [CACHE] Current cache keys: {list(_folder_cache.keys())}")
        cached_data = _get_cached_folders(user_id)
        if cached_data:
            logger.info(f"  [CACHE] ✅ Cache HIT - returning cached data")
            return {
                "folders": cached_data["folders"],
                "paths": cached_data["paths"]
            }
        else:
            logger.info(f"  [CACHE] ❌ Cache MISS - will scan Drive API")
    else:
        logger.info(f"  [CACHE] Cache disabled or no user_id - will scan Drive API")
    
    try:
        service = _get_drive_service(access_token)
        all_folders = []

        def _scan_folders_recursive(parent_id: Optional[str], parent_path: str, current_depth: int):
            """Recursively scan folders up to max_depth."""
            if current_depth > max_depth:
                return

            # Build query for folders at this level
            query = "mimeType='application/vnd.google-apps.folder' and trashed=false"
            if parent_id is None:
                query += " and 'root' in parents"
            else:
                query += f" and '{parent_id}' in parents"

            results = service.files().list(
                q=query,
                spaces="drive",
                fields="files(id, name)",
                pageSize=100
            ).execute()

            folders = results.get("files", [])
            for folder in folders:
                folder_path = f"{parent_path}/{folder['name']}" if parent_path else f"/{folder['name']}"
                all_folders.append({
                    "id": folder["id"],
                    "name": folder["name"],
                    "path": folder_path,
                    "depth": current_depth
                })

                # Recursively scan children
                _scan_folders_recursive(folder["id"], folder_path, current_depth + 1)

        # Start recursive scan from root
        _scan_folders_recursive(None, "", 0)

        # Extract just the paths for AI context
        paths = [folder["path"] for folder in all_folders]

        result = {
            "folders": all_folders,
            "paths": paths
        }
        
        # Store in cache if user_id provided and caching is enabled
        if use_cache and user_id:
            _set_cached_folders(user_id, result)
        
        return result

    except Exception as e:
        raise DriveError(f"Failed to scan Drive folders: {e}") from e


def ensure_folder_path(folder_path: str, access_token: Optional[str] = None) -> Tuple[str, bool]:
    """
    Ensure a folder path exists in Google Drive, creating folders as needed.

    Args:
        folder_path: Folder path like "Documents/2024/Receipts"
        access_token: Optional user OAuth access token

    Returns:
        Tuple of (folder_id, created_new_folder)
        - folder_id: ID of the final folder in the path
        - created_new_folder: True if any new folders were created

    Raises:
        DriveError: If folder creation fails
    """
    try:
        service = _get_drive_service(access_token)

        # Split path into components
        path_parts = [p.strip() for p in folder_path.split("/") if p.strip()]

        if not path_parts:
            raise DriveError("Empty folder path")

        # Track if we created any new folders
        created_new_folder = False

        # Traverse/create each folder in the path
        parent_id = None
        for folder_name in path_parts:
            # Check if folder exists
            folder_id = _find_folder(service, folder_name, parent_id)

            if not folder_id:
                # Create folder if it doesn't exist
                logger.info(f"Creating new folder: {folder_name}")
                folder_id = _create_folder(service, folder_name, parent_id)
                created_new_folder = True

            parent_id = folder_id

        return parent_id, created_new_folder

    except Exception as e:
        raise DriveError(f"Failed to ensure folder path: {e}") from e


def upload_file(
    file_data_uri: str,
    filename: str,
    folder_id: Optional[str] = None,
    mime_type: str = "image/jpeg",
    access_token: Optional[str] = None
) -> Tuple[str, str]:
    """
    Upload a file to Google Drive.

    Args:
        file_data_uri: Base64-encoded file data URI
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
        if not file_data_uri.startswith("data:"):
            raise DriveError("Invalid data URI format")

        parts = file_data_uri.split(",", 1)
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
