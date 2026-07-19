import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs,
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
    db = getFirestore(app);
    
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
 * Creates a new teacher account credential using an in-memory secondary app.
 * This ensures the currently logged-in Admin is NOT automatically signed out.
 */
export const createTeacherUser = async (email, password) => {
  const config = getFirebaseConfig();
  if (!isConfigValid(config)) {
    throw new Error("Firebase configuration is missing or invalid. Please configure it in the Dashboard settings first.");
  }
  
  // Create a unique temporary secondary app instance
  const tempAppName = `TempTeacherCreator-${Date.now()}`;
  const tempApp = initializeApp(config, tempAppName);
  const tempAuth = getAuth(tempApp);
  
  try {
    const userCredential = await createUserWithEmailAndPassword(tempAuth, email, password);
    const user = userCredential.user;
    
    // Sign out from the temporary app instance immediately
    await signOut(tempAuth);
    // Delete the temporary app to release resources
    await deleteApp(tempApp);
    
    return user.uid;
  } catch (e) {
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

export const deleteTeacherAccount = async (email, password) => {
  const config = getFirebaseConfig();
  if (!isConfigValid(config)) {
    throw new Error("Firebase configuration is missing or invalid.");
  }
  
  const tempAppName = `TempUserDeleter-${Date.now()}`;
  const tempApp = initializeApp(config, tempAppName);
  const tempAuth = getAuth(tempApp);
  
  try {
    const userCredential = await signInWithEmailAndPassword(tempAuth, email, password);
    const { deleteUser } = await import('firebase/auth');
    await deleteUser(userCredential.user);
    await deleteApp(tempApp);
  } catch (e) {
    try {
      await deleteApp(tempApp);
    } catch (_) {}
    throw e;
  }
};

export { app, auth, db, getFirebaseConfig, isConfigValid };
