import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

const hasRequiredConfig =
  Boolean(firebaseConfig.apiKey) &&
  Boolean(firebaseConfig.authDomain) &&
  Boolean(firebaseConfig.projectId) &&
  Boolean(firebaseConfig.appId);

if (!hasRequiredConfig) {
  // eslint-disable-next-line no-console
  console.warn('Firebase is not fully configured. Check VITE_FIREBASE_* env vars.');
}

let firebaseAuth: ReturnType<typeof getAuth> | null = null;
try {
  if (hasRequiredConfig) {
    const app = initializeApp(firebaseConfig);
    firebaseAuth = getAuth(app);
  }
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('Firebase initialization failed:', err);
}

export { firebaseAuth };
