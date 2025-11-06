"""Request and response models for the API."""

from typing import Optional

from pydantic import BaseModel, Field


class ProcessDocumentRequest(BaseModel):
    """Request model for document processing."""
    pdfData: str = Field(..., min_length=1, max_length=50000000)  # Base64 encoded PDF
    googleAccessToken: Optional[str] = Field(default=None, max_length=2048)

    class Config:
        extra = "forbid"


class ProcessDocumentResponse(BaseModel):
    """Response model for PDF document processing."""
    title: str
    category: str
    inputTokens: int
    outputTokens: int
    estimatedCost: float

    class Config:
        extra = "forbid"
