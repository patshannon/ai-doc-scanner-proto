# Environment Variables Configuration

This project uses different `.env` files for different environments:

## File Priority (highest to lowest)
1. `.env.local` - Local development (git-ignored, highest priority for `expo start`)
2. `.env.production` - Production builds (git-ignored, used by `expo export`)
3. `.env` - Default/fallback values (git-ignored)
4. `.env.example` - Template (committed to git)

## Setup

### For Local Development
1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Update `.env.local` with your local backend URL:
   ```
   EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
   ```

### For Production Deployment
1. Ensure `.env.production` exists with the production backend URL:
   ```
   EXPO_PUBLIC_API_BASE_URL=https://doc-ai-backend-935524565569.northamerica-northeast1.run.app
   ```
2. Run `npm run build:web` (this will use `.env.production` automatically)
3. Deploy with `firebase deploy --only hosting`

## Commands
- **Local development**: `npm run web` or `expo start --web` (uses `.env.local`)
- **Production build**: `npm run build:web` (uses `.env.production`)
- **Deploy**: `firebase deploy --only hosting`

## Important Notes
- **Never commit** `.env`, `.env.local`, or `.env.production` to git
- `.env.example` is the only env file that should be committed
- Expo loads environment files in the order listed above during `expo export`
- Metro cache can sometimes hold old values - use `--clear` flag or delete `.expo` folder if needed
