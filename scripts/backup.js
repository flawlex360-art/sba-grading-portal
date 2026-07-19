import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
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
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = env.VITE_SUPABASE_SERVICE_KEY || '';

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error("Error: Missing Firebase credentials in .env file.");
  process.exit(1);
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Error: Missing Supabase credentials (VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_KEY) in .env file.");
  console.error("Please add VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_KEY to your .env file to enable automated backups.");
  process.exit(1);
}

const runBackup = async () => {
  console.log(`[${new Date().toLocaleString()}] Starting automated backup...`);
  
  try {
    // 1. Initialize Firebase Client
    const firebaseApp = initializeApp(firebaseConfig);
    const db = getFirestore(firebaseApp);
    
    // 2. Initialize Supabase Admin Client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    console.log("Fetching teacher roster from Firebase...");
    const querySnapshot = await getDocs(collection(db, "teachers"));
    const teachers = [];
    querySnapshot.forEach((docSnap) => {
      teachers.push({ uid: docSnap.id, ...docSnap.data() });
    });
    
    console.log(`Found ${teachers.length} teacher accounts. Starting synchronization...`);
    let syncCount = 0;
    
    for (const teacher of teachers) {
      console.log(`Syncing profile: ${teacher.name} (${teacher.email})...`);
      const authPass = teacher.password || 'password123';
      
      // A. Sync Supabase Auth User
      try {
        const { data: userList, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;
        
        const exists = userList.users.find(u => u.email?.toLowerCase() === teacher.email.toLowerCase());
        if (!exists) {
          const { error: createError } = await supabase.auth.admin.createUser({
            email: teacher.email,
            password: authPass,
            email_confirm: true,
            user_metadata: { name: teacher.name }
          });
          if (createError) throw createError;
        }
      } catch (authErr) {
        console.warn(`[Warning] Auth sync failed for ${teacher.email}:`, authErr.message);
      }
      
      // B. Sync Teachers database table
      const { error: teacherErr } = await supabase
        .from('teachers')
        .upsert({
          uid: teacher.uid,
          name: teacher.name,
          email: teacher.email,
          assigned_class: teacher.assignedClass || null,
          created_date: teacher.createdDate || new Date().toISOString(),
          password: authPass,
          level: teacher.level || 'JHS',
          subjects: teacher.subjects || []
        }, { onConflict: 'uid' });
        
      if (teacherErr) {
        throw new Error(`Failed saving teacher profile ${teacher.name}: ${teacherErr.message}. Make sure your Supabase table has the 'level' and 'subjects' columns!`);
      }
      
      // C. Sync Schools spreadsheet data
      const schoolDocRef = doc(db, "schools", teacher.uid);
      const schoolSnap = await getDoc(schoolDocRef);
      
      if (schoolSnap.exists()) {
        const schoolData = schoolSnap.data();
        console.log(`Syncing database records for ${teacher.name}...`);
        
        const { error: schoolErr } = await supabase
          .from('schools')
          .upsert({
            teacher_uid: teacher.uid,
            metadata: schoolData.metadata || {},
            students: schoolData.students || [],
            grades: schoolData.grades || {},
            drop_lists: schoolData.dropLists || {}
          }, { onConflict: 'teacher_uid' });
          
        if (schoolErr) {
          throw new Error(`Failed saving database records for ${teacher.name}: ${schoolErr.message}`);
        }
      }
      syncCount++;
    }
    
    console.log(`[${new Date().toLocaleString()}] Backup completed successfully! Synced ${syncCount} accounts.`);
    process.exit(0);
  } catch (err) {
    console.error(`[${new Date().toLocaleString()}] Backup failed:`, err.message || err);
    process.exit(1);
  }
};

runBackup();
