"""FastAPI application entrypoint."""

from typing import Any, Dict, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

import auth
import classify
from models import (
    AnalyzeRequest,
    AnalyzeResponse,
    EnsureFolderPathRequest,
    EnsureFolderPathResponse,
    Fields,
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
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(
    request: AnalyzeRequest,
    _: Dict[str, Any] = Depends(require_user),
) -> AnalyzeResponse:
    doc_type, base_confidence, _ = classify.classify_document(request.ocrText)

    vendor = classify.extract_vendor(request.ocrText)
    invoice_number = classify.extract_invoice_number(request.ocrText)
    total, currency = classify.extract_total_and_currency(request.ocrText)
    person_or_org = classify.extract_person_or_org(request.ocrText)
    extracted_date = classify.extract_date(request.ocrText)
    document_date = classify.resolve_date(extracted_date, request.exifDate)

    title = classify.make_title(document_date, doc_type, vendor, invoice_number)
    tags = classify.build_tags(doc_type, vendor)
    folder_path = classify.build_folder_path(doc_type, document_date)
    confidence = classify.estimate_confidence(
        base_confidence,
        {
            "vendor": vendor,
            "invoiceNumber": invoice_number,
            "total": total,
            "date": document_date,
            "personOrOrg": person_or_org,
        },
    )

    fields = Fields(
        invoiceNumber=invoice_number,
        vendor=vendor,
        total=total,
        currency=currency,
        personOrOrg=person_or_org,
        date=document_date,
    )

    return AnalyzeResponse(
        docType=doc_type,
        title=title,
        date=document_date,
        tags=tags,
        fields=fields,
        folderPath=folder_path,
        confidence=confidence,
    )


@app.post("/ensureFolderPath", response_model=EnsureFolderPathResponse)
def ensure_folder_path(
    request: EnsureFolderPathRequest,
    _: Dict[str, Any] = Depends(require_user),
) -> EnsureFolderPathResponse:
    return EnsureFolderPathResponse(folderPath=request.folderPath, status="stub")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
