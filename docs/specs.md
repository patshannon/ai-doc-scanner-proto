# 📄 MVP Plan — “Snap → Auto-Title → Upload to Google Drive”

**Frontend:** React Native (Expo)
**Backend:** Python (FastAPI)
**OCR:** On-device (Google ML Kit)

---

## 1. 🎯 Goal (MVP)

* Capture a photo of a **document** (invoice, receipt, contract, etc.).
* Run **on-device OCR** (Google ML Kit).
* Send extracted text to a **FastAPI backend**.
* Backend classifies document type, extracts key info, and generates:

  * **Type** (invoice, receipt, etc.)
  * **Title**
  * **Suggested folder path**
* User confirms → App uploads to **Google Drive** with metadata.
* Save structured document index in **Firestore** for search/filtering.

---

## 2. 🏗️ Architecture Overview

### **Client (Expo React Native)**

* Camera & preprocessing (crop, rotate, enhance)
* ML Kit OCR (on-device, offline)
* API call to `/analyze`
* Confirm & edit generated metadata
* Upload to Google Drive (`drive.file` scope)
* Write Firestore document record

### **Backend (Python + FastAPI)**

* `/analyze`: parse & classify OCR text → return metadata suggestion
* `/ensureFolderPath`: (stub for now; creates/returns folder)
* Firebase ID token verification
* Stateless API deployable on **Cloud Run**

### **Services**

* **Firebase Auth** — Google Sign-In
* **Firestore** — document metadata index
* **Google Drive API** — upload & folder organization
* **Google Cloud Run** — backend hosting

---

## 3. 📦 Data Contracts

### Request → `/analyze`

```json
{
  "ocrText": "string (full OCR text)",
  "exifDate": "2025-10-26T13:05:00-03:00",
  "thumbBase64": "data:image/jpeg;base64,...",
  "locale": "en-CA"
}
```

### Response ← `/analyze`

```json
{
  "docType": "invoice|receipt|contract|insurance|tax|medical|school|id|other",
  "title": "2025-10-26_Invoice_Acorn-Design_#8123",
  "date": "2025-10-26",
  "tags": ["finance","invoice","acorn-design"],
  "fields": {
    "invoiceNumber": "8123",
    "vendor": "Acorn Design",
    "total": 543.20,
    "currency": "CAD",
    "personOrOrg": null
  },
  "folderPath": "Documents/Invoices/2025",
  "confidence": 0.84
}
```

### Firestore document structure

```json
{
  "fileId": "drive-id",
  "name": "2025-10-26_Invoice_Acorn-Design_#8123.pdf",
  "docType": "invoice",
  "docDate": "2025-10-26",
  "tags": ["finance","invoice","acorn-design"],
  "fields": {
    "invoiceNumber": "8123",
    "vendor": "Acorn Design",
    "total": 543.20,
    "currency": "CAD"
  },
  "textHash": "sha256(ocrTextNormalized)",
  "confidence": 0.84,
  "createdAt": 173,
  "updatedAt": 173
}
```

---

## 4. 📱 Frontend — Expo React Native

**Key Packages**

* `expo-camera`, `expo-image-manipulator`, `expo-print`
* `@react-native-firebase/app`, `auth`, `firestore`
* Google Sign-In SDK
* `axios` or native `fetch`

**UI Flow**

1. **CameraScreen** → capture, crop, enhance
2. **ProcessingScreen** → ML Kit OCR → call `/analyze`
3. **ConfirmScreen** → show type/title/date → allow edits
4. **UploadScreen** → create PDF → upload to Drive
5. **DoneScreen** → success + open file link

---

## 5. ⚙️ Backend — Python (FastAPI)

**Endpoints**

* `POST /analyze` — classify + extract data + generate metadata
* `POST /ensureFolderPath` — (stub) return or create folder

**Directory Structure**

```
backend/
  app.py
  auth.py
  classify.py
  models.py
  requirements.txt
  Dockerfile
```

### `requirements.txt`

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
firebase-admin==6.6.0
google-api-python-client==2.146.0
google-cloud-firestore==2.17.0
python-dateutil==2.9.0.post0
rapidfuzz==3.9.7
```

### `models.py`

```python
from pydantic import BaseModel, Field
from typing import Optional, List, Literal

DocType = Literal["invoice","receipt","contract","id","insurance","tax","medical","school","other"]

class AnalyzeRequest(BaseModel):
    ocrText: str
    exifDate: Optional[str] = None
    thumbBase64: Optional[str] = None
    locale: Optional[str] = "en-CA"

class Fields(BaseModel):
    invoiceNumber: Optional[str] = None
    vendor: Optional[str] = None
    total: Optional[float] = None
    currency: Optional[str] = None
    personOrOrg: Optional[str] = None
    date: Optional[str] = None

class AnalyzeResponse(BaseModel):
    docType: DocType
    title: str
    date: Optional[str]
    tags: List[str] = Field(default_factory=list)
    fields: Fields
    folderPath: str
    confidence: float
```

### `auth.py`

```python
import firebase_admin
from firebase_admin import auth
from fastapi import HTTPException, Header

if not firebase_admin._apps:
    firebase_admin.initialize_app()

async def verify_bearer(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        return auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
```

### `classify.py`

```python
import re
from datetime import datetime

def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()

def classify(text_norm: str):
    t = text_norm.lower()
    rules = [
        ("invoice", ["invoice","total due","invoice no","amount due","terms"]),
        ("receipt", ["receipt","pos","thank you","change"]),
        ("insurance", ["policy","coverage","premium"]),
        ("tax", ["t4","tax year","assessment"]),
        ("contract", ["agreement","party","hereby"]),
    ]
    best, score = "other", 0.3
    for label, kws in rules:
        hits = sum(1 for kw in kws if kw in t)
        if hits:
            conf = min(0.95, 0.4 + 0.15 * hits)
            if conf > score:
                best, score = label, conf
    return best, score

def extract_invoice_number(text: str):
    m = re.search(r"invoice\s*(#|no\.?)\s*[:\-]?\s*([A-Za-z0-9\-]+)", text, re.I)
    return m.group(2) if m else None

def extract_total(text: str):
    money = re.findall(r"(\$|CAD|USD)?\s?(\d{1,3}(?:[ ,]\d{3})*|\d+)([.,]\d{2})", text)
    if not money: return None
    nums = [float("".join(m[1:]).replace(",", "")) for m in money]
    return max(nums) if nums else None

def extract_date(text: str):
    m = re.search(r"\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b", text)
    return m.group(0) if m else None

def extract_vendor(text: str):
    lines = text.splitlines()
    head = " | ".join(lines[:5])
    m = re.search(r"[A-Z][A-Za-z0-9&'’\-\s]{3,}", head)
    return m.group(0).strip() if m else None

def make_title(date, doc_type, vendor, inv_no):
    parts = [date or datetime.utcnow().strftime("%Y-%m-%d"), doc_type.capitalize()]
    if vendor: parts.append(vendor.replace(" ", "-"))
    if inv_no: parts.append(f"#{inv_no}")
    return "_".join(parts)[:80]

def estimate_confidence(base, fields_hit):
    return min(0.98, max(0.3, base + 0.1 * fields_hit))
```

### `app.py`

```python
from fastapi import FastAPI, Depends
from models import AnalyzeRequest, AnalyzeResponse, Fields
from auth import verify_bearer
from classify import (
    normalize, classify, extract_invoice_number,
    extract_total, extract_date, extract_vendor,
    make_title, estimate_confidence
)
from datetime import datetime

app = FastAPI(title="Doc AI Backend (FastAPI)")

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest, user=Depends(verify_bearer)):
    tnorm = normalize(req.ocrText)
    doc_type, base_conf = classify(tnorm)

    fields = Fields(
        invoiceNumber=extract_invoice_number(req.ocrText),
        total=extract_total(req.ocrText),
        vendor=extract_vendor(req.ocrText),
        date=extract_date(req.ocrText)
    )

    date = fields.date or (req.exifDate[:10] if req.exifDate else datetime.utcnow().strftime("%Y-%m-%d"))
    title = make_title(date, doc_type, fields.vendor, fields.invoiceNumber)
    tags = [doc_type] + ([fields.vendor.lower().replace(" ", "-")] if fields.vendor else [])
    folder_path = f"Documents/{doc_type.capitalize()}/{date[:4]}"
    confidence = estimate_confidence(base_conf, sum(bool(x) for x in [fields.vendor, fields.total, fields.invoiceNumber]))

    return AnalyzeResponse(
        docType=doc_type,
        title=title,
        date=date,
        tags=tags,
        fields=fields,
        folderPath=folder_path,
        confidence=round(confidence, 2)
    )
```

### `Dockerfile`

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
```

---

## 6. ☁️ Deployment (Cloud Run)

```bash
gcloud builds submit --tag gcr.io/$PROJECT_ID/doc-ai-python
gcloud run deploy doc-ai-python \
  --image gcr.io/$PROJECT_ID/doc-ai-python \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated=false \
  --set-env-vars FIREBASE_PROJECT_ID=$PROJECT_ID
```

---

## 7. 🔐 Auth & Permissions

* Firebase Google Sign-In → get **ID token**
* Backend verifies token via Firebase Admin SDK
* Client uploads to Drive using scope:
  `https://www.googleapis.com/auth/drive.file`
* Firestore rules: user can only write/read their own docs

---

## 8. 🔒 Privacy & Security

* OCR done **on-device** — no images sent to backend.
* Backend only receives **text** + minimal metadata.
* No OCR text logged server-side.
* Option: “Local-only parsing” toggle (skip backend completely).

---

## 9. 🧪 Acceptance Criteria

✅ OCR correctly extracts text from clear printed docs
✅ `/analyze` returns accurate doc type & sensible title
✅ Upload to Drive works and metadata saved
✅ Firestore record created with same metadata
✅ Entire flow under 10 seconds for happy path
✅ No sensitive data exposure

---

## 10. 🗓️ Timeline

| Day       | Task                                      |
| --------- | ----------------------------------------- |
| **Day 1** | Camera + OCR pipeline                     |
| **Day 2** | `/analyze` backend + metadata generation  |
| **Day 3** | Confirm UI + Drive upload                 |
| **Day 4** | Firestore integration + cleanup + testing |

---

## 11. 🧩 Post-MVP Features

### ✨ Smart Folder Suggestion (Deferred)

**Idea:**
Before creating a new folder like `Documents/Invoices/2025`, check Drive for similar existing folders (e.g. `Finance/Bills/2025`) using fuzzy matching.

**Why deferred:**

* Requires Drive folder indexing + caching
* Adds API cost and complexity
* Doesn’t affect core MVP value

**Planned for V2:**

* Use `RapidFuzz` or small embedding model for string similarity
* Suggest reuse if match score ≥ 85
* Simple UX: “Use existing folder Finance/Invoices/2025?”
* Cache folder list in Firestore per user

---

## 12. ✅ Definition of Done (MVP)

User can:

1. Take a photo of a document
2. See a generated title, type, and folder
3. Confirm and upload to Drive
4. Find it in Drive under the correct folder
5. See it indexed in Firestore

All **without manual typing** in the happy path.
