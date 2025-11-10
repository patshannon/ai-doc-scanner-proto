"""Request and response models for the API."""

from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class FolderInfo(BaseModel):
    """Model for Google Drive folder information."""
    id: str
    name: str
    path: str


class ProcessDocumentRequest(BaseModel):
    """Request model for PDF analysis (no upload)."""
    pdfData: str = Field(..., min_length=1, max_length=50000000)  # Base64 encoded PDF
    googleAccessToken: Optional[str] = Field(default=None, max_length=2048)
    selectedParentFolderId: Optional[str] = Field(default=None, max_length=1024)  # Optional user-selected parent folder

    class Config:
        extra = "forbid"


class ProcessDocumentResponse(BaseModel):
    """Response model for PDF analysis."""
    title: str
    category: str
    year: int
    inputTokens: int
    outputTokens: int
    estimatedCost: float
    # Folder suggestion fields (for smart organization)
    suggestedParentFolder: Optional[str] = None  # Name of suggested parent folder
    suggestedParentFolderId: Optional[str] = None  # Drive ID of suggested parent
    availableParentFolders: Optional[List[FolderInfo]] = None  # All available parent folders
    finalFolderPath: Optional[str] = None  # Complete path where file will be stored

    class Config:
        extra = "forbid"


class UploadDocumentRequest(BaseModel):
    """Request model for the final Drive upload."""
    pdfData: str = Field(..., min_length=1, max_length=50000000)
    googleAccessToken: Optional[str] = Field(default=None, max_length=2048)
    title: str = Field(..., min_length=1, max_length=200)
    category: str = Field(..., min_length=1, max_length=50)
    year: int = Field(..., ge=1900, le=2100)
    selectedParentFolderId: Optional[str] = Field(default=None, max_length=1024)

    class Config:
        extra = "forbid"


class UploadDocumentResponse(BaseModel):
    """Response model for Drive uploads."""
    driveFileId: Optional[str] = None
    driveUrl: Optional[str] = None
    finalFolderPath: Optional[str] = None

    class Config:
        extra = "forbid"
