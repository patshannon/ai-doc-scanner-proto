from typing import List, Optional

from pydantic import BaseModel, Field


class Fields(BaseModel):
    invoiceNumber: Optional[str] = Field(default=None, max_length=64)
    vendor: Optional[str] = Field(default=None, max_length=120)
    total: Optional[float] = Field(default=None, ge=0)
    currency: Optional[str] = Field(default=None, max_length=8)
    personOrOrg: Optional[str] = Field(default=None, max_length=120)
    date: Optional[str] = Field(default=None, max_length=32)

    class Config:
        extra = "forbid"


class AnalyzeRequest(BaseModel):
    ocrText: str = Field(..., min_length=1, max_length=20000)
    exifDate: Optional[str] = Field(default=None, max_length=32)
    thumbBase64: Optional[str] = Field(default=None, max_length=100000)
    locale: str = Field(default="en-CA", min_length=2, max_length=10)

    class Config:
        extra = "forbid"


class AnalyzeResponse(BaseModel):
    docType: str
    title: str
    date: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    fields: Fields
    folderPath: str
    confidence: float = Field(..., ge=0, le=1)

    class Config:
        extra = "forbid"


class EnsureFolderPathRequest(BaseModel):
    folderPath: str = Field(..., min_length=1, max_length=256)

    class Config:
        extra = "forbid"


class EnsureFolderPathResponse(BaseModel):
    folderPath: str
    status: str = "stub"

    class Config:
        extra = "forbid"
