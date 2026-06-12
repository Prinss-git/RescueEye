/**
 * Firebase JS SDK initialization.
 * When VITE_FIREBASE_* env vars are absent the module exports no-op stubs so
 * the app runs without a Firebase project (demo / offline mode).
 */
import { initializeApp, FirebaseApp, getApps } from 'firebase/app'
import {
  getFirestore,
  Firestore,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

let app: FirebaseApp | null  = null
let db:  Firestore  | null   = null

if (isConfigured) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
  db  = getFirestore(app)
}

export { db, isConfigured }

/**
 * Subscribe to the latest N messages for an incident via Firestore onSnapshot.
 * Returns an unsubscribe function. Falls back to a no-op if Firebase is not
 * configured (caller should use polling fallback instead).
 */
export function subscribeToMessages(
  incidentId: string | null,
  limitCount: number,
  callback: (docs: DocumentData[]) => void
): () => void {
  if (!db) return () => {}

  const col = collection(db, 'messages')
  const q = incidentId
    ? query(col, orderBy('timestamp', 'asc'), limit(limitCount))
    : query(col, orderBy('timestamp', 'asc'), limit(limitCount))

  const unsub = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
    const msgs = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(m => !incidentId || (m as DocumentData)['incidentId'] === incidentId)
    callback(msgs)
  })

  return unsub
}

export type { DocumentData }
