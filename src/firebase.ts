import { initializeApp } from 'firebase/app'
import type { FirebaseApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import type { FirebaseStorage } from 'firebase/storage'
import { getAuth } from 'firebase/auth'
import type { Auth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

/** True when the required Firebase env vars are present. */
export const firebaseEnabled = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
)

const app: FirebaseApp | null = firebaseEnabled
  ? initializeApp({
      apiKey: firebaseConfig.apiKey!,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId!,
      storageBucket: firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId!,
    })
  : null

export const db: Firestore | null = app ? getFirestore(app) : null
export const storage: FirebaseStorage | null = app ? getStorage(app) : null
export const auth: Auth | null = app ? getAuth(app) : null

// Fail fast instead of the SDK's default multi-minute retry loop, so the UI
// can tell the user quickly when Storage isn't provisioned or rules deny access
if (storage) {
  storage.maxUploadRetryTime = 15_000
  storage.maxOperationRetryTime = 10_000
}

export const MESSAGES_COLLECTION = 'noc_messages'
export const TASKS_COLLECTION = 'noc_tasks'
export const SHIFT_STATUS_COLLECTION = 'noc_shift_status'
export const OPERATORS_COLLECTION = 'noc_operators'
