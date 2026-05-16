import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, onSnapshot, getDocs, addDoc, getDocFromServer, serverTimestamp, orderBy, limit, arrayUnion, enableIndexedDbPersistence } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);

// Use initializeFirestore with long polling to bypass potential WebSocket restrictions
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId || '(default)');

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled
    // in one tab at a time.
    console.warn('Firestore persistence failed: Multiple tabs open');
  } else if (err.code == 'unimplemented') {
    // The current browser does not support all of the
    // features required to enable persistence
    console.warn('Firestore persistence failed: Browser not supported');
  }
});

export const auth = getAuth(app);

// Set persistence to local
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Auth persistence error:", err);
});

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Error handling for Firestore operations
export enum FirestoreOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

/**
 * Robustly stringify objects that may contain circular references
 */
export function circularSafeStringify(obj: any, replacer?: (key: string, value: any) => any, indent: number = 2): string {
  const cache = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        return "[Circular]";
      }
      cache.add(value);
    }

    // Default cleanup for common circular/internal props in Firebase objects
    if (key === 'src' || key === 'target' || key === '_firestore' || key === 'firestore' || key.startsWith('_') || key.startsWith('$')) return undefined;

    if (replacer) return replacer(key, value);
    
    return value;
  }, indent);
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: FirestoreOperation;
  path: string | null;
  isQuotaExceeded: boolean;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

/**
 * Deeply clean an object by removing undefined values, which Firestore does not support.
 */
export function sanitizeData(data: any): any {
  if (data === null || data === undefined) return null;
  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }
  if (typeof data === 'object') {
    const clean: any = {};
    Object.keys(data).forEach(key => {
      const val = data[key];
      if (val !== undefined) {
        clean[key] = sanitizeData(val);
      }
    });
    return clean;
  }
  return data;
}

export function handleFirestoreError(error: unknown, operationType: FirestoreOperation, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isQuotaExceeded = errorMessage.toLowerCase().includes('quota') || errorMessage.includes('8') || errorMessage.includes('Resource exhausted');

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    operationType,
    path,
    isQuotaExceeded,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
  }
  
  if (isQuotaExceeded) {
    console.error('CRITICAL: Firestore Quota Exceeded. The app will have limited functionality until the quota resets.');
  }

  let safeErrInfo: any;
  try {
    const jsonStr = circularSafeStringify(errInfo);
    safeErrInfo = JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to safely stringify error info:", e);
    safeErrInfo = {
      error: errorMessage,
      operationType,
      path,
      isQuotaExceeded,
      authInfo: { userId: auth.currentUser?.uid }
    };
  }

  console.error('Firestore Error: ', safeErrInfo);
  throw new Error(circularSafeStringify(safeErrInfo));
}

// Test connection
async function testConnection() {
  try {
    // Only attempt to read a small amount to check connectivity
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful.");
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    if (errorMsg.toLowerCase().includes('quota') || errorMsg.includes('8') || errorMsg.includes('Resource exhausted')) {
      console.warn("Firestore Quota Limit Reached. Connection test bypassed.");
      return; // Silent bypass for quota as it's a known state
    }
    
    console.error("Firestore connection test failed:", error instanceof Error ? error.message : String(error));
    if(errorMsg.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. This often happens if the database ID or project ID is incorrect, or if the database is not provisioned in your region.");
    }
  }
}
testConnection();

export { signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, onSnapshot, getDocs, addDoc, serverTimestamp, orderBy, limit, arrayUnion };
