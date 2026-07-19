import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';

// Parse .env file
const envPath = path.resolve(process.cwd(), '.env');
const env = {};
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let val = match[2] || '';
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      env[key] = val.trim();
    }
  }
}

// Credentials validation
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authorDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = env.VITE_SUPABASE_SERVICE_KEY || '';

const runPurge = async () => {
  console.log("Starting database purge (preserving admin login)...");
  
  try {
    // 1. Purge Firestore
    console.log("Initializing Firebase...");
    const firebaseApp = initializeApp(firebaseConfig);
    const db = getFirestore(firebaseApp);
    
    console.log("Fetching teachers from Firestore...");
    const teachersSnapshot = await getDocs(collection(db, "teachers"));
    
    let deletedCount = 0;
    
    for (const docSnap of teachersSnapshot.docs) {
      const data = docSnap.data();
      const uid = docSnap.id;
      const email = data.email || '';
      
      if (email.toLowerCase() === 'admin@school.com' || data.isAdmin) {
        console.log(`Preserving admin account: ${email}`);
        continue;
      }
      
      console.log(`Deleting teacher data: ${email} (UID: ${uid})...`);
      // Delete schools/{uid} doc
      await deleteDoc(doc(db, "schools", uid));
      // Delete teachers/{uid} doc
      await deleteDoc(doc(db, "teachers", uid));
      
      deletedCount++;
    }
    
    console.log(`Successfully purged ${deletedCount} teacher documents from Firestore.`);
    
    // 2. Purge Supabase (if configured)
    if (supabaseUrl && supabaseServiceKey) {
      console.log("Connecting to Supabase...");
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      
      console.log("Purging schools database table on Supabase...");
      // Delete all schools except admin's UID (we can fetch the admin's UID first to preserve it)
      const { data: adminList } = await supabase
        .from('teachers')
        .select('uid')
        .eq('email', 'admin@school.com');
        
      const adminUid = adminList && adminList.length > 0 ? adminList[0].uid : null;
      
      let schoolDeleteQuery = supabase.from('schools').delete();
      if (adminUid) {
        schoolDeleteQuery = schoolDeleteQuery.neq('teacher_uid', adminUid);
      } else {
        schoolDeleteQuery = schoolDeleteQuery.neq('teacher_uid', 'none'); // delete all
      }
      const { error: schoolDeleteError } = await schoolDeleteQuery;
      if (schoolDeleteError) throw schoolDeleteError;
      
      console.log("Purging teachers database table on Supabase...");
      const { error: teacherDeleteError } = await supabase
        .from('teachers')
        .delete()
        .neq('email', 'admin@school.com');
      if (teacherDeleteError) throw teacherDeleteError;
      
      // Delete Supabase Auth users except admin@school.com
      console.log("Purging Supabase Auth users...");
      try {
        const { data: userList, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;
        
        for (const u of userList.users) {
          if (u.email?.toLowerCase() !== 'admin@school.com') {
            await supabase.auth.admin.deleteUser(u.id);
          }
        }
      } catch (authPurgeErr) {
        console.warn("Supabase Auth user purging warning:", authPurgeErr.message);
      }
      
      console.log("Successfully purged Supabase database tables.");
    }
    
    console.log("Database purge completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Purge failed:", err.message || err);
    process.exit(1);
  }
};

runPurge();
