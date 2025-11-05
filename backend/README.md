# AI Document Scanner - Backend

A FastAPI-based backend service for processing PDF documents with AI-powered categorization and automatic Google Drive organization.

## Overview

This backend provides a single endpoint that handles the complete document processing workflow:
1. Extracts text from PDF documents
2. Uses Google's Gemini 2.5 Flash AI to generate relevant titles and categories
3. Automatically uploads to Google Drive with organized folder structure

## Features

- **AI-Powered Classification**: Uses Gemini 2.5 Flash for intelligent document analysis
- **Automatic Organization**: Files are organized by category and year in Google Drive
- **PDF Text Extraction**: Extracts text content from PDF documents
- **Firebase Authentication**: Secure user authentication
- **Google Drive Integration**: Seamless upload to user's Google Drive
- **Docker Support**: Easy deployment with containerization

## API Endpoints

### Health Check
- **GET** `/healthz` - Health check endpoint

### Process Document
- **POST** `/process-document` - Process PDF and upload to Google Drive
  - Extracts text from PDF
  - Generates title and category using AI
  - Uploads to Google Drive with organized folder structure

See [PROCESS_DOCUMENT_API.md](./PROCESS_DOCUMENT_API.md) for detailed API documentation.

## Project Structure

```
backend/
├── app.py                          # FastAPI application entry point
├── auth.py                         # Firebase authentication
├── drive.py                        # Google Drive API integration
├── pdf_processor.py                # PDF processing and Gemini AI integration
├── models.py                       # Pydantic request/response models
├── requirements.txt                # Python dependencies
├── Dockerfile                      # Docker container configuration
├── .env.example                    # Environment variables template
├── PROCESS_DOCUMENT_API.md         # Detailed API documentation
├── test_process_document.py        # Test script for the endpoint
└── README.md                       # This file
```

## Setup

### Prerequisites

- Python 3.11+
- Google Cloud Platform account
- Firebase project
- Gemini API key

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Firebase configuration
FIREBASE_PROJECT_ID=your-project-id

# Google Drive (optional, for service account uploads)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Gemini API (required)
GEMINI_API_KEY=your-gemini-api-key

# Development only - bypass Firebase auth
FIREBASE_SKIP_AUTH=1
```

### Get API Keys

1. **Gemini API Key**:
   - Visit https://makersuite.google.com/app/apikey
   - Create a new API key
   - Add to `.env` file

2. **Firebase Setup**:
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Authentication
   - Add project ID to `.env` file

3. **Google Drive API** (Optional):
   - Create a service account in Google Cloud Console
   - Download service account JSON
   - Enable Google Drive API
   - Add path to `.env` file

### Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the server:
```bash
python app.py
```

The server will start on `http://localhost:8000`.

### Docker

Build and run with Docker:

```bash
# Build
docker build -t doc-scanner-backend .

# Run
docker run -p 8000:8000 \
  -e GEMINI_API_KEY=your-key \
  -e FIREBASE_SKIP_AUTH=1 \
  doc-scanner-backend
```

## Testing

Run the test script to verify the endpoint:

```bash
python test_process_document.py
```

This creates a sample PDF invoice and sends it to the `/process-document` endpoint.

## Document Categories

The AI can classify documents into the following categories:

- Invoice
- Receipt
- Contract
- Insurance
- Tax
- Medical
- School
- ID
- Personal
- Business
- Legal
- Financial
- Other

## Folder Structure in Google Drive

Documents are automatically organized:

```
Documents/
  └── {Category}/
      └── {Year}/
          └── {Title}.pdf
```

Example:
```
Documents/
  └── Invoice/
      └── 2024/
          └── Web_Development_Services.pdf
```

## Development

### Local Development

For local development without Firebase authentication:

```bash
# Set in .env
FIREBASE_SKIP_AUTH=1
```

### Adding New Features

The codebase is modular:

- `app.py` - Add new endpoints here
- `models.py` - Add new request/response models
- `pdf_processor.py` - Enhance PDF processing logic
- `drive.py` - Modify Google Drive integration

## Deployment

### Cloud Run (Recommended)

The backend is optimized for Google Cloud Run deployment:

1. Build and push Docker image:
```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT/doc-scanner-backend
```

2. Deploy to Cloud Run:
```bash
gcloud run deploy doc-scanner-backend \
  --image gcr.io/YOUR_PROJECT/doc-scanner-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your-key,FIREBASE_PROJECT_ID=your-project
```

See `deploy.sh` for automated deployment script.

## Architecture

```
┌─────────────┐
│   Client    │
│  (Mobile/   │
│    Web)     │
└──────┬──────┘
       │ POST /process-document
       │ {pdfData, googleAccessToken}
       ↓
┌──────────────────────────────────────┐
│        FastAPI Backend               │
│  ┌──────────────────────────────┐   │
│  │  1. Extract text (PyPDF2)    │   │
│  └──────────┬───────────────────┘   │
│             ↓                        │
│  ┌──────────────────────────────┐   │
│  │  2. AI Analysis (Gemini)     │   │
│  │     - Generate title         │   │
│  │     - Determine category     │   │
│  └──────────┬───────────────────┘   │
│             ↓                        │
│  ┌──────────────────────────────┐   │
│  │  3. Create folder structure  │   │
│  └──────────┬───────────────────┘   │
│             ↓                        │
│  ┌──────────────────────────────┐   │
│  │  4. Upload to Google Drive   │   │
│  └──────────────────────────────┘   │
└──────────────────────────────────────┘
                │
                ↓
        ┌───────────────┐
        │ Google Drive  │
        │ (Organized)   │
        └───────────────┘
```

## Dependencies

- **FastAPI** - Modern web framework
- **Uvicorn** - ASGI server
- **Firebase Admin** - Authentication
- **Google API Client** - Drive API integration
- **Google Generative AI** - Gemini API client
- **PyPDF2** - PDF text extraction
- **Reportlab** - Test PDF generation
- **Requests** - HTTP client for testing

## Troubleshooting

### Common Issues

1. **"GEMINI_API_KEY environment variable is not set"**
   - Make sure `.env` file exists with valid API key

2. **"Failed to upload file: Insufficient Permission"**
   - Check Google Drive API is enabled
   - Verify service account has permissions
   - Ensure user OAuth token is valid

3. **"PDF text extraction failed"**
   - Ensure PDF is not corrupted
   - Some scanned PDFs may need OCR preprocessing

4. **Port already in use**
   - Change port in `app.py` or use: `uvicorn app:app --port 8001`

## Contributing

This is a prototype project. When adding features:
- Keep the code simple and readable
- Add appropriate error handling
- Update documentation
- Test thoroughly

## License

This is a prototype project for demonstration purposes.
