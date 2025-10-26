# Backend Spec — FastAPI

## Scope & Responsibilities
- Stateless API that classifies OCR text, extracts fields, and returns suggested metadata. Verifies Firebase ID tokens. Deployable to Cloud Run.

## Endpoints
- POST `/analyze`: accepts OCR text and returns `{ docType, title, date, tags, fields, folderPath, confidence }`.
- POST `/ensureFolderPath` (stub): returns or creates Drive folder path (V2-friendly).

## Models (Pydantic)
- `AnalyzeRequest`: `ocrText`, `exifDate?`, `thumbBase64?`, `locale?` (default `en-CA`).
- `Fields`: `invoiceNumber?`, `vendor?`, `total?`, `currency?`, `personOrOrg?`, `date?`.
- `AnalyzeResponse`: `docType`, `title`, `date?`, `tags[]`, `fields`, `folderPath`, `confidence`.

## Classification & Extraction
- Normalize whitespace, lowercase.
- Heuristic rules to infer `docType` (invoice/receipt/contract/insurance/tax/medical/school/id/other).
- Extractors: invoice number, total amount, ISO date (YYYY-MM-DD), vendor from header lines.
- Title format: `YYYY-MM-DD_<DocType>_<Vendor?>_#<Invoice?>`, max 80 chars.
- Confidence: base from type + bump per matched field (capped).

## Auth (Firebase)
- Require `Authorization: Bearer <idToken>`; verify with Firebase Admin SDK.
- Return 401 for missing/invalid tokens.

## Directory Structure
```
backend/
  app.py
  auth.py
  classify.py
  models.py
  requirements.txt
  Dockerfile
```

## Dependencies (`requirements.txt`)
```
fastapi==0.115.0
uvicorn[standard]==0.30.6
firebase-admin==6.6.0
google-api-python-client==2.146.0
google-cloud-firestore==2.17.0
python-dateutil==2.9.0.post0
rapidfuzz==3.9.7
```

## Local Development
- Create venv and install: `python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`.
- Run: `uvicorn app:app --reload`.
- Env: `FIREBASE_PROJECT_ID`, optional GCP creds for Drive/Firestore when integrating.

## Deployment (Cloud Run)
```
gcloud builds submit --tag gcr.io/$PROJECT_ID/doc-ai-python
gcloud run deploy doc-ai-python \
  --image gcr.io/$PROJECT_ID/doc-ai-python \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated=false \
  --set-env-vars FIREBASE_PROJECT_ID=$PROJECT_ID
```

## Security & Privacy
- Do not log `ocrText` or PII; log only hashes/diagnostics.
- Validate input sizes; set request body limits.
- CORS restricted to app origins in production.

## Testing
- No automated tests for the prototype. Do manual checks of `/analyze` with sample OCR text and verify suggested metadata looks reasonable.
