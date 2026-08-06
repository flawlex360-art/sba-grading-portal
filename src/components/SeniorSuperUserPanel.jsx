import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc, query, where } from 'firebase/firestore';
import { db, createTeacherUser, deleteTeacherAccount } from '../utils/firebase';
import { Building2, Plus, LogOut, CheckCircle, AlertCircle, Edit, Trash2, Database, ChevronDown, ChevronUp, Key, X, Save, Archive } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SeniorSuperUserPanel({ onLogout, theme, toggleTheme }) {
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedInstId, setExpandedInstId] = useState(null);
  const [editingInstId, setEditingInstId] = useState(null);
  const [editSchoolName, setEditSchoolName] = useState('');
  const [editCrestUrl, setEditCrestUrl] = useState('');
  const [editAcademicYear, setEditAcademicYear] = useState('');
  // Form State
  const [schoolName, setSchoolName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [activeTerm, setActiveTerm] = useState('Term 1');
  const [academicYear, setAcademicYear] = useState('2026/2027');
  const [schoolCrestUrl, setSchoolCrestUrl] = useState('');
  
  const fetchInstitutions = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "institutions"));
      const list = [];
      
      const teacherSnap = await getDocs(collection(db, "teachers"));
      const allTeachers = [];
      teacherSnap.forEach(d => allTeachers.push({ uid: d.id, ...d.data() }));

      snap.forEach(d => {
        const instData = { id: d.id, ...d.data() };
        instData.academicYear = instData.academicYear || "2026/2027";
        instData.teachers = allTeachers.filter(t => t.institutionId === d.id && !t.isAdmin && !t.isSeniorSuperUser);
        instData.adminProfile = allTeachers.find(t => t.institutionId === d.id && t.isAdmin);
        list.push(instData);
      });
      list.sort((a,b) => a.schoolName.localeCompare(b.schoolName));
      setInstitutions(list);
    } catch (e) {
      console.error("Failed to load institutions", e);
      toast.error("Failed to load schools.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstitutions();
  }, []);



  const handleGenerateVoltaDemo = async () => {
    if (!window.confirm("WARNING: This will generate a massive Demo School (Volta Region) with 6 teachers and over 200 students. Proceed?")) return;
    toast.loading("Generating Demo Data...", { id: "demo" });

    try {
      const firstNames = ["Kofi", "Abla", "Kwame", "Enyonam", "Koku", "Selasie", "Makafui", "Yayra", "Sedem", "Senanu", "Fofo", "Mawuli", "Dzifa", "Edem", "Sena", "Elikem", "Dzidzor", "Eyram", "Kafui", "Nutifafa"];
      const lastNames = ["Mensah", "Dzifa", "Agbeko", "Gbedema", "Anyidoho", "Kpodo", "Kojo", "Adzaho", "Kudjoe", "Tetteh", "Amegashie", "Goka", "Attoh", "Avle", "Gbeho", "Ahiagba", "Agbenyega", "Klu", "Dotse"];

      const getRandomName = () => {
        return firstNames[Math.floor(Math.random() * firstNames.length)] + " " + lastNames[Math.floor(Math.random() * lastNames.length)];
      };

      const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

      const JHS_SUBJECTS = [
        { name: "English Language", key: "ENG. LANG." },
        { name: "Mathematics", key: "MATHS" },
        { name: "Science", key: "SCIENCE" },
        { name: "Career Technology", key: "C. TECH" },
        { name: "Social Studies", key: "SOCIAL" },
        { name: "Computing", key: "COMPUTING" },
        { name: "Religious and Moral Education", key: "RME" },
        { name: "Ghanaian Language", key: "GH. LANG." },
        { name: "Creative Arts & Design", key: "C. ARTS" }
      ];

      const PRIMARY_SUBJECTS = [
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

      // 1. Create Admin
      const adminEmail = "demo@volta.edu";
      const adminPassword = "Password123!";
      const schoolName = "Volta Demonstration School";
      const id = "volta-demo-" + Date.now();
      
      const adminUid = await createTeacherUser(adminEmail, adminPassword);
      await setDoc(doc(db, "institutions", id), {
        schoolName,
        adminEmail,
        activeTerm: "Term 1",
        academicYear: "2026/2027",
        schoolCrestUrl: "",
        gradingFormula: 'default',
        createdAt: new Date().toISOString()
      });
      await setDoc(doc(db, "teachers", adminUid), {
        isAdmin: true,
        name: "Admin",
        email: adminEmail,
        password: adminPassword,
        institutionId: id,
        createdDate: new Date().toISOString()
      });

      // 2. Create Teachers
      const classes = [
        { email: "p4@volta.edu", level: "Primary", className: "BS. 4", subList: PRIMARY_SUBJECTS },
        { email: "p5@volta.edu", level: "Primary", className: "BS. 5", subList: PRIMARY_SUBJECTS },
        { email: "p6@volta.edu", level: "Primary", className: "BS. 6", subList: PRIMARY_SUBJECTS },
        { email: "jhs1@volta.edu", level: "JHS", className: "BS. 7", subList: JHS_SUBJECTS },
        { email: "jhs2@volta.edu", level: "JHS", className: "BS. 8", subList: JHS_SUBJECTS },
        { email: "jhs3@volta.edu", level: "JHS", className: "BS. 9", subList: JHS_SUBJECTS },
      ];

      for (const cls of classes) {
        toast.loading(`Creating ${cls.className}...`, { id: "demo" });
        const teacherUid = await createTeacherUser(cls.email, adminPassword);
        
        await setDoc(doc(db, "teachers", teacherUid), {
          name: `${cls.className} Teacher`,
          email: cls.email,
          password: adminPassword,
          assignedClass: cls.className,
          level: cls.level,
          subjects: cls.subList,
          institutionId: id,
          createdDate: new Date().toISOString()
        });

        // Generate Students with sn field (sequential number) as the app expects
        const numStudents = randInt(38, 39);
        const students = [];
        
        for (let i = 1; i <= numStudents; i++) {
          students.push({
            sn: i,
            name: getRandomName(),
            gender: Math.random() > 0.5 ? "Male" : "Female"
          });
        }

        // Build grades keyed by SUBJECT_KEY -> { studentSN: { gw1, test, gw2, proj, exams } }
        // This matches computeClassResults expectations exactly
        const grades = {};
        cls.subList.forEach(sub => {
          grades[sub.key] = {};
          students.forEach(s => {
            // Generate realistic bell-curve marks for an ideal classroom
            const gw1 = randInt(12, 20);   // TEST 1 (out of 20)
            const test = randInt(15, 30);   // GW (out of 30)
            const gw2 = randInt(12, 20);   // TEST 2 (out of 20)
            const proj = randInt(15, 30);   // PROJ (out of 30)
            const exams = randInt(40, 95);  // End of Term Exam (out of 100)
            grades[sub.key][s.sn] = {
              gw1: gw1.toString(),
              test: test.toString(),
              gw2: gw2.toString(),
              proj: proj.toString(),
              exams: exams.toString()
            };
          });
        });

        const schoolData = {
          metadata: {
            schoolName,
            district: "Volta",
            teacherName: `${cls.className} Teacher`,
            academicYear: "2023/2024",
            classLevel: cls.className,
            vacationDate: "",
            reopeningDate: "",
            attendance: "45",
            outOf: "45"
          },
          students: students,
          terms: {
            "Term 1": { students: students, grades: grades },
            "Term 2": { students: [], grades: {} },
            "Term 3": { students: [], grades: {} }
          },
          activeTerm: "Term 1",
          dropLists: {
            conduct: ["Very Good", "Good", "Excellent", "Satisfactory", "Needs Improvement", "Respectful", "Attentive", "Polite", "Helpful", "Friendly"],
            interest: ["Reading novels", "Researching topics", "Sports", "Creative Arts", "Music", "Gardening", "Information Technology", "Drawing", "Painting", "Public speaking", "Debating", "Science experiments", "Solving mathematics problems", "Cultural dancing", "Drama"],
            attitude: ["Hardworking", "Cooperative", "Obedient", "Punctual", "Sociable", "Respectful", "Confident", "Diligent", "Responsible", "Disciplined"],
            remark: ["An excellent student! Keep it up.", "Good performance. Can do better.", "Hardworking and committed learner.", "Good progress made. Work harder.", "Needs to pay more attention in class.", "Must improve upon current academic standing.", "Highly motivated and dedicated learner.", "A promising student with a bright future."],
            classes: ["BS. 1", "BS. 2", "BS. 3", "BS. 4", "BS. 5", "BS. 6", "BS. 7", "BS. 8", "BS. 9"]
          }
        };

        await setDoc(doc(db, "schools", teacherUid), schoolData);
      }
      
      toast.success("Demo Data Generation Complete! Login with demo@volta.edu", { id: "demo", duration: 10000 });
      fetchInstitutions();

    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to generate demo data", { id: "demo" });
    }
  };

  const handleAddInstitution = async (e) => {
    e.preventDefault();
    if (!schoolName || !adminEmail || !adminPassword) {
      toast.error("School Name, Admin Email, and Admin Password are required.");
      return;
    }

    const id = schoolName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();

    try {
      toast.loading("Creating Super User account...", { id: "create-school" });
      
      // 1. Create the Firebase Auth User for the Admin
      const adminUid = await createTeacherUser(adminEmail.trim().toLowerCase(), adminPassword.trim());

      // 2. Create the Institution Document
      await setDoc(doc(db, "institutions", id), {
        schoolName: schoolName.trim(),
        adminEmail: adminEmail.toLowerCase().trim(),
        activeTerm,
        academicYear: academicYear.trim() || "2026/2027",
        schoolCrestUrl: schoolCrestUrl.trim(),
        gradingFormula: 'default',
        createdAt: new Date().toISOString()
      });
      
      // 3. Save the Super User profile in the 'teachers' collection
      await setDoc(doc(db, "teachers", adminUid), {
        isAdmin: true,
        name: "Admin",
        email: adminEmail.trim().toLowerCase(),
        password: adminPassword.trim(),
        institutionId: id,
        createdDate: new Date().toISOString()
      });
      
      toast.success("School and Super User created successfully!", { id: "create-school" });
      setShowAddForm(false);
      setSchoolName('');
      setAdminEmail('');
      setAdminPassword('');
      setSchoolCrestUrl('');
      setActiveTerm('Term 1');
      fetchInstitutions();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to register school.", { id: "create-school" });
    }
  };

  const archiveTermData = async (instId, academicYear, termToArchive) => {
    try {
      const qTeachers = query(collection(db, "teachers"), where("institutionId", "==", instId));
      const snapTeachers = await getDocs(qTeachers);
      
      const archivePromises = [];
      
      for (const tDoc of snapTeachers.docs) {
        if (tDoc.data().isAdmin || tDoc.data().isSeniorSuperUser) continue;
        
        const teacherUid = tDoc.id;
        const sDoc = await getDoc(doc(db, "schools", teacherUid));
        if (sDoc.exists()) {
          const sData = sDoc.data();
          const termData = sData.terms?.[termToArchive];
          if (termData) {
            const archiveId = `${instId}_${academicYear.replace('/', '-')}_${termToArchive.replace(' ', '')}_${teacherUid}`;
            archivePromises.push(
              setDoc(doc(db, "archives", archiveId), {
                institutionId: instId,
                academicYear,
                term: termToArchive,
                teacherId: teacherUid,
                teacherName: tDoc.data().name,
                subList: sData.subList || [],
                grades: termData.grades || {},
                students: termData.students || [],
                archivedAt: new Date().toISOString()
              })
            );
          }
        }
      }
      await Promise.all(archivePromises);
    } catch (e) {
      console.error("Error archiving term data:", e);
      throw e;
    }
  };

  const updateInstitutionTerm = async (inst, newTerm) => {
    const id = inst.id;
    const oldTerm = inst.activeTerm;
    const academicYear = inst.academicYear || "2026/2027";
    
    if (oldTerm === newTerm) return;
    
    const toastId = toast.loading(`Archiving ${oldTerm} and switching to ${newTerm}...`);
    try {
      await archiveTermData(id, academicYear, oldTerm);
      await setDoc(doc(db, "institutions", id), { activeTerm: newTerm }, { merge: true });
      toast.success(`${oldTerm} archived and active term updated!`, { id: toastId });
      setInstitutions(prev => prev.map(i => i.id === id ? { ...i, activeTerm: newTerm } : i));
    } catch (e) {
      console.error(e);
      toast.error("Failed to update term.", { id: toastId });
    }
  };

  const handleEndOfYearRollover = async (inst) => {
    const confirmed = window.prompt(`Type "CONFIRM" to archive Term 3 and reset ${inst.schoolName} for the New Academic Year.`);
    if (confirmed !== "CONFIRM") return;

    let nextAcademicYear = window.prompt("Enter the New Academic Year (e.g., 2027/2028):", "2027/2028");
    if (!nextAcademicYear) return;

    const toastId = toast.loading(`Archiving Term 3 and rolling over ${inst.schoolName}...`);
    try {
      const academicYear = inst.academicYear || "2026/2027";
      // 1. Archive Term 3
      await archiveTermData(inst.id, academicYear, "Term 3");

      // 2. Wipe teacher terms data completely
      const qTeachers = query(collection(db, "teachers"), where("institutionId", "==", inst.id));
      const snapTeachers = await getDocs(qTeachers);
      
      const wipePromises = [];
      for (const tDoc of snapTeachers.docs) {
        if (tDoc.data().isAdmin || tDoc.data().isSeniorSuperUser) continue;
        const teacherUid = tDoc.id;
        wipePromises.push(
          setDoc(doc(db, "schools", teacherUid), {
            terms: {
              "Term 1": { students: [], grades: {} },
              "Term 2": { students: [], grades: {} },
              "Term 3": { students: [], grades: {} }
            }
          }, { merge: true })
        );
      }
      await Promise.all(wipePromises);

      // 3. Update institution to new academic year and reset to Term 1
      await setDoc(doc(db, "institutions", inst.id), { 
        activeTerm: "Term 1",
        academicYear: nextAcademicYear 
      }, { merge: true });

      toast.success("End of year rollover complete!", { id: toastId });
      fetchInstitutions();
    } catch (e) {
      console.error(e);
      toast.error("Failed to perform end of year rollover.", { id: toastId });
    }
  };

  const saveSchoolChanges = async (id) => {
    if (!editSchoolName.trim()) {
      toast.error("School Name cannot be empty");
      return;
    }
    const toastId = toast.loading("Saving changes...");
    try {
      await setDoc(doc(db, "institutions", id), { 
        schoolName: editSchoolName.trim(), 
        schoolCrestUrl: editCrestUrl.trim(),
        academicYear: editAcademicYear.trim() || "2026/2027"
      }, { merge: true });
      
      setInstitutions(prev => prev.map(inst => 
        inst.id === id ? { ...inst, schoolName: editSchoolName.trim(), schoolCrestUrl: editCrestUrl.trim(), academicYear: editAcademicYear.trim() || "2026/2027" } : inst
      ));
      toast.success("Changes saved successfully", { id: toastId });
      setEditingInstId(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save changes", { id: toastId });
    }
  };

  const deleteInstitution = (inst) => {
    const id = inst.id;
    const name = inst.schoolName;
    toast.custom((t) => (
      <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white dark:bg-zinc-900 shadow-2xl rounded-xl pointer-events-auto flex flex-col p-5 border border-zinc-200 dark:border-zinc-800`}>
        <div className="flex items-center gap-2 text-rose-600 mb-1">
          <Trash2 className="w-5 h-5" />
          <p className="text-sm font-bold text-zinc-900 dark:text-white">Permanently Delete School?</p>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Are you sure you want to delete <strong className="text-zinc-800 dark:text-zinc-200">"{name}"</strong>? This will permanently delete the school, its administrator account, all teacher accounts, and all student grades.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <button 
            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-lg text-xs font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            onClick={() => toast.dismiss(t.id)}
          >
            Cancel
          </button>
          <button 
            className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors"
            onClick={async () => {
              // 1. Instantly dismiss modal
              toast.dismiss(t.id);

              // 2. Instantly update React state so school vanishes immediately from UI
              setInstitutions(prev => prev.filter(inst => inst.id !== id));

              // 3. Show instant success toast
              toast.success(`School "${name}" deleted!`);

              // 4. Perform Firestore deletions in background with timeout safety
              try {
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error("Timeout")), 60000)
                );

                const performDelete = async () => {
                  const qTeachers = query(collection(db, "teachers"), where("institutionId", "==", id));
                  const snapTeachers = await getDocs(qTeachers);
                  for (const tDoc of snapTeachers.docs) {
                    const teacherUid = tDoc.id;
                    const teacherData = tDoc.data();
                    
                    if (teacherData.email && teacherData.password) {
                      await deleteTeacherAccount(teacherData.email, teacherData.password).catch(() => {});
                    }
                    
                    await deleteDoc(doc(db, "schools", teacherUid)).catch(() => {});
                    await deleteDoc(doc(db, "teachers", teacherUid)).catch(() => {});
                  }
                  
                  if (inst.adminProfile?.email && inst.adminProfile?.password) {
                    await deleteTeacherAccount(inst.adminProfile.email, inst.adminProfile.password).catch(() => {});
                  }
                  
                  await deleteDoc(doc(db, "institutions", id));
                };

                await Promise.race([performDelete(), timeoutPromise]).catch(e => console.warn("Delete timeout warning:", e));
              } catch (e) {
                console.warn("Background institution delete warning:", e);
              }
            }}
          >
            Delete Permanently
          </button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#09090b] text-zinc-100' : 'bg-zinc-50 text-zinc-900'} font-sans select-none flex flex-col transition-colors duration-300`}>
      {/* Top Navbar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-950/60 backdrop-blur px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <img src="/icon.png" className="w-10 h-10 object-contain" alt="logo" />
          <span className="font-bold tracking-tight text-sm uppercase text-violet-600 dark:text-violet-400">Senior Super User Portal</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={toggleTheme} className="p-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          
                        <button onClick={handleGenerateVoltaDemo} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-semibold transition-colors">
              <Database className="w-4 h-4" /> Generate Demo School
            </button>
            <button onClick={onLogout} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white transition-all shadow-sm">
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 transition-all duration-300">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Registered Institutions</h1>
            <p className="text-xs text-zinc-500 mt-1">Manage school tenants and their active terms</p>
          </div>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> {showAddForm ? 'Cancel' : 'Register New School'}
          </button>
        </div>

        {showAddForm && (
          <div className="mb-8 glass-card p-6 border border-zinc-200 dark:border-zinc-800/80 rounded-xl relative overflow-hidden animate-fade-in">
             <form onSubmit={handleAddInstitution} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">School Name</label>
                  <input required value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="e.g. Anglican JHS" className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Super User Email (Admin)</label>
                  <input type="email" required value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@school.com" className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Super User Password</label>
                  <input type="text" required value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="StrongPassword123!" className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">School Crest URL (Optional)</label>
                  <input value={schoolCrestUrl} onChange={e => setSchoolCrestUrl(e.target.value)} placeholder="https://..." className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Academic Year</label>
                  <input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="e.g. 2026/2027" className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-500 mb-1">Initial Active Term</label>
                  <select value={activeTerm} onChange={e => setActiveTerm(e.target.value)} className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs">
                    <option value="Term 1">Term 1</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Term 3">Term 3</option>
                  </select>
                </div>
                <div className="md:col-span-2 flex justify-end mt-2">
                  <button type="submit" className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-lg shadow transition-colors">
                    Save School
                  </button>
                </div>
             </form>
          </div>
        )}

        <div className="glass-card rounded-xl border border-zinc-200 dark:border-zinc-800/80 overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-100 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-semibold">
                <th className="px-4 py-3">School Name</th>
                <th className="px-4 py-3">Super User Email</th>
                <th className="px-4 py-3">Crest</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Academic Year</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Active Term</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-12 text-zinc-500">Loading schools...</td>
                </tr>
              ) : institutions.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-12 text-zinc-500">No schools registered yet.</td>
                </tr>
              ) : (
                institutions.map(inst => (
                  <React.Fragment key={inst.id}>
                    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-900/35 transition-colors cursor-pointer group" onClick={() => setExpandedInstId(expandedInstId === inst.id ? null : inst.id)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button 
                            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedInstId(expandedInstId === inst.id ? null : inst.id);
                            }}
                          >
                            {expandedInstId === inst.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          {editingInstId === inst.id ? (
                            <input 
                              type="text" 
                              value={editSchoolName} 
                              onChange={(e) => setEditSchoolName(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-xs px-2 py-1 rounded w-full font-bold focus:ring-violet-500 focus:border-violet-500"
                            />
                          ) : (
                            <div>
                              <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                                {inst.schoolName}
                              </div>
                              <div className="text-[9px] font-mono text-zinc-400 font-normal mt-0.5">ID: {inst.id}</div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="text-zinc-600 dark:text-zinc-400 font-semibold">{inst.adminEmail}</div>
                        {inst.adminProfile && (
                          <div className="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-1">
                            <Key className="w-3 h-3 text-emerald-500" />
                            Pass: <span className="font-mono text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{inst.adminProfile.password}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {editingInstId === inst.id ? (
                          <input 
                            type="text" 
                            value={editCrestUrl} 
                            onChange={(e) => setEditCrestUrl(e.target.value)}
                            placeholder="Crest URL"
                            className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-xs px-2 py-1 rounded w-full focus:ring-violet-500 focus:border-violet-500"
                          />
                        ) : (
                          inst.schoolCrestUrl ? (
                            <img src={inst.schoolCrestUrl} alt="crest" className="w-6 h-6 object-contain rounded bg-white" />
                          ) : (
                            <span className="text-[10px] text-zinc-500">None</span>
                          )
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {editingInstId === inst.id ? (
                          <input 
                            type="text" 
                            value={editAcademicYear} 
                            onChange={(e) => setEditAcademicYear(e.target.value)}
                            placeholder="e.g. 2026/2027"
                            className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-xs px-2 py-1 rounded w-full focus:ring-violet-500 focus:border-violet-500"
                          />
                        ) : (
                          <span className="text-sm text-zinc-600 dark:text-zinc-400 font-medium">{inst.academicYear}</span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <select 
                          value={inst.activeTerm}
                          onChange={(e) => updateInstitutionTerm(inst, e.target.value)}
                          className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-xs px-2 py-1 rounded focus:ring-violet-500 focus:border-violet-500 w-full font-bold text-violet-700 dark:text-violet-400"
                        >
                          <option value="Term 1">Term 1</option>
                          <option value="Term 2">Term 2</option>
                          <option value="Term 3">Term 3</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {editingInstId === inst.id ? (
                            <>
                              <button 
                                onClick={() => saveSchoolChanges(inst.id)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded transition-colors"
                                title="Save Changes"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setEditingInstId(null)}
                                className="p-1.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={() => {
                                setEditSchoolName(inst.schoolName);
                                setEditCrestUrl(inst.schoolCrestUrl || '');
                                setEditAcademicYear(inst.academicYear || '2026/2027');
                                setEditingInstId(inst.id);
                              }}
                              className="p-1.5 text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors opacity-0 group-hover:opacity-100"
                              title="Edit School"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEndOfYearRollover(inst);
                          }}
                          className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="End of Year Rollover (Archive Term 3)"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteInstitution(inst);
                          }}
                          className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete School Permanently"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expanded Content: Teacher Accounts */}
                    {expandedInstId === inst.id && (
                      <tr className="bg-zinc-50/50 dark:bg-zinc-900/20 border-b border-zinc-200 dark:border-zinc-800/50">
                        <td colSpan="5" className="p-0">
                          <div className="px-10 py-4">
                            <h4 className="text-[11px] uppercase tracking-wider font-bold text-zinc-500 mb-3 flex items-center gap-2">
                              Enrolled Teachers / Admins ({inst.teachers?.length || 0})
                            </h4>
                            {inst.teachers && inst.teachers.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {inst.teachers.map(t => (
                                  <div key={t.uid} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-lg shadow-sm flex flex-col">
                                    <div className="font-bold text-zinc-900 dark:text-white text-xs">{t.name}</div>
                                    <div className="text-[10px] text-zinc-500">{t.email}</div>
                                    <div className="mt-2 flex items-center justify-between text-[10px]">
                                      <span className="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-2 py-0.5 rounded font-semibold">
                                        {t.assignedClass}
                                      </span>
                                      <div className="flex items-center gap-1 text-zinc-500">
                                        <Key className="w-3 h-3" />
                                        <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{t.password}</span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-zinc-500 italic">No teachers enrolled in this school yet.</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
