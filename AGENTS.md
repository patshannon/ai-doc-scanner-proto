# Repository Guidelines

## Project Structure & Module Organization
- `frontend/` — Client app (JavaScript). Add `package.json`, `src/`, and initial screens as you scaffold Expo.
- `backend/` — Server app (Python). Add `requirements.txt`, `app/`, and an entrypoint (e.g., `app.py` or `main.py`).
- `docs/` — Product and technical notes. See `docs/specs.md` for context.
- `README.md` — Keep quickstart instructions up to date.

## Build and Development Commands
- Frontend (prototype):
  - `cd frontend && npm install && npx expo start` — Start Expo dev server.
- Backend (prototype):
  - `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt` — Setup.
  - `uvicorn app:app --reload` or `python app.py` — Run locally.

## Coding Style & Naming Conventions
- Frontend: plain JavaScript (no TypeScript). 2‑space indent. Keep semicolon and quote style consistent within files. No linters/formatters configured.
- Backend: simple Python. 4‑space indent. Follow common sense readability. No linters/formatters configured.
- Naming: web files `kebab-case`, Python modules `snake_case`, classes `PascalCase`, constants `UPPER_SNAKE_CASE`.
- Keep functions small; prefer utilities in `frontend/src/lib/` and `backend/app/services/`.

## Testing Guidelines
- No automated tests for the prototype. Do manual checks:
  - Happy path: capture → OCR → `/analyze` → confirm → upload → Firestore.
  - Edge cases: low‑light image, missing totals, non‑invoice text.

## Commit & Pull Request Guidelines
- Use clear, action‑oriented commit messages (Conventional Commits optional).
- PRs include a concise description, linked issues (if any), and screenshots for UI changes.
- Keep PRs focused and reviewable. Update `README.md` if setup or behavior changes.

## Security & Configuration Tips
- Store secrets in `.env` (not committed). Provide `frontend/.env.example` and `backend/.env.example`.
- Avoid logging OCR text or PII; log only minimal diagnostics.

## Agent-Specific Instructions
- Read `docs/specs.md` before changes and align with `docs/frontend-spec.md` and `docs/backend-spec.md`.
- Touch only relevant files; avoid broad refactors. Add minimal, focused docs with each change (no tests in prototype).
