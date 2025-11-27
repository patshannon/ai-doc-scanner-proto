#!/usr/bin/env bash
set -euo pipefail

# Minimal Cloud Run deployment for the backend.
# - Builds the Docker image locally using the Dockerfile next to this script.
# - Pushes to gcr.io and deploys to Cloud Run in the requested region.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTEXT_DIR="${SCRIPT_DIR}"

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
if [ -z "${PROJECT_ID}" ] || [ "${PROJECT_ID}" = "(unset)" ]; then
  echo "Error: PROJECT_ID not set and gcloud project not configured." >&2
  exit 1
fi

IMAGE="gcr.io/${PROJECT_ID}/doc-ai-backend"
REGION="${REGION:-northamerica-northeast1}"

# Preflight checks
if [ ! -f "${CONTEXT_DIR}/Dockerfile" ]; then
  echo "Error: Dockerfile not found at ${CONTEXT_DIR}/Dockerfile" >&2
  exit 1
fi
if [ ! -f "${CONTEXT_DIR}/requirements.txt" ]; then
  echo "Error: requirements.txt not found at ${CONTEXT_DIR}/requirements.txt" >&2
  exit 1
fi

echo "Configuring Docker to authenticate with gcr.io" >&2
gcloud auth configure-docker --quiet

echo "Verifying Docker daemon is running" >&2
if ! docker info >/dev/null 2>&1; then
  echo "Error: Cannot connect to Docker daemon. Start Docker Desktop (or your Docker engine) and retry." >&2
  echo "Hint: On macOS, install/start Docker Desktop, then run: 'docker info' to verify." >&2
  exit 1
fi

echo "Ensuring Docker Buildx is available" >&2
if ! docker buildx version >/dev/null 2>&1; then
  echo "Error: Docker Buildx is not available. Update Docker Desktop to a recent version." >&2
  exit 1
fi

# Create and use a builder if none is configured
if ! docker buildx inspect builder >/dev/null 2>&1; then
  docker buildx create --name builder --use >/dev/null
fi

echo "[Local buildx] Building linux/amd64 image and pushing: ${IMAGE}" >&2
docker buildx build \
  --platform linux/amd64 \
  -t "${IMAGE}" \
  --push \
  "${CONTEXT_DIR}"

echo "Deploying to Cloud Run in region: ${REGION}" >&2

# Load GEMINI_API_KEY from .env if it exists
if [ -f "${CONTEXT_DIR}/.env" ]; then
  export $(grep -v '^#' "${CONTEXT_DIR}/.env" | grep GEMINI_API_KEY | xargs)
fi

if [ -z "${GEMINI_API_KEY:-}" ]; then
  echo "Warning: GEMINI_API_KEY not set. Backend may not function correctly." >&2
fi

gcloud run deploy doc-ai-backend \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --allow-unauthenticated \
  --set-env-vars FIREBASE_PROJECT_ID=doc-ai-proto \
  --set-env-vars FIREBASE_SKIP_AUTH=true \
  --set-env-vars GEMINI_API_KEY="${GEMINI_API_KEY:-}"

echo "Done. If successful, set EXPO_PUBLIC_API_BASE_URL to the service URL." >&2
