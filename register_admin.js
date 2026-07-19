import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBC1OaCUygPa6TTV4YqTRCv8tuefWKBNWE",
  authDomain: "sba-portal-flawlex-2026.firebaseapp.com",
  projectId: "sba-portal-flawlex-2026",
  storageBucket: "sba-portal-flawlex-2026.firebasestorage.app",
  messagingSenderId: "179524935644",
  appId: "1:179524935644:web:a498a7ff6c73f53f063919"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const email = "admin@school.com";
const password = "admin123";

console.log("Registering Admin account in Firebase Auth...");

try {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = userCredential.user.uid;
  console.log(`User created in Auth with UID: ${uid}`);

  console.log("Creating Firestore admin profile document...");
  const docRef = doc(db, "teachers", uid);
  await setDoc(docRef, {
    name: "School Admin",
    email: email,
    assignedClass: "Admin",
    createdDate: new Date().toISOString(),
    isAdmin: true
  });
  console.log("Firestore document successfully created!");
  console.log("\nADMIN LOGIN DETAILS:");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  process.exit(0);
} catch (e) {
  console.error("Failed to register admin account:", e.message);
  process.exit(1);
}
