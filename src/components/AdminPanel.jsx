import React, { useState, useEffect } from 'react';
import { db, createTeacherUser, updateTeacherPassword, deleteTeacherAccount } from '../utils/firebase';
import { collection, doc, setDoc, getDocs, getDoc, deleteDoc } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';
import { 
  UserPlus, Users, LogOut, Shield, CheckCircle, AlertCircle, Sparkles, 
  Sun, Moon, Pencil, X, Trash2, Server, CloudUpload, RefreshCw, Eye, EyeOff 
} from 'lucide-react';

const JHS_SUBJECTS_LIST = [
  { name: "English Language", key: "ENG. LANG." },
  { name: "Mathematics", key: "MATHS" },
  { name: "Science", key: "SCIENCE" },
  { name: "Career Technology", key: "C. TECH" },
  { name: "Social Studies", key: "SOCIAL" },
  { name: "Computing", key: "COMPUTING" },
  { name: "Religious and Moral Education", key: "RME" },
  { name: "Ghanaian Language", key: "GH. LANG." },
  { name: "Creative Arts & Design", key: "C. ARTS" },
  { name: "French", key: "FRENCH" },
  { name: "Arabic", key: "ARABIC" }
];

const PRIMARY_SUBJECTS_LIST = [
  { name: "English Language", key: "ENG. LANG." },
  { name: "Mathematics", key: "MATHS" },
  { name: "Science", key: "SCIENCE" },
  { name: "History", key: "HISTORYY" },
  { name: "Our World Our People", key: "OWOP" },
  { name: "Computing", key: "COMPUTING" },
  { name: "Religious and Moral Education", key: "RME" },
  { name: "Ghanaian Language", key: "GH. LANG." },
  { name: "Creative Arts", key: "C. ARTS" }
];

export default function AdminPanel({ adminUser, onLogout, theme, toggleTheme }) {
  const [teachers, setTeachers] = useState([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [assignedClass, setAssignedClass] = useState('BS. 7');
  const [level, setLevel] = useState('JHS');
  const [selectedSubjects, setSelectedSubjects] = useState(
    JHS_SUBJECTS_LIST.filter(s => s.key !== 'FRENCH' && s.key !== 'ARABIC').map(s => s.key)
  );
  
  // Custom metadata fields entered by the Admin for new accounts
  const [schoolName, setSchoolName] = useState('Anglican JHS');
  const [district, setDistrict] = useState('Kpando');
  const [term, setTerm] = useState('ONE');
  const [academicYear, setAcademicYear] = useState('2025/2026');

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Editing state variables
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [showSupaKey, setShowSupaKey] = useState(false);
  const [editName, setEditName] = useState('');
  const [editClass, setEditClass] = useState('BS. 7');
  const [editPassword, setEditPassword] = useState('');
  const [editSchoolName, setEditSchoolName] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [editTerm, setEditTerm] = useState('ONE');
  const [editAcademicYear, setEditAcademicYear] = useState('');
  const [editLevel, setEditLevel] = useState('JHS');
  const [editSelectedSubjects, setEditSelectedSubjects] = useState([]);
  
  const [editLoading, setEditLoading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  // Supabase Backup states
  const [supabaseUrl, setSupabaseUrl] = useState(() => localStorage.getItem('supabase_url') || '');
  const [supabaseServiceKey, setSupabaseServiceKey] = useState(() => localStorage.getItem('supabase_service_key') || '');
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupStatus, setBackupStatus] = useState('');
  const [backupError, setBackupError] = useState('');
  const [backupSuccess, setBackupSuccess] = useState('');
  const [showSqlInstructions, setShowSqlInstructions] = useState(false);

  const sqlSchemaScript = `-- 1. Create the teachers table
CREATE TABLE IF NOT EXISTS public.teachers (
    uid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    assigned_class TEXT,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    password TEXT,
    level TEXT DEFAULT 'JHS',
    subjects JSONB DEFAULT '[]'::jsonb
);

-- 2. Create the schools table
CREATE TABLE IF NOT EXISTS public.schools (
    teacher_uid TEXT PRIMARY KEY REFERENCES public.teachers(uid) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    students JSONB DEFAULT '[]'::jsonb NOT NULL,
    grades JSONB DEFAULT '{}'::jsonb NOT NULL,
    drop_lists JSONB DEFAULT '{}'::jsonb NOT NULL
);

-- Enable RLS but allow service_role to bypass it
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access" ON public.teachers USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access" ON public.schools USING (true) WITH CHECK (true);`;

  // Default initial school template for newly registered teachers
  const getInitialSchoolData = (tName, cName, sName, dist, trm, acadYr) => ({
    metadata: {
      schoolName: sName,
      district: dist,
      classLevel: cName,
      term: trm,
      academicYear: acadYr,
      teacherName: tName,
      date: new Date().toISOString().split('T')[0],
      nextTermBegins: "",
      timesOpen: 57
    },
    students: [],
    grades: {},
    dropLists: {
      conduct: [
        "Respectful and cooperative",
        "Disciplined and focused",
        "Regular and punctual",
        "Shows leadership potential",
        "Needs to improve focus"
      ],
      interest: [
        "Reading and research",
        "Sports and athletics",
        "Creative Arts and music",
        "Gardening and agriculture",
        "Information Technology"
      ],
      remarks: [
        "Excellent performance. Keep it up!",
        "A very good student. Well done.",
        "Good progress made. Work harder.",
        "Fair performance. Needs more effort.",
        "Can do better with regular study."
      ],
      classes: ["BS. 7", "BS. 8", "BS. 9"]
    }
  });

  const fetchTeachersList = async () => {
    setFetching(true);
    try {
      const querySnapshot = await getDocs(collection(db, "teachers"));
      const list = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // Filter out the school admin account
        if (data.email !== 'admin@school.com' && !data.isAdmin) {
          list.push({ uid: docSnap.id, ...data });
        }
      });
      setTeachers(list);
    } catch (e) {
      console.error("Failed fetching teachers:", e);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchTeachersList();
  }, []);

  const handleEditClick = async (teacher) => {
    setSelectedTeacher(teacher);
    setEditName(teacher.name === 'New Teacher' ? '' : (teacher.name || ''));
    setEditClass(teacher.assignedClass || 'BS. 7');
    setEditPassword(teacher.password || 'password123');
    setEditLevel(teacher.level || 'JHS');
    const activeSubjects = teacher.subjects || JHS_SUBJECTS_LIST.filter(s => s.key !== 'FRENCH' && s.key !== 'ARABIC');
    setEditSelectedSubjects(activeSubjects.map(s => s.key));
    setEditLoading(true);
    setEditError('');
    setEditSuccess('');

    try {
      const schoolDocRef = doc(db, "schools", teacher.uid);
      const schoolDocSnap = await getDoc(schoolDocRef);
      if (schoolDocSnap.exists()) {
        const data = schoolDocSnap.data();
        const meta = data.metadata || {};
        setEditSchoolName(meta.schoolName || 'Anglican JHS');
        setEditDistrict(meta.district || 'Kpando');
        setEditTerm(meta.term || 'ONE');
        setEditAcademicYear(meta.academicYear || '2025/2026');
      } else {
        setEditSchoolName('Anglican JHS');
        setEditDistrict('Kpando');
        setEditTerm('ONE');
        setEditAcademicYear('2025/2026');
      }
    } catch (e) {
      console.error(e);
      setEditError("Failed loading school metadata.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editSchoolName || !editDistrict || !editAcademicYear || !editPassword) {
      setEditError("All fields except Teacher's Name are required.");
      return;
    }

    if (editPassword.length < 6) {
      setEditError("Password must be at least 6 characters.");
      return;
    }

    setSavingEdit(true);
    setEditError('');
    setEditSuccess('');

    try {
      const finalEditName = editName.trim() || 'New Teacher';

      // 1. If password has changed, update in Firebase Authentication
      if (editPassword !== selectedTeacher.password) {
        const currentStoredPassword = selectedTeacher.password || 'password123';
        await updateTeacherPassword(selectedTeacher.email, currentStoredPassword, editPassword.trim());
      }

      // 2. Update teachers/{uid} doc
      const finalEditSubjects = (editLevel === 'Primary' ? PRIMARY_SUBJECTS_LIST : JHS_SUBJECTS_LIST)
        .filter(s => editSelectedSubjects.includes(s.key));

      const teacherDocRef = doc(db, "teachers", selectedTeacher.uid);
      await setDoc(teacherDocRef, {
        name: finalEditName,
        assignedClass: editClass,
        password: editPassword.trim(),
        level: editLevel,
        subjects: finalEditSubjects
      }, { merge: true });

      // 3. Update schools/{uid} metadata doc
      const schoolDocRef = doc(db, "schools", selectedTeacher.uid);
      const schoolDocSnap = await getDoc(schoolDocRef);
      
      let updatedSchoolData = {};
      if (schoolDocSnap.exists()) {
        const currentData = schoolDocSnap.data();
        updatedSchoolData = {
          ...currentData,
          metadata: {
            ...(currentData.metadata || {}),
            schoolName: editSchoolName.trim(),
            district: editDistrict.trim(),
            classLevel: editClass,
            term: editTerm,
            academicYear: editAcademicYear.trim(),
            teacherName: finalEditName
          }
        };
      } else {
        updatedSchoolData = getInitialSchoolData(
          finalEditName,
          editClass,
          editSchoolName.trim(),
          editDistrict.trim(),
          editTerm,
          editAcademicYear.trim()
        );
      }
      await setDoc(schoolDocRef, updatedSchoolData);

      setEditSuccess("Teacher configuration updated successfully!");
      
      // Refresh teacher list
      fetchTeachersList();
      
      // Dismiss after timeout
      setTimeout(() => {
        setSelectedTeacher(null);
      }, 1200);

    } catch (err) {
      console.error(err);
      setEditError(err.message || "Failed to update settings. Please verify the credentials.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteTeacher = async (teacher) => {
    if (!window.confirm(`Are you sure you want to permanently delete the teacher "${teacher.name}"? This will erase their authentication account and all student roster/grades data. This action is irreversible.`)) {
      return;
    }

    setFetching(true);
    try {
      // 1. Try deleting user account in Firebase Auth
      try {
        const authPass = teacher.password || 'password123';
        await deleteTeacherAccount(teacher.email, authPass);
      } catch (authErr) {
        console.warn("Auth deletion failed or user already deleted. Cleaning Firestore anyway.", authErr);
      }

      // 2. Delete teacher document in Firestore teachers/{uid}
      await deleteDoc(doc(db, "teachers", teacher.uid));

      // 3. Delete school sheet data document in Firestore schools/{uid}
      await deleteDoc(doc(db, "schools", teacher.uid));

      alert("Teacher account and data successfully deleted!");
      fetchTeachersList();
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to delete teacher database record.");
      setFetching(false);
    }
  };

  const handleGenerateAccount = async (e) => {
    e.preventDefault();
    if (!email || !password || !schoolName || !district || !academicYear) {
      setErrorMsg("All fields except Teacher's Name are required.");
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const finalName = name.trim() || 'New Teacher';

      // 1. Create Login credentials in Firebase Authentication via secondary app
      const teacherUid = await createTeacherUser(email.trim(), password);
      
      // 2. Create the teacher profile document in Firestore 'teachers'
      const finalSubjects = (level === 'Primary' ? PRIMARY_SUBJECTS_LIST : JHS_SUBJECTS_LIST)
        .filter(s => selectedSubjects.includes(s.key));

      const teacherDocRef = doc(db, "teachers", teacherUid);
      const teacherInfo = {
        name: finalName,
        email: email.trim().toLowerCase(),
        assignedClass: assignedClass,
        createdDate: new Date().toISOString(),
        password: password.trim(), // Save password for administrator access
        level: level,
        subjects: finalSubjects
      };
      await setDoc(teacherDocRef, teacherInfo);

      // 3. Initialize default school database template in Firestore 'schools'
      const schoolDocRef = doc(db, "schools", teacherUid);
      await setDoc(schoolDocRef, getInitialSchoolData(
        finalName,
        assignedClass,
        schoolName.trim(),
        district.trim(),
        term,
        academicYear.trim()
      ));

      setSuccessMsg(`Account generated successfully!`);
      setName('');
      setEmail('');
      setPassword('');
      setAssignedClass('BS. 7');
      setLevel('JHS');
      setSelectedSubjects(JHS_SUBJECTS_LIST.filter(s => s.key !== 'FRENCH' && s.key !== 'ARABIC').map(s => s.key));
      
      // Refresh teacher list
      fetchTeachersList();
    } catch (err) {
      console.error(err);
      let msg = "Failed to create teacher account.";
      if (err.code === 'auth/email-already-in-use') {
        msg = "This email address is already registered.";
      } else if (err.code === 'auth/weak-password') {
        msg = "Password must be at least 6 characters long.";
      } else if (err.message) {
        msg = err.message;
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // Supabase backup procedure
  const handleSupabaseBackup = async (e) => {
    e.preventDefault();
    if (!supabaseUrl.trim() || !supabaseServiceKey.trim()) {
      setBackupError("Supabase URL and Service Role Key are required.");
      return;
    }

    setBackupLoading(true);
    setBackupError('');
    setBackupSuccess('');
    setBackupStatus('Initializing connection to Supabase...');

    try {
      // Save credentials locally
      localStorage.setItem('supabase_url', supabaseUrl.trim());
      localStorage.setItem('supabase_service_key', supabaseServiceKey.trim());

      const supabase = createClient(supabaseUrl.trim(), supabaseServiceKey.trim(), {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });

      setBackupStatus('Extracting user logs from Firebase...');
      // 1. Fetch all teachers from Firestore
      const teachersSnapshot = await getDocs(collection(db, "teachers"));
      const firebaseTeachers = [];
      teachersSnapshot.forEach((docSnap) => {
        firebaseTeachers.push({ uid: docSnap.id, ...docSnap.data() });
      });

      if (firebaseTeachers.length === 0) {
        throw new Error("No active teacher databases found on Firebase to backup.");
      }

      let syncCount = 0;

      for (const teacher of firebaseTeachers) {
        setBackupStatus(`Syncing account auth: ${teacher.email} (${syncCount + 1}/${firebaseTeachers.length})...`);
        const authPass = teacher.password || 'password123';

        // A. Attempt to register the user in Supabase Auth via Admin API
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
          console.warn(`Supabase Auth sync warning for ${teacher.email}:`, authErr);
        }

        // B. Upsert profile into public.teachers table
        setBackupStatus(`Backing up profile: ${teacher.name}...`);
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
          throw new Error(`Failed backing up teacher metadata: ${teacherErr.message}. Make sure you ran the SQL tables script in Supabase!`);
        }

        // C. Fetch and Sync spreadsheet document data
        const schoolDocRef = doc(db, "schools", teacher.uid);
        const schoolSnap = await getDoc(schoolDocRef);

        if (schoolSnap.exists()) {
          const schoolData = schoolSnap.data();
          setBackupStatus(`Backing up grading sheet: ${teacher.name}...`);
          
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
            throw new Error(`Failed backing up grading records: ${schoolErr.message}`);
          }
        }

        syncCount++;
      }

      setBackupSuccess(`Backup Completed! Synced ${syncCount} teacher profiles, login settings, and grading records successfully to Supabase!`);
      setBackupStatus('');
    } catch (err) {
      console.error(err);
      setBackupError(err.message || "Cloud backup failed. Make sure your project SQL tables are configured.");
      setBackupStatus('');
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 font-sans select-none flex flex-col transition-colors duration-300">
      {/* Top Navbar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-950/60 backdrop-blur px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <img src="/icon.png" className="w-5 h-5 object-contain" alt="Flawlex logo" />
          <span className="font-bold tracking-tight text-sm text-zinc-900 dark:text-zinc-100 uppercase">Administrator Panel</span>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            title="Toggle Light/Dark Mode"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log Out
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 5 Columns: Creator Form & Supabase Backup */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Main Creator Card */}
          <div className="glass-card p-6 border border-zinc-200 dark:border-zinc-800/80 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800/80 pb-3 mb-5">
              <UserPlus className="w-5 h-5 text-indigo-650 dark:text-indigo-400" />
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Generate Teacher Account</h3>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Register login credential, school details and class</p>
              </div>
            </div>

            {successMsg && (
              <div className="bg-emerald-950/20 border border-emerald-800/40 text-emerald-300 rounded-lg p-3 text-xs flex gap-2 mb-4 animate-fade-in">
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>{successMsg}</p>
              </div>
            )}

            {errorMsg && (
              <div className="bg-rose-950/20 border border-rose-800/40 text-rose-300 rounded-lg p-3 text-xs flex gap-2 mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>{errorMsg}</p>
              </div>
            )}

            <form onSubmit={handleGenerateAccount} className="space-y-4 text-xs font-semibold text-zinc-650 dark:text-zinc-300">
              
              {/* Row 1: Teacher Name & Class */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Teacher's Name (Optional)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Kofi Mensah (or blank)"
                    className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Assigned Class</label>
                  <select
                    value={assignedClass}
                    onChange={(e) => {
                      const newClass = e.target.value;
                      setAssignedClass(newClass);
                      const calculatedLevel = ['BS. 7', 'BS. 8', 'BS. 9'].includes(newClass) ? 'JHS' : 'Primary';
                      setLevel(calculatedLevel);
                      if (calculatedLevel === 'Primary') {
                        setSelectedSubjects(PRIMARY_SUBJECTS_LIST.map(s => s.key));
                      } else {
                        setSelectedSubjects(JHS_SUBJECTS_LIST.filter(s => s.key !== 'FRENCH' && s.key !== 'ARABIC').map(s => s.key));
                      }
                    }}
                    className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="BS. 7">BS. 7</option>
                    <option value="BS. 8">BS. 8</option>
                    <option value="BS. 9">BS. 9</option>
                    <option value="BS. 1">BS. 1</option>
                    <option value="BS. 2">BS. 2</option>
                    <option value="BS. 3">BS. 3</option>
                    <option value="BS. 4">BS. 4</option>
                    <option value="BS. 5">BS. 5</option>
                    <option value="BS. 6">BS. 6</option>
                  </select>
                </div>
              </div>

              {/* Row 2: School Name & District */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">School Name</label>
                  <input
                    type="text"
                    required
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="e.g. Anglican JHS"
                    className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">District</label>
                  <input
                    type="text"
                    required
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g. Kpando"
                    className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Row 3: Term & Academic Year */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Term</label>
                  <select
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="ONE">ONE</option>
                    <option value="TWO">TWO</option>
                    <option value="THREE">THREE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Academic Year</label>
                  <input
                    type="text"
                    required
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="e.g. 2025/2026"
                    className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Row 4: Email & Password */}
              <div className="grid grid-cols-2 gap-3 border-t border-zinc-200 dark:border-zinc-800/80 pt-3">
                <div>
                  <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Login Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teacher@school.com"
                    className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Login Password</label>
                  <input
                    type="text"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* Level / Category Selector */}
              <div className="grid grid-cols-2 gap-3 border-t border-zinc-200 dark:border-zinc-800/80 pt-3">
                <div>
                  <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Level / Category</label>
                  <select
                    value={level}
                    disabled
                    onChange={(e) => {
                      const selectedVal = e.target.value;
                      setLevel(selectedVal);
                      if (selectedVal === 'Primary') {
                        setSelectedSubjects(PRIMARY_SUBJECTS_LIST.map(s => s.key));
                      } else {
                        setSelectedSubjects(JHS_SUBJECTS_LIST.filter(s => s.key !== 'FRENCH' && s.key !== 'ARABIC').map(s => s.key));
                      }
                    }}
                    className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="JHS">Junior High School (JHS)</option>
                    <option value="Primary">Primary School</option>
                  </select>
                </div>
              </div>

              {/* Subject Selection Checkboxes */}
              <div className="border-t border-zinc-200 dark:border-zinc-800/80 pt-3">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Assigned Subjects ({level})</label>
                  <button
                    type="button"
                    onClick={() => {
                      const activeList = level === 'Primary' ? PRIMARY_SUBJECTS_LIST : JHS_SUBJECTS_LIST;
                      if (selectedSubjects.length === activeList.length) {
                        setSelectedSubjects([]);
                      } else {
                        setSelectedSubjects(activeList.map(s => s.key));
                      }
                    }}
                    className="text-[10px] text-indigo-650 dark:text-indigo-400 hover:underline"
                  >
                    {selectedSubjects.length === (level === 'Primary' ? PRIMARY_SUBJECTS_LIST : JHS_SUBJECTS_LIST).length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-zinc-50 dark:bg-[#121214]/50 border border-zinc-200 dark:border-zinc-800/50 rounded-lg p-2.5 max-h-40 overflow-y-auto">
                  {(level === 'Primary' ? PRIMARY_SUBJECTS_LIST : JHS_SUBJECTS_LIST).map(s => {
                    const checked = selectedSubjects.includes(s.key);
                    return (
                      <label key={s.key} className="flex items-center gap-2 cursor-pointer text-[11px] text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-medium select-none">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (checked) {
                              setSelectedSubjects(selectedSubjects.filter(k => k !== s.key));
                            } else {
                              setSelectedSubjects([...selectedSubjects, s.key]);
                            }
                          }}
                          className="rounded border-zinc-300 dark:border-zinc-800 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                        />
                        <span>{s.name} ({s.key})</span>
                      </label>
                    );
                  })}
                </div>
              </div>


              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow"
              >
                {loading ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating Account...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Generate & Initialize
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Supabase Backup & Sync Card */}
          <div className="glass-card p-6 border border-zinc-200 dark:border-zinc-800/80 backdrop-blur-xl relative overflow-hidden">
            <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800/80 pb-3 mb-4">
              <Server className="w-5 h-5 text-emerald-500" />
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Supabase Cloud Backup</h3>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Sync Firebase databases and credentials to Supabase</p>
              </div>
            </div>

            {backupSuccess && (
              <div className="bg-emerald-950/20 border border-emerald-800/40 text-emerald-300 rounded-lg p-3 text-xs flex gap-2 mb-4 animate-fade-in">
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>{backupSuccess}</p>
              </div>
            )}

            {backupError && (
              <div className="bg-rose-950/20 border border-rose-800/40 text-rose-300 rounded-lg p-3 text-xs flex gap-2 mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>{backupError}</p>
              </div>
            )}

            <form onSubmit={handleSupabaseBackup} className="space-y-3 text-xs font-semibold text-zinc-650 dark:text-zinc-300">
              <div>
                <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Supabase Project URL</label>
                <input
                  type="text"
                  required
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Service Role Secret API Key</label>
                <div className="relative flex items-center">
                  <input
                    type={showSupaKey ? "text" : "password"}
                    required
                    value={supabaseServiceKey}
                    onChange={(e) => setSupabaseServiceKey(e.target.value)}
                    placeholder="Bypass RLS Secret Key"
                    className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg pl-3 pr-10 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSupaKey(!showSupaKey)}
                    className="absolute right-3 text-zinc-500 hover:text-zinc-350 dark:hover:text-zinc-200 focus:outline-none"
                  >
                    {showSupaKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {backupLoading && (
                <div className="bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-[11px] flex gap-2.5 items-center text-zinc-600 dark:text-zinc-400">
                  <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin flex-shrink-0" />
                  <span className="font-medium animate-pulse">{backupStatus}</span>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="submit"
                  disabled={backupLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  {backupLoading ? "Backing up..." : "Backup Database & Login Systems"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowSqlInstructions(!showSqlInstructions)}
                  className="text-[10px] text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white underline text-left focus:outline-none"
                >
                  {showSqlInstructions ? "Hide SQL Table Script" : "Show Required Supabase SQL Script"}
                </button>
              </div>

              {showSqlInstructions && (
                <div className="mt-2 text-[10px] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                  <p className="text-zinc-500">Copy and run this inside your Supabase SQL Editor to prepare database tables first:</p>
                  <pre className="p-2 bg-zinc-100 dark:bg-[#121214] text-zinc-700 dark:text-emerald-400 rounded border border-zinc-200 dark:border-zinc-850 font-mono overflow-x-auto whitespace-pre">
                    {sqlSchemaScript}
                  </pre>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Right 7 Columns: Active accounts log */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-card p-6 border border-zinc-200 dark:border-zinc-800/80 flex flex-col h-full">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 pb-3 mb-5">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-650 dark:text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Active Teacher Accounts</h3>
                  <p className="text-[10px] text-zinc-550 dark:text-zinc-400 mt-0.5">Manage credentials for the Flawlex Technologies SBA Portal ({teachers.length} active)</p>
                </div>
              </div>
            </div>

            {fetching ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-zinc-500 dark:text-zinc-400 text-xs">
                <span className="w-6 h-6 border-2 border-zinc-200 dark:border-zinc-700 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin mb-2" />
                Retrieving active roster...
              </div>
            ) : teachers.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-zinc-500 text-xs border border-dashed border-zinc-250 dark:border-zinc-800 rounded-xl">
                No teacher accounts found. Use the creator form to register a new teacher.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold select-none text-center">
                      <th className="px-4 py-3 text-left">Teacher Name</th>
                      <th className="px-4 py-3 text-left">Email Address</th>
                      <th className="px-4 py-3 w-20">Class</th>
                      <th className="px-4 py-3 w-20">Level</th>
                      <th className="px-4 py-3 text-left">Subjects</th>
                      <th className="px-4 py-3 w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-medium">
                    {teachers.map((teacher) => (
                      <tr key={teacher.uid} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/35 transition-colors text-center text-zinc-750 dark:text-zinc-300">
                        <td className="px-4 py-2.5 text-left font-bold text-zinc-900 dark:text-white">{teacher.name}</td>
                        <td className="px-4 py-2.5 text-left text-zinc-500 dark:text-zinc-400 font-mono text-[11px]">{teacher.email}</td>
                        <td className="px-4 py-2.5 font-mono text-[11px]">
                          <span className="bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-500/25 px-2 py-0.5 rounded text-[10px] font-bold">
                            {teacher.assignedClass}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-zinc-550 dark:text-zinc-400 font-semibold text-[10px]">
                          {teacher.level || 'JHS'}
                        </td>
                        <td className="px-4 py-2.5 text-left text-zinc-500 dark:text-zinc-400 text-[10px] max-w-[150px] truncate" title={teacher.subjects ? teacher.subjects.map(s => s.name).join(', ') : 'All standard JHS'}>
                          {teacher.subjects ? teacher.subjects.map(s => s.name).join(', ') : 'Default JHS'}
                        </td>
                        <td className="px-4 py-2.5 flex justify-center gap-1.5">
                          <button
                            onClick={() => handleEditClick(teacher)}
                            className="p-1 rounded bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-650 dark:text-indigo-400 border border-indigo-500/20 transition-colors"
                            title="Edit Teacher Profile"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTeacher(teacher)}
                            className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/25 text-rose-650 dark:text-rose-455 border border-rose-500/20 transition-colors"
                            title="Delete Teacher Account & Data"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Edit Teacher Modal Backdrop Overlay */}
      {selectedTeacher && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 max-w-md w-full rounded-2xl p-6 shadow-2xl relative overflow-hidden animate-scale-in">
            <button
              onClick={() => setSelectedTeacher(null)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-450 hover:text-zinc-800 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-5">
              <Pencil className="w-5 h-5 text-indigo-650 dark:text-indigo-400" />
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Edit Teacher Profile</h3>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Modify class assignment, school name and settings</p>
              </div>
            </div>

            {editLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-xs text-zinc-500">
                <span className="w-6 h-6 border-2 border-zinc-250 border-t-indigo-600 rounded-full animate-spin mb-2" />
                Loading teacher metadata...
              </div>
            ) : (
              <form onSubmit={handleSaveEdit} className="space-y-4 text-xs font-semibold text-zinc-650 dark:text-zinc-300">
                {editSuccess && (
                  <div className="bg-emerald-950/20 border border-emerald-800/40 text-emerald-300 rounded-lg p-2.5 text-[11px] flex gap-2">
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <p>{editSuccess}</p>
                  </div>
                )}
                {editError && (
                  <div className="bg-rose-950/20 border border-rose-800/40 text-rose-300 rounded-lg p-2.5 text-[11px] flex gap-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <p>{editError}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Teacher Name (Optional)</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="e.g. Kofi Mensah"
                      className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Teacher Password</label>
                    <input
                      type="text"
                      required
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Assigned Class</label>
                    <select
                      value={editClass}
                      onChange={(e) => {
                        const newClass = e.target.value;
                        setEditClass(newClass);
                        const calculatedLevel = ['BS. 7', 'BS. 8', 'BS. 9'].includes(newClass) ? 'JHS' : 'Primary';
                        setEditLevel(calculatedLevel);
                        if (calculatedLevel === 'Primary') {
                          setEditSelectedSubjects(PRIMARY_SUBJECTS_LIST.map(s => s.key));
                        } else {
                          setEditSelectedSubjects(JHS_SUBJECTS_LIST.filter(s => s.key !== 'FRENCH' && s.key !== 'ARABIC').map(s => s.key));
                        }
                      }}
                      className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="BS. 7">BS. 7</option>
                      <option value="BS. 8">BS. 8</option>
                      <option value="BS. 9">BS. 9</option>
                      <option value="BS. 1">BS. 1</option>
                      <option value="BS. 2">BS. 2</option>
                      <option value="BS. 3">BS. 3</option>
                      <option value="BS. 4">BS. 4</option>
                      <option value="BS. 5">BS. 5</option>
                      <option value="BS. 6">BS. 6</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Term</label>
                    <select
                      value={editTerm}
                      onChange={(e) => setEditTerm(e.target.value)}
                      className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="ONE">ONE</option>
                      <option value="TWO">TWO</option>
                      <option value="THREE">THREE</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">School Name</label>
                    <input
                      type="text"
                      required
                      value={editSchoolName}
                      onChange={(e) => setEditSchoolName(e.target.value)}
                      className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">District</label>
                    <input
                      type="text"
                      required
                      value={editDistrict}
                      onChange={(e) => setEditDistrict(e.target.value)}
                      className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Academic Year</label>
                  <input
                    type="text"
                    required
                    value={editAcademicYear}
                    onChange={(e) => setEditAcademicYear(e.target.value)}
                    className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Edit Level Selector */}
                <div className="grid grid-cols-2 gap-3 border-t border-zinc-200 dark:border-zinc-800/80 pt-3">
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Level / Category</label>
                    <select
                      value={editLevel}
                      disabled
                      onChange={(e) => {
                        const selectedVal = e.target.value;
                        setEditLevel(selectedVal);
                        if (selectedVal === 'Primary') {
                          setEditSelectedSubjects(PRIMARY_SUBJECTS_LIST.map(s => s.key));
                        } else {
                          setEditSelectedSubjects(JHS_SUBJECTS_LIST.filter(s => s.key !== 'FRENCH' && s.key !== 'ARABIC').map(s => s.key));
                        }
                      }}
                      className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="JHS">Junior High School (JHS)</option>
                      <option value="Primary">Primary School</option>
                    </select>
                  </div>
                </div>

                {/* Edit Subject Selection Checkboxes */}
                <div className="border-t border-zinc-200 dark:border-zinc-800/80 pt-3">
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Assigned Subjects ({editLevel})</label>
                    <button
                      type="button"
                      onClick={() => {
                        const activeList = editLevel === 'Primary' ? PRIMARY_SUBJECTS_LIST : JHS_SUBJECTS_LIST;
                        if (editSelectedSubjects.length === activeList.length) {
                          setEditSelectedSubjects([]);
                        } else {
                          setEditSelectedSubjects(activeList.map(s => s.key));
                        }
                      }}
                      className="text-[10px] text-indigo-650 dark:text-indigo-400 hover:underline"
                    >
                      {editSelectedSubjects.length === (editLevel === 'Primary' ? PRIMARY_SUBJECTS_LIST : JHS_SUBJECTS_LIST).length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 bg-zinc-50 dark:bg-[#121214]/50 border border-zinc-200 dark:border-zinc-800/50 rounded-lg p-2 max-h-32 overflow-y-auto">
                    {(editLevel === 'Primary' ? PRIMARY_SUBJECTS_LIST : JHS_SUBJECTS_LIST).map(s => {
                      const checked = editSelectedSubjects.includes(s.key);
                      return (
                        <label key={s.key} className="flex items-center gap-2 cursor-pointer text-[10px] text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white font-medium select-none">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              if (checked) {
                                setEditSelectedSubjects(editSelectedSubjects.filter(k => k !== s.key));
                              } else {
                                setEditSelectedSubjects([...editSelectedSubjects, s.key]);
                              }
                            }}
                            className="rounded border-zinc-300 dark:border-zinc-800 text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                          />
                          <span>{s.name} ({s.key})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setSelectedTeacher(null)}
                    className="flex-1 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-lg py-2 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1 transition-colors shadow"
                  >
                    {savingEdit ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
