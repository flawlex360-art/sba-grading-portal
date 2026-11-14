import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  initializeFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs,
  query,
  where,
  enableIndexedDbPersistence
} from 'firebase/firestore';

// Default / fallback Firebase Config
// Teachers can override this by pasting their configuration in the Settings Dashboard
const getFirebaseConfig = () => {
  const localConfig = localStorage.getItem('firebase_config');
  if (localConfig) {
    try {
      return JSON.parse(localConfig);
    } catch (e) {
      console.error("Invalid stored Firebase Config", e);
    }
  }

  // Optional environment variables fallback
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
  };
};

const firebaseConfig = getFirebaseConfig();

let app = null;
let auth = null;
let db = null;

// Initialize Firebase if we have a config
const isConfigValid = (cfg) => cfg && cfg.apiKey && cfg.projectId;

if (isConfigValid(firebaseConfig)) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = initializeFirestore(app, {
      experimentalForceLongPolling: true
    });
    
    // Enable local caching/offline persistence for Firestore
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn("Firestore persistence failed (multiple tabs open)");
      } else if (err.code === 'unimplemented') {
        console.warn("Firestore persistence is not supported by this browser");
      }
    });
  } catch (e) {
    console.error("Error initializing primary Firebase app:", e);
  }
}

/**
 * Calls the server-side Firebase Admin Auth endpoint (`/api/manage-auth-user`) using the
 * signed-in administrator's Firebase ID Token. Returns `{ fallbackToClient: true }` when the
 * server endpoint or Admin SDK service account is unavailable (e.g., local Vite dev without API).
 */
const callAdminAuthApi = async (payload) => {
  const activeUser = auth?.currentUser;
  if (!activeUser || typeof activeUser.getIdToken !== 'function') {
    return { fallbackToClient: true, reason: 'NO_ACTIVE_SESSION' };
  }

  let res;
  try {
    const idToken = await activeUser.getIdToken();
    res = await fetch('/api/manage-auth-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (networkErr) {
    return { fallbackToClient: true, reason: 'NETWORK_ERROR', serverMessage: networkErr?.message };
  }

  const contentType = String(res.headers?.get?.('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return { fallbackToClient: true, reason: 'NON_JSON_ENDPOINT' };
  }

  const data = await res.json().catch(() => null);
  if (
    res.status === 404 ||
    res.status === 503 ||
    data?.code === 'SERVICE_NOT_CONFIGURED'
  ) {
    return {
      fallbackToClient: true,
      reason: data?.code || `HTTP_${res.status}`,
      serverMessage: data?.error || '',
    };
  }

  if (!res.ok || !data?.ok) {
    const err = new Error(data?.error || `Authentication service failed (${res.status}).`);
    err.code = data?.code || `http/${res.status}`;
    throw err;
  }

  return { fallbackToClient: false, data };
};

/**
 * Creates a new teacher or admin account in Firebase Authentication.
 * Prefers the server-side `/api/manage-auth-user` endpoint (which automatically purges and
 * recreates orphaned emails with any new password) and falls back to the client SDK when unconfigured.
 */
export const createTeacherUser = async (email, password, options = {}) => {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const apiRes = await callAdminAuthApi({
    action: 'create',
    email: cleanEmail,
    password,
    displayName: options?.displayName || '',
    institutionId: options?.institutionId || '',
  });

  if (!apiRes.fallbackToClient && apiRes.data?.uid) {
    return apiRes.data.uid;
  }

  const config = getFirebaseConfig();
  if (!isConfigValid(config)) {
    throw new Error("Firebase configuration is missing or invalid. Please configure it in the Dashboard settings first.");
  }
  
  // Fallback when server Admin SDK is not yet configured: create using secondary app instance
  const tempAppName = `TempTeacherCreator-${Date.now()}`;
  const tempApp = initializeApp(config, tempAppName);
  const tempAuth = getAuth(tempApp);
  
  try {
    const userCredential = await createUserWithEmailAndPassword(tempAuth, cleanEmail, password);
    const user = userCredential.user;
    
    await signOut(tempAuth);
    await deleteApp(tempApp);
    
    return user.uid;
  } catch (e) {
    // Same-password orphan reclaim fallback when Admin SDK env var isn't set yet
    if (e.code === 'auth/email-already-in-use' && db) {
      try {
        const [tSnap, iSnap] = await Promise.all([
          getDocs(query(collection(db, "teachers"), where("email", "==", cleanEmail))),
          getDocs(query(collection(db, "institutions"), where("adminEmail", "==", cleanEmail)))
        ]);

        if (tSnap.empty && iSnap.empty) {
          const reclaimedCred = await signInWithEmailAndPassword(tempAuth, cleanEmail, password);
          const reclaimedUid = reclaimedCred.user.uid;
          await signOut(tempAuth);
          await deleteApp(tempApp);
          return reclaimedUid;
        }
      } catch (reclaimErr) {
        try {
          await deleteApp(tempApp);
        } catch (_) {}
        if (reclaimErr.code === 'auth/invalid-credential' || reclaimErr.code === 'auth/wrong-password') {
          throw new Error(
            "This email already exists in Firebase Auth with a different password (Admin SDK not configured on server). Enter its previous password or configure FIREBASE_SERVICE_ACCOUNT_JSON in Vercel."
          );
        }
        throw reclaimErr;
      }
    }
    try {
      await deleteApp(tempApp);
    } catch (_) {}
    throw e;
  }
};

export const updateTeacherPassword = async (email, oldPassword, newPassword) => {
  const config = getFirebaseConfig();
  if (!isConfigValid(config)) {
    throw new Error("Firebase configuration is missing or invalid.");
  }
  
  const tempAppName = `TempPasswordUpdater-${Date.now()}`;
  const tempApp = initializeApp(config, tempAppName);
  const tempAuth = getAuth(tempApp);
  
  try {
    const userCredential = await signInWithEmailAndPassword(tempAuth, email, oldPassword);
    const { updatePassword } = await import('firebase/auth');
    await updatePassword(userCredential.user, newPassword);
    
    await signOut(tempAuth);
    await deleteApp(tempApp);
  } catch (e) {
    try {
      await deleteApp(tempApp);
    } catch (_) {}
    throw e;
  }
};

/**
 * Resets a teacher's Firebase Authentication password via the server Admin SDK endpoint.
 */
export const resetTeacherPassword = async (targetUid, newPassword, institutionId = '') => {
  const apiRes = await callAdminAuthApi({
    action: 'reset-password',
    targetUid,
    newPassword,
    institutionId,
  });

  if (apiRes.fallbackToClient) {
    throw new Error(
      apiRes.serverMessage ||
        'Direct admin password reset requires FIREBASE_SERVICE_ACCOUNT_JSON configured on the server.'
    );
  }

  return apiRes.data;
};

/**
 * Deletes a teacher or school admin login from Firebase Authentication.
 * Uses the server Admin SDK first (requires no user password); falls back to client SDK only when unconfigured.
 */
export const deleteTeacherAccount = async (email, password = '', options = {}) => {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const apiRes = await callAdminAuthApi({
    action: 'delete',
    targetUid: options?.targetUid || '',
    email: cleanEmail,
    institutionId: options?.institutionId || '',
  });

  if (!apiRes.fallbackToClient) {
    return { ok: true, method: 'admin-sdk', ...(apiRes.data || {}) };
  }

  if (!cleanEmail || !password) {
    return { ok: false, method: 'client-fallback-skipped' };
  }

  const config = getFirebaseConfig();
  if (!isConfigValid(config)) {
    throw new Error("Firebase configuration is missing or invalid.");
  }
  
  const tempAppName = `TempUserDeleter-${Date.now()}`;
  const tempApp = initializeApp(config, tempAppName);
  const tempAuth = getAuth(tempApp);
  
  try {
    const userCredential = await signInWithEmailAndPassword(tempAuth, cleanEmail, password);
    const { deleteUser } = await import('firebase/auth');
    await deleteUser(userCredential.user);
    await deleteApp(tempApp);
    return { ok: true, method: 'client-fallback' };
  } catch (e) {
    try {
      await deleteApp(tempApp);
    } catch (_) {}
    throw e;
  }
};

export { app, auth, db, getFirebaseConfig, isConfigValid };
