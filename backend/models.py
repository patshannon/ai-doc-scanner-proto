"""Request and response models for the API."""

from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class FolderInfo(BaseModel):
    """Model for Google Drive folder information."""
    id: str
    name: str
    path: str


class ProcessDocumentRequest(BaseModel):
    """Request model for document processing."""
    pdfData: str = Field(..., min_length=1, max_length=50000000)  # Base64 encoded PDF
    googleAccessToken: Optional[str] = Field(default=None, max_length=2048)
    skipUpload: Optional[bool] = Field(default=False)  # If true, analyze and suggest folders but don't upload
    selectedParentFolderId: Optional[str] = Field(default=None, max_length=1024)  # User-selected parent folder ID
    # User-edited values (if provided, skip AI analysis and use these instead)
    title: Optional[str] = Field(default=None, max_length=200)
    category: Optional[str] = Field(default=None, max_length=50)
    year: Optional[int] = Field(default=None, ge=1900, le=2100)

    class Config:
        extra = "forbid"


class ProcessDocumentResponse(BaseModel):
    """Response model for PDF document processing."""
    title: str
    category: str
    year: int
    inputTokens: int
    outputTokens: int
    estimatedCost: float
    driveFileId: Optional[str] = None
    driveUrl: Optional[str] = None
    # Folder suggestion fields (for smart organization)
    suggestedParentFolder: Optional[str] = None  # Name of suggested parent folder
    suggestedParentFolderId: Optional[str] = None  # Drive ID of suggested parent
    availableParentFolders: Optional[List[FolderInfo]] = None  # All available parent folders
    finalFolderPath: Optional[str] = None  # Complete path where file will be stored

    class Config:
        extra = "forbid"
