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
    googleAccessToken: str = Field(..., min_length=1, max_length=2048)  # Required for Drive folder scanning

    class Config:
        extra = "forbid"


class ProcessDocumentResponse(BaseModel):
    """Response model for PDF analysis with context-aware folder suggestion."""
    title: str
    category: str
    year: int
    inputTokens: int
    outputTokens: int
    estimatedCost: float
    # AI-suggested folder path based on existing Drive structure
    suggestedPath: str  # Full folder path (e.g., '/Work/Resumes/2025')
    pathReason: str  # Brief explanation of why this path was chosen
    isExistingPath: bool  # True if path exists in Drive, False if creating new

    class Config:
        extra = "forbid"


class UploadDocumentRequest(BaseModel):
    """Request model for the final Drive upload."""
    pdfData: str = Field(..., min_length=1, max_length=50000000)
    googleAccessToken: str = Field(..., min_length=1, max_length=2048)
    title: str = Field(..., min_length=1, max_length=200)
    category: str = Field(..., min_length=1, max_length=50)
    year: int = Field(..., ge=1900, le=2100)
    confirmedPath: str = Field(..., min_length=1, max_length=500)  # User-confirmed folder path

    class Config:
        extra = "forbid"


class UploadDocumentResponse(BaseModel):
    """Response model for Drive uploads."""
    driveFileId: Optional[str] = None
    driveUrl: Optional[str] = None
    finalFolderPath: Optional[str] = None

    class Config:
        extra = "forbid"
