# Firebase Setup — Doc AI Prototype

This guide walks you through creating a Firebase project and getting the minimum configuration needed for the prototype. Optional steps for Google Sign-In and Google Drive are included for later.

> **Note:** Only Firebase Authentication is required right now. Firestore setup (steps 3 and 6) is optional/out of scope unless you specifically want to experiment with a future searchable index.

## 1) Create Firebase Project
- Go to https://console.firebase.google.com → Add project.
- Name it (e.g., doc-ai-proto). You can disable Google Analytics for now.
- Wait for provisioning to complete.

## 2) Enable Authentication
- Firebase Console → Build → Authentication → Get started.
- Providers:
  - Minimal for now: enable Email/Password or Anonymous for quick dev.
  - Optional later: enable Google (requires OAuth setup in Google Cloud Console; see step 7).

## 3) (Optional) Create Firestore Database
- Firebase Console → Build → Firestore Database → Create database.
- Choose Production mode (recommended) or Test mode for quick dev.
- Pick a region close to you.

## 4) Get Firebase Web Config
- Project settings (gear icon) → General → Your apps → Add app → Web.
- App nickname (e.g., doc-ai-web-config) → Register app (skip hosting).
- Copy the config values (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId, measurementId).
- Put them into `frontend/.env` using these keys:
  - `EXPO_PUBLIC_FIREBASE_API_KEY=`
  - `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=`
  - `EXPO_PUBLIC_FIREBASE_PROJECT_ID=`
  - `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=`
  - `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=`
  - `EXPO_PUBLIC_FIREBASE_APP_ID=`
  - `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=` (optional)

## 5) Backend API Base (optional now)
- If/when your backend is running locally, set:
  - `EXPO_PUBLIC_API_BASE_URL=http://localhost:8000`
- If left empty, the app uses mocked `/analyze` responses.

## 6) (Optional) Starter Firestore Rules (per-user docs)
Use a per-user collection like `users/{uid}/docs/{docId}`. Example rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/docs/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Publish the rules after editing.

## 7) Google Sign-In & OAuth Setup
Required for Google Drive access and Google authentication.

### OAuth Consent Screen
- Google Cloud Console → APIs & Services → OAuth consent screen
  - User Type: External → Create
  - Fill in app info; add yourself under Test users while unverified
  - Add scopes: `openid`, `profile`, `email`, and `https://www.googleapis.com/auth/drive.file`

### Create OAuth Client IDs

**Web Client (Required):**
- Credentials → Create credentials → OAuth client ID → Web application
- Copy the client ID → `EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB` in `.env`
- Authorized JavaScript origins:
  - `https://auth.expo.io`
  - `https://auth.expo.dev`
- Authorized redirect URIs:
  - `https://auth.expo.io/@your-expo-username/doc-ai-proto`
  - `https://auth.expo.dev/@your-expo-username/doc-ai-proto`

**iOS Client (Required for Expo Go on iOS devices):**
- Credentials → Create credentials → OAuth client ID → iOS
- Bundle ID: `host.exp.Exponent` (this is Expo Go's bundle ID)
- Copy the iOS client ID → `EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS` in `.env`
- **Important:** The iOS client automatically gets a reverse client ID redirect URI in the format `com.googleusercontent.apps.XXXXX:/` which is used by the app

**Android Client (Optional, for Expo Go on Android):**
- Credentials → Create credentials → OAuth client ID → Android
- Package name: `host.exp.exponent`
- Get SHA-1 from your keystore
- Copy the Android client ID → `EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID` in `.env`

### Important Notes for Expo Go
- **Expo's auth proxy (`auth.expo.io`) does not work reliably with Expo Go on physical devices.** The callback fails with "Something went wrong trying to finish signing in."
- **Solution:** Use the iOS/Android native OAuth clients with their reversed client ID redirect URIs
- The app automatically uses the iOS reversed client ID format: `com.googleusercontent.apps.XXXXX:/`
- This scheme is registered in `app.json` to handle the OAuth callback

### Testing
- Once the IDs are in `.env`, restart Expo with `npx expo start -c`
- Open the app on your iOS device via Expo Go
- Tap **Test Google OAuth** on the Camera screen
- You should successfully receive an access token with the `drive.file` scope

## 8) Google Drive API (optional, for uploads)
- In the same Google Cloud project (linked to Firebase) → APIs & Services → Enable APIs.
- Enable “Google Drive API”.
- Ensure the scope `https://www.googleapis.com/auth/drive.file` is allowed on your OAuth consent screen.
- Env var already defaults to this scope in `frontend/.env.example`.

## 9) Wire Up Locally
- Copy `frontend/.env.example` to `frontend/.env` and fill in the Firebase config values.
- From the repo root:
  - `cd frontend && npm install && npx expo start`
- App uses mocked OCR/analyze/upload until you connect the backend and Google services.

## 10) What You Can Skip For Now
- Google OAuth client IDs (all three) if you’re not using Google Sign-In yet.
- Backend URL (`EXPO_PUBLIC_API_BASE_URL`) if you want to run fully mocked.

---

## Troubleshooting

### Metro/Expo Issues
- If Metro shows component registration errors, restart with cache clear: `npx expo start -c`
- After changing `app.json`, always restart Expo with cleared cache

### OAuth Issues
- **Error 400: invalid_request / redirect_uri mismatch:**
  - Verify the redirect URIs are correctly added in Google Cloud Console
  - For Expo Go on iOS: Ensure you created an iOS OAuth client with bundle ID `host.exp.Exponent`
  - The app uses the iOS reversed client ID format automatically

- **"Something went wrong trying to finish signing in":**
  - This means Expo's auth proxy callback failed
  - Solution: Use native iOS/Android OAuth clients instead of relying on the Web client + auth proxy
  - Make sure the reversed client ID scheme is registered in `app.json`

- **"Access blocked" errors:**
  - Add yourself as a Test user in OAuth consent screen
  - Verify all required scopes are added to the OAuth consent screen

- **Token not received:**
  - Check that `EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS` is set in `.env`
  - Verify the iOS client ID matches what's in Google Cloud Console
  - Ensure you're testing on an iOS device (not simulator) with Expo Go installed
