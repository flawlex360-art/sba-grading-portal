import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db, createTeacherUser } from '../utils/firebase';
import { Building2, Plus, LogOut, CheckCircle, AlertCircle, Edit, Trash2, Database } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SeniorSuperUserPanel({ onLogout, theme, toggleTheme }) {
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form State
  const [schoolName, setSchoolName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [activeTerm, setActiveTerm] = useState('Term 1');
  const [schoolCrestUrl, setSchoolCrestUrl] = useState('');
  
  const fetchInstitutions = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "institutions"));
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
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
            const gw1 = randInt(12, 25);   // Group Work 1 (out of 25)
            const test = randInt(10, 25);   // Class Test (out of 25)
            const gw2 = randInt(12, 25);   // Group Work 2 (out of 25)
            const proj = randInt(10, 25);   // Project (out of 25)
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

  const updateInstitutionTerm = async (id, newTerm) => {
    try {
      await setDoc(doc(db, "institutions", id), { activeTerm: newTerm }, { merge: true });
      toast.success("Active term updated!");
      setInstitutions(prev => prev.map(inst => inst.id === id ? { ...inst, activeTerm: newTerm } : inst));
    } catch (e) {
      console.error(e);
      toast.error("Failed to update term.");
    }
  };

  const deleteInstitution = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${name}? This will NOT delete the teachers, but will orphan them.`)) return;
    try {
      await deleteDoc(doc(db, "institutions", id));
      toast.success("School deleted.");
      setInstitutions(prev => prev.filter(inst => inst.id !== id));
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete school.");
    }
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-[#09090b] text-zinc-100' : 'bg-zinc-50 text-zinc-900'} font-sans select-none flex flex-col transition-colors duration-300`}>
      {/* Top Navbar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-950/60 backdrop-blur px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <img src="/icon.png" className="w-5 h-5 object-contain" alt="logo" />
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
                <th className="px-4 py-3 w-40">Active Term</th>
                <th className="px-4 py-3 w-20 text-center">Actions</th>
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
                  <tr key={inst.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/35 transition-colors">
                    <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white">
                      {inst.schoolName}
                      <div className="text-[9px] font-mono text-zinc-400 font-normal mt-0.5">ID: {inst.id}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{inst.adminEmail}</td>
                    <td className="px-4 py-3">
                      {inst.schoolCrestUrl ? (
                        <img src={inst.schoolCrestUrl} alt="crest" className="w-6 h-6 object-contain rounded bg-white" />
                      ) : (
                        <span className="text-[10px] text-zinc-500">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select 
                        value={inst.activeTerm}
                        onChange={(e) => updateInstitutionTerm(inst.id, e.target.value)}
                        className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-xs px-2 py-1 rounded focus:ring-violet-500 focus:border-violet-500 w-full font-bold text-violet-700 dark:text-violet-400"
                      >
                        <option value="Term 1">Term 1</option>
                        <option value="Term 2">Term 2</option>
                        <option value="Term 3">Term 3</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button 
                        onClick={() => deleteInstitution(inst.id, inst.schoolName)}
                        className="p-1.5 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded transition-colors"
                        title="Delete School"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
