import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parsePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n");
}

function getFirebaseApp() {
  if (getApps().length > 0) return getApps()[0];

  return initializeApp({
    credential: cert({
      projectId: requiredEnv("FIREBASE_PROJECT_ID"),
      clientEmail: requiredEnv("FIREBASE_CLIENT_EMAIL"),
      privateKey: parsePrivateKey(requiredEnv("FIREBASE_PRIVATE_KEY")),
    }),
    storageBucket: requiredEnv("FIREBASE_STORAGE_BUCKET"),
  });
}

export function getFirebaseServices() {
  const app = getFirebaseApp();
  return {
    db: getFirestore(app),
    bucket: getStorage(app).bucket(),
  };
}
