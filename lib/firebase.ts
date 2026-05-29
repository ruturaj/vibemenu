import * as admin from "firebase-admin";

let initialized = false;
let initError: string | null = null;

function init(): void {
  if (initialized || admin.apps.length > 0) {
    initialized = true;
    return;
  }

  const projectIdEnv = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY?.trim();
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const bucket = process.env.FIREBASE_STORAGE_BUCKET?.trim();

  try {
    if (credentialsPath) {
      // Application Default Credentials: SDK reads GOOGLE_APPLICATION_CREDENTIALS automatically.
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        storageBucket: bucket
      });
    } else if (projectIdEnv && clientEmail && privateKeyRaw) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectIdEnv,
          clientEmail,
          privateKey: privateKeyRaw.replace(/\\n/g, "\n")
        }),
        storageBucket: bucket
      });
    } else if (process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT || process.env.FUNCTION_TARGET) {
      // Running on Google Cloud (App Hosting / Cloud Run / Functions): use runtime service account via ADC.
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        storageBucket: bucket
      });
    } else {
      initError =
        "Firebase env vars missing. Set GOOGLE_APPLICATION_CREDENTIALS (path to JSON) or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.";
      return;
    }
    initialized = true;
  } catch (err) {
    initError = err instanceof Error ? err.message : String(err);
  }
}

export function isFirestoreEnabled(): boolean {
  init();
  return initialized && admin.apps.length > 0;
}

export function firestoreInitError(): string | null {
  init();
  return initError;
}

export function getDb(): admin.firestore.Firestore | null {
  if (!isFirestoreEnabled()) return null;
  return admin.firestore();
}

export function getStorageBucket(): ReturnType<admin.storage.Storage["bucket"]> | null {
  if (!isFirestoreEnabled()) return null;
  try {
    return admin.storage().bucket();
  } catch {
    return null;
  }
}

export { admin };
