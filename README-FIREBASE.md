# VELA Firebase setup

This project keeps working in local-only mode until Firebase is configured.

## 1. Create the Firebase project

1. Create a Firebase project.
2. Enable **Authentication > Email/Password**.
3. Create a **Cloud Firestore** database.
4. Enable billing for Cloud Functions.
5. Add a Web App and paste its public config into `assets/js/firebase-config.js`.

## 2. Install and deploy

```powershell
npm install -g firebase-tools
firebase login
firebase use --add
firebase functions:secrets:set VELA_ADMIN_PASSCODE
cd functions
npm install
cd ..
firebase deploy
```

The admin passcode is stored only in Google Secret Manager. Never add it to frontend files.

Create redeem codes in Firestore under `redeemCodes/{UPPERCASE_CODE}`:

```json
{
  "points": 100,
  "active": true
}
```

## Security model

- Users sign in with email/password.
- Users can write only their private preferences/history document.
- Points, purchases, redeem codes and feedback approval run through Cloud Functions.
- The admin enters only the secret passcode. A Cloud Function validates it and issues a short-lived Firebase custom token with the `admin` claim.
- Five failed admin attempts from the same IP lock that IP for 15 minutes.
- Redemption codes live in Firestore, not in public frontend source.

For stronger bot protection, enable Firebase App Check for the web app and then enable
`enforceAppCheck` on the callable functions.

## Anti-farming defaults

- Daily check-in: once per day.
- Daily card reading: at most twice per day.
- Other readings: at most three rewarded readings per day.
- Share: once per day.
- Feedback submission reward: once per day.
- Event rewards and achievements: idempotent.

These limits are defined in `functions/index.js`.
