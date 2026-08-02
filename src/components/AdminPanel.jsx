import React, { useState, useEffect } from 'react';
import { db, createTeacherUser, updateTeacherPassword, deleteTeacherAccount } from '../utils/firebase';
import { collection, doc, setDoc, getDocs, getDoc, deleteDoc, query, where } from 'firebase/firestore';
import { 
  UserPlus, Users, LogOut, Shield, CheckCircle, AlertCircle, Sparkles, 
  Sun, Moon, Pencil, X, Trash2, Server, CloudUpload, RefreshCw, Eye, EyeOff, FastForward,
  LayoutDashboard, FileSpreadsheet, Archive, Printer, Settings
} from 'lucide-react';
import toast from 'react-hot-toast';
import ConsolidatedView from './ConsolidatedView';
import ReportEditor from './ReportEditor';
import TrendAnalysis from './TrendAnalysis';
import ReportCard from './ReportCard';
import Gradebook from './Gradebook';
import { exportYearlyData } from '../utils/excelExport';
import { computeClassResults } from '../utils/calculations';

const getDirectImageUrl = (url) => {
  if (!url) return '';
  let fileId = null;
  const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (dMatch && dMatch[1]) fileId = dMatch[1];
  else if (idMatch && idMatch[1]) fileId = idMatch[1];
  
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  return url;
};

export default function AdminPanel({ adminUser, onLogout, theme, toggleTheme, institution: propInstitution }) {
  const [adminTab, setAdminTab] = useState('accounts');
  const [teachers, setTeachers] = useState([]);
  const [teachersLoading, setTeachersLoading] = useState(true);
  const [institution, setInstitution] = useState(propInstitution);

  useEffect(() => {
    if (propInstitution) {
      setInstitution(propInstitution);
    } else if (adminUser?.email) {
      const fetchInstitution = async () => {
        try {
          const q = query(collection(db, "institutions"), where("adminEmail", "==", adminUser.email.toLowerCase().trim()));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const instDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            instDocs.sort((a,b) => (a.createdAt || a.id).localeCompare(b.createdAt || b.id));
            setInstitution(instDocs[0]);
          }
        } catch(e) {
          console.error(e);
        }
      };
      fetchInstitution();
    }
  }, [propInstitution, adminUser]);
  
  // Print State
  const [printAll, setPrintAll] = useState(false);
  const [printSingleStudent, setPrintSingleStudent] = useState(null);
  const [printData, setPrintData] = useState(null);

  const fetchTeachersList = async () => {
    if (!institution || !institution.id) {
      setTeachers([]);
      setTeachersLoading(false);
      return;
    }
    setTeachersLoading(true);
    try {
      const q = query(collection(db, "teachers"), where("institutionId", "==", institution.id));
      const snap = await getDocs(q);
      const list = [];
      snap.forEach(doc => {
        const data = doc.data();

        // Incomplete / Corrupted Record Guard
        if (!data.email || !data.name) return;

        // Strict Tenant Boundary Guard: Document institutionId MUST match institution.id
        if (data.institutionId !== institution.id) return;

        // Admin & System User Exclusion Guard
        const isNotTeacher = data.isAdmin || 
                             data.isSeniorSuperUser || 
                             data.email === 'admin@school.com' || 
                             data.email === 'system@flawlex.com' || 
                             data.email === institution?.adminEmail || 
                             data.assignedClass === 'System';

        if (!isNotTeacher) {
          list.push({ uid: doc.id, ...data });
        }
      });
      list.sort((a,b) => new Date(b.createdDate) - new Date(a.createdDate));
      setTeachers(list);
    } catch (err) {
      console.error("Failed to load teachers", err);
    } finally {
      setTeachersLoading(false);
    }
  };

  useEffect(() => {
    if (institution) fetchTeachersList();
  }, [institution]);

  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintAll(false);
      setPrintSingleStudent(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const isPrinting = printAll || !!printSingleStudent;


  return (
    <>
      <div className={`min-h-screen bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 font-sans select-none flex flex-col transition-colors duration-300 ${isPrinting ? 'no-print hidden-for-print' : ''}`}>
        
        {/* Top Navbar */}
        <header className="border-b border-zinc-200 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-950/60 backdrop-blur px-6 py-4 flex items-center justify-between shadow-sm no-print">
          <div className="flex items-center gap-3">
            {institution?.schoolCrestUrl ? (
              <img src={getDirectImageUrl(institution.schoolCrestUrl)} referrerPolicy="no-referrer" className="w-8 h-8 object-contain bg-white rounded p-0.5 shadow-sm" alt="Crest" />
            ) : (
              <img src="/icon.png" className="w-6 h-6 object-contain" alt="Flawlex logo" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black tracking-tight text-sm text-zinc-900 dark:text-zinc-100 uppercase">Administrator Panel</span>
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-300 dark:border-emerald-700">SUPER ADMIN</span>
              </div>
              {institution?.schoolName && (
                <p className="text-xs font-bold text-emerald-ink dark:text-emerald-400 tracking-wide mt-0.5">
                  {institution.schoolName}
                </p>
              )}
            </div>
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

        {/* Admin Tabs */}
        <nav className="bg-white dark:bg-[#0c0c0f] border-b border-zinc-200 dark:border-zinc-800 px-3 md:px-6 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar select-none no-print shadow-sm z-10">
          {[
            { id: 'accounts', name: 'User Management', icon: Users },
            { id: 'overview', name: 'Classes Overview', icon: LayoutDashboard },
            { id: 'reports', name: 'Report Cards', icon: FileSpreadsheet },
            { id: 'archives', name: 'Data Archives', icon: Archive }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = adminTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setAdminTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg border transition-all whitespace-nowrap flex-shrink-0 ${
                  isActive
                    ? 'border-emerald-500/30 bg-emerald-600 dark:bg-emerald-600 text-white font-bold shadow-sm shadow-emerald-600/20'
                    : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-850 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
  
        {/* Main Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 transition-all duration-300">
          
          {adminTab === 'accounts' && <AdminAccountsTab teachers={teachers} fetchTeachersList={fetchTeachersList} fetching={teachersLoading} institution={institution} />}
          {adminTab === 'overview' && <AdminOverviewTab teachers={teachers} />}
          {adminTab === 'reports' && (
            <AdminReportsTab 
              teachers={teachers} 
              setPrintAll={setPrintAll} 
              setPrintSingleStudent={setPrintSingleStudent} 
              setPrintData={setPrintData}
              institution={institution}
            />
          )}
          {adminTab === 'archives' && <AdminArchivesTab institution={institution} />}
          
        </main>
      </div>

      {/* Root-Level Print Layout (bypasses all outer margin/padding spacing) */}
      {isPrinting && printData && (
        <div className="print-all-container">
          {printAll ? (
            printData.students.map(student => (
              <ReportCard
                key={student.sn}
                student={student}
                metadata={printData.metadata}
                calculatedScores={printData.computedResults}
                teacherSubjects={printData.teacherSubjects}
                currentUser={printData.currentUser}
                institution={institution}
              />
            ))
          ) : (
            <ReportCard
              student={printSingleStudent}
              metadata={printData.metadata}
              calculatedScores={printData.computedResults}
              teacherSubjects={printData.teacherSubjects}
              currentUser={printData.currentUser}
            />
          )}
        </div>
      )}
    </>
  );
}


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

function AdminAccountsTab({ teachers, fetchTeachersList, fetching, institution }) {
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
    const [academicYear, setAcademicYear] = useState('2025/2026');

  const [loading, setLoading] = useState(false);
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



  // Default initial school template for newly registered teachers
  const getInitialSchoolData = (tName, cName, sName, dist, trm, acadYr) => {
    const termMap = { "ONE": "Term 1", "TWO": "Term 2", "THREE": "Term 3" };
    const mappedActiveTerm = termMap[trm] || "Term 1";
    
    return {
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
      activeTerm: mappedActiveTerm,
      terms: {
        [mappedActiveTerm]: {
          grades: {},
          students: []
        }
      },
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
  };
};


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
    if (!editDistrict || !editAcademicYear || !editPassword) {
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
        const oldTerm = currentData.metadata?.term || "ONE";
        const newTerm = editTerm;
        
        let newActiveTerm = currentData.activeTerm || "Term 1";
        let newTerms = currentData.terms || { [newActiveTerm]: { grades: currentData.grades || {}, students: currentData.students || [] } };
        
        // Handle term change (promotion/switching)
        if (oldTerm !== newTerm) {
           const mapTerm = { "ONE": "Term 1", "TWO": "Term 2", "THREE": "Term 3" };
           newActiveTerm = mapTerm[newTerm] || "Term 1";
           
           if (!newTerms[newActiveTerm]) {
              // Create the new term, copying students from the previous active term
              let currentRoster = newTerms[currentData.activeTerm]?.students || currentData.students || [];
              const cleanRoster = currentRoster.map(s => {
                  const newStudent = { ...s };
                  delete newStudent.headTeacherRemark;
                  delete newStudent.classTeacherRemark;
                  return newStudent;
              });
              newTerms[newActiveTerm] = {
                  grades: {},
                  students: cleanRoster
              };
           }
        }

        updatedSchoolData = {
          ...currentData,
          activeTerm: newActiveTerm,
          terms: newTerms,
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

  const handleDeleteTeacher = (teacher) => {
    const targetUid = teacher.uid || teacher.id || teacher.docId;
    if (!targetUid) {
      toast.error("Invalid teacher record.");
      return;
    }

    toast.custom((t) => (
      <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-white dark:bg-zinc-900 shadow-2xl rounded-xl pointer-events-auto flex flex-col p-5 border border-zinc-200 dark:border-zinc-800`}>
        <p className="text-sm font-bold text-zinc-900 dark:text-white mb-1">Delete Teacher Account?</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Are you sure you want to permanently delete "{teacher.name}"? This erases their account and all student data.</p>
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
              toast.dismiss(t.id);
              const loadingId = toast.loading(`Deleting "${teacher.name}"...`);
              try {
                // Step 1: Delete Firestore teacher profile (MUST succeed)
                await deleteDoc(doc(db, "teachers", targetUid));
                
                // Step 2: Delete Firestore school grade sheet
                await deleteDoc(doc(db, "schools", targetUid)).catch(() => {});
                
                // Step 3: Delete Firebase Auth credentials so they can never log in again
                if (teacher.email) {
                  const pass = teacher.password || 'password123';
                  try {
                    await deleteTeacherAccount(teacher.email, pass);
                  } catch (authErr) {
                    console.warn(`Auth cleanup for ${teacher.email}:`, authErr.message);
                    // Even if Auth delete fails, the server-side security guard in App.jsx 
                    // will block login because teachers/{uid} doc no longer exists
                  }
                }

                // Step 4: ONLY update UI after server confirms deletion
                await fetchTeachersList();
                toast.dismiss(loadingId);
                toast.success(`"${teacher.name}" permanently deleted!`);
              } catch (err) {
                console.error("Delete failed:", err);
                toast.dismiss(loadingId);
                toast.error(`Failed to delete "${teacher.name}": ${err.message}`);
              }
            }}
          >
            Delete Permanently
          </button>
        </div>
      </div>
    ), { duration: Infinity });
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

      if (!institution || !institution.id) {
        toast.error("Security Error: No active institution linked to your administrator session. Please log in again.");
        setLoading(false);
        return;
      }

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
        subjects: finalSubjects,
        institutionId: institution.id
      };
      await setDoc(teacherDocRef, teacherInfo);

      // 3. Initialize default school database template in Firestore 'schools'
      const schoolDocRef = doc(db, "schools", teacherUid);
      await setDoc(schoolDocRef, getInitialSchoolData(
        finalName,
        assignedClass,
        institution ? institution.schoolName : schoolName.trim(),
        district.trim(),
        institution ? institution.activeTerm : 'Term 1',
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


  return (
    <>


      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 5 Columns: Creator Form */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Main Creator Card */}
          <div className="glass-card p-6 border border-zinc-200 dark:border-zinc-800/80 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-ink/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800/80 pb-3 mb-5">
              <UserPlus className="w-5 h-5 text-emerald-ink dark:text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Generate Teacher Account</h3>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Register login credential, school details and class</p>
              </div>
            </div>

            {successMsg && (
              <div className="bg-emerald-ink border border-emerald-900 text-white rounded-lg p-3 text-xs flex gap-2 mb-4 animate-fade-in shadow-md">
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
                <p className="font-medium">{successMsg}</p>
              </div>
            )}

            {errorMsg && (
              <div className="bg-zinc-900 border border-zinc-800 text-white rounded-lg p-3 text-xs flex gap-2 mb-4 shadow-md">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
                <p className="font-medium">{errorMsg}</p>
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
                    className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink"
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
                    className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink"
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

              {/* Row 2: District */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">District</label>
                  <input
                    type="text"
                    required
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="e.g. Kpando"
                    className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Academic Year</label>
                  <input
                    type="text"
                    required
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="e.g. 2025/2026"
                    className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink"
                  />
                </div>
              </div>


              {/* Row 3: Email & Password */}
              <div className="grid grid-cols-2 gap-3 border-t border-zinc-200 dark:border-zinc-800/80 pt-3">
                <div>
                  <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Login Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teacher@school.com"
                    className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink"
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
                    className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink font-mono"
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
                      setLevel(e.target.value);
                      if (e.target.value === 'Primary') {
                        setSelectedSubjects(PRIMARY_SUBJECTS_LIST.map(s => s.key));
                      } else {
                        setSelectedSubjects(JHS_SUBJECTS_LIST.filter(s => s.key !== 'FRENCH' && s.key !== 'ARABIC').map(s => s.key));
                      }
                    }}
                    className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink appearance-none"
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
                    className="text-[10px] text-emerald-ink dark:text-emerald-400 hover:underline"
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
                          className="rounded border-zinc-300 dark:border-zinc-800 text-emerald-ink focus:ring-emerald-ink w-3.5 h-3.5"
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
                className="w-full bg-emerald-ink hover:bg-emerald-900 disabled:opacity-50 text-white rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow"
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

        </div>

        {/* Right 7 Columns: Active accounts log */}
        <div className="lg:col-span-7 space-y-4 flex flex-col h-full">
          <div className="glass-card p-6 border border-zinc-200 dark:border-zinc-800/80 flex flex-col h-full">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 pb-3 mb-5">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-ink dark:text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Active Teacher Accounts</h3>
                  <p className="text-[10px] text-zinc-550 dark:text-zinc-400 mt-0.5">Manage credentials for the Flawlex Technologies SBA Portal ({teachers.length} active)</p>
                </div>
              </div>
            </div>

            {fetching ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-zinc-500 dark:text-zinc-400 text-xs">
                <span className="w-6 h-6 border-2 border-zinc-200 dark:border-zinc-700 border-t-emerald-ink dark:border-t-emerald-ink rounded-full animate-spin mb-2" />
                Retrieving active roster...
              </div>
            ) : teachers.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-zinc-500 text-xs border border-dashed border-zinc-250 dark:border-zinc-800 rounded-xl">
                No teacher accounts found. Use the creator form to register a new teacher.
              </div>
            ) : (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-x-auto no-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold select-none text-center">
                      <th className="px-2 py-3 text-left">Teacher Name</th>
                      <th className="px-2 py-3 text-left">Email Address</th>
                      <th className="px-2 py-3 w-20">Class</th>
                      <th className="px-2 py-3 w-20">Level</th>
                      <th className="px-2 py-3 w-20">Term</th>
                                            <th className="px-2 py-3 w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-medium">
                    {teachers.map((teacher) => (
                      <tr key={teacher.uid} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/35 transition-colors text-center text-zinc-750 dark:text-zinc-300">
                        <td className="px-2 py-2.5 text-left font-bold text-zinc-900 dark:text-white">{teacher.name}</td>
                        <td className="px-2 py-2.5 text-left text-zinc-500 dark:text-zinc-400 font-mono text-[11px]">{teacher.email}</td>
                        <td className="px-2 py-2.5 font-mono text-[11px]">
                          <span className="bg-emerald-ink/10 text-emerald-ink dark:text-emerald-400 border border-emerald-ink/20 dark:border-emerald-ink/25 px-2 py-0.5 rounded text-[10px] font-bold">
                            {teacher.assignedClass}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-zinc-550 dark:text-zinc-400 font-semibold text-[10px]">
                          {teacher.level || 'JHS'}
                        </td>
                        <td className="px-2 py-2.5 text-zinc-550 dark:text-zinc-400 font-semibold text-[10px]">
                          <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded">
                            {teacher.activeTerm || 'Term 1'}
                          </span>
                        </td>
                                                <td className="px-2 py-2.5 flex justify-center gap-1.5">
                          <button
                            onClick={() => handleEditClick(teacher)}
                            className="p-1 rounded bg-emerald-ink/10 hover:bg-emerald-ink/25 text-emerald-ink dark:text-emerald-400 border border-emerald-ink/20 transition-colors"
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

      </div>

      {/* Edit Teacher Modal Backdrop Overlay */}
      {selectedTeacher && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 max-w-md w-full max-h-[95vh] rounded-2xl p-6 shadow-2xl relative overflow-y-auto custom-scrollbar animate-scale-in">
            <button
              onClick={() => setSelectedTeacher(null)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-450 hover:text-zinc-800 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-5">
              <Pencil className="w-5 h-5 text-emerald-ink dark:text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Edit Teacher Profile</h3>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Modify class assignment, school name and settings</p>
              </div>
            </div>

            {editLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-xs text-zinc-500">
                <span className="w-6 h-6 border-2 border-zinc-250 border-t-emerald-ink rounded-full animate-spin mb-2" />
                Loading teacher metadata...
              </div>
            ) : (
              <form onSubmit={handleSaveEdit} className="space-y-4 text-xs font-semibold text-zinc-650 dark:text-zinc-300">
                {editSuccess && (
                  <div className="bg-emerald-ink border border-emerald-900 text-white rounded-lg p-2.5 text-[11px] flex gap-2 shadow-sm">
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-emerald-400" />
                    <p className="font-medium">{editSuccess}</p>
                  </div>
                )}
                {editError && (
                  <div className="bg-zinc-900 border border-zinc-800 text-white rounded-lg p-2.5 text-[11px] flex gap-2 shadow-sm">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-rose-500" />
                    <p className="font-medium">{editError}</p>
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
                      className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Teacher Password</label>
                    <input
                      type="text"
                      required
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                      className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink font-mono"
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
                      className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink"
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
                      className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink"
                    >
                      <option value="ONE">ONE</option>
                      <option value="TWO">TWO</option>
                      <option value="THREE">THREE</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">District</label>
                    <input
                      type="text"
                      required
                      value={editDistrict}
                      onChange={(e) => setEditDistrict(e.target.value)}
                      className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Academic Year</label>
                    <input
                      type="text"
                      required
                      value={editAcademicYear}
                      onChange={(e) => setEditAcademicYear(e.target.value)}
                      className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink"
                    />
                  </div>
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
                      className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink appearance-none"
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
                      className="text-[10px] text-emerald-ink dark:text-emerald-400 hover:underline"
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
                            className="rounded border-zinc-300 dark:border-zinc-800 text-emerald-ink focus:ring-emerald-ink w-3 h-3"
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
                    className="flex-1 bg-emerald-ink hover:bg-emerald-900 disabled:opacity-50 text-white rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1 transition-colors shadow"
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

      <footer className="w-full text-center py-4 text-[10px] text-zinc-500 font-medium mt-auto">
        SBA portal by Flawlex Technologiess (0592664865)
      </footer>
    </>
  );
}




// -------------------------------------------------------------
// Sub-components for Admin Tabs
// -------------------------------------------------------------

function AdminOverviewTab({ teachers }) {
  const [classData, setClassData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState(null);
  const [viewMode, setViewMode] = useState('positions'); // 'trends' or 'positions'
  const [selectedTerm, setSelectedTerm] = useState('Term 1');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const enriched = await Promise.all(teachers.map(async (t) => {
          const docRef = doc(db, "schools", t.uid);
          const docSnap = await getDoc(docRef);
          const sData = docSnap.exists() ? docSnap.data() : null;
          const activeTerm = sData?.activeTerm || "Term 1";
          const activeTermData = sData?.terms?.[activeTerm] || { students: [], grades: {} };
          return {
            ...t,
            schoolData: sData,
            students: activeTermData.students || [],
            grades: activeTermData.grades || {}
          };
        }));
        setClassData(enriched);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    if (teachers.length > 0) loadData();
    else setLoading(false);
  }, [teachers]);

  if (loading) return <div className="p-8 text-center text-zinc-500">Loading class overviews...</div>;

  // Helper: build subjectMap & subjectsList from teacher's stored subjects
  const buildSubjectInfo = (teacherProfile) => {
    const subjects = teacherProfile?.subjects;
    if (subjects && Array.isArray(subjects) && subjects.length > 0) {
      const map = {};
      subjects.forEach(sub => { map[sub.name] = sub.key; });
      return { subjectMap: map, subjectsList: subjects.map(s => s.name), teacherSubjects: subjects };
    }
    // Fallback based on level
    const isJHS = ['BS. 7', 'BS. 8', 'BS. 9'].includes(teacherProfile?.assignedClass);
    const fallback = isJHS
      ? { "English Language": "ENG. LANG.", "Mathematics": "MATHS", "Science": "SCIENCE", "Career Technology": "C. TECH", "Social Studies": "SOCIAL", "Computing": "COMPUTING", "Religious and Moral Education": "RME", "Ghanaian Language": "GH. LANG.", "Creative Arts & Design": "C. ARTS" }
      : { "English Language": "ENG. LANG.", "Mathematics": "MATHS", "Science": "SCIENCE", "History": "HISTORYY", "Our World Our People": "OWOP", "Computing": "COMPUTING", "Religious and Moral Education": "RME", "Ghanaian Language": "GH. LANG.", "Creative Arts": "C. ARTS" };
    return { subjectMap: fallback, subjectsList: Object.keys(fallback), teacherSubjects: Object.entries(fallback).map(([name, key]) => ({ name, key })) };
  };

  if (selectedClass) {
    // Get term-specific data
    const termData = selectedClass.schoolData?.terms?.[selectedTerm] || { students: [], grades: {} };
    const termStudents = termData.students || [];
    const termGrades = termData.grades || {};
    const { subjectMap, subjectsList, teacherSubjects: tSubjects } = buildSubjectInfo(selectedClass);

    const computedResults = termStudents.length > 0
      ? computeClassResults(termStudents, termGrades, subjectsList, subjectMap)
      : [];

    // Get available terms
    const availableTerms = Object.keys(selectedClass.schoolData?.terms || {}).sort();

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSelectedClass(null)}
            className="px-3 py-1.5 text-xs font-semibold text-zinc-600 bg-zinc-200 dark:bg-zinc-800 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
          >
            ← Back to Classes
          </button>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
            {selectedClass.assignedClass} - {selectedClass.name}
          </h2>
        </div>

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setViewMode('positions')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${viewMode === 'positions' ? 'bg-emerald-ink text-white shadow-sm' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800'}`}
          >
            Class Positions
          </button>
          <button
            onClick={() => setViewMode('trends')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${viewMode === 'trends' ? 'bg-emerald-ink text-white shadow-sm' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800'}`}
          >
            Performance Trends
          </button>

          {viewMode === 'positions' && availableTerms.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Academic Term:</span>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                {availableTerms.map(t => (
                  <option key={t} value={t}>{t} — {selectedClass.schoolData?.metadata?.academicYear || ''}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {viewMode === 'trends' ? (
          <TrendAnalysis 
            termData={selectedClass.schoolData?.terms || {}}
            students={selectedClass.students}
            metadata={selectedClass.schoolData?.metadata || {}}
            teacherSubjects={tSubjects}
          />
        ) : (
          termStudents.length > 0 ? (
            <ConsolidatedView
              computedResults={computedResults}
              teacherSubjects={tSubjects}
              metadata={selectedClass.schoolData?.metadata || {}}
            />
          ) : (
            <div className="text-center p-12 text-zinc-500 text-sm">
              No student data available for <strong>{selectedTerm}</strong>. Please select another term.
            </div>
          )
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-fade-in">
      {classData.map(c => (
        <div 
          key={c.uid}
          onClick={() => setSelectedClass(c)}
          className="glass-card p-5 border border-zinc-200 dark:border-zinc-800/80 rounded-xl hover:border-emerald-ink/30 cursor-pointer transition-all hover:shadow-lg dark:hover:shadow-emerald-ink/5 group"
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white group-hover:text-emerald-ink dark:group-hover:text-emerald-400 transition-colors">{c.assignedClass}</h3>
              <p className="text-[11px] text-zinc-500 font-medium">{c.name}</p>
            </div>
            <span className="bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 px-2 py-1 rounded text-[10px] font-bold border border-zinc-200 dark:border-zinc-800">
              {c.students.length} Learners
            </span>
          </div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Level</div>
          <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{c.level || 'JHS'}</div>
        </div>
      ))}
      {classData.length === 0 && !loading && (
        <div className="col-span-full text-center p-8 text-zinc-500">No classes available.</div>
      )}
    </div>
  );
}

function AdminReportsTab({ teachers, setPrintAll, setPrintSingleStudent, setPrintData, institution }) {
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [classData, setClassData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState('Term 1');

  // Find the selected teacher's profile to get their subjects
  const selectedTeacher = teachers.find(t => t.uid === selectedTeacherId);

  useEffect(() => {
    if (!selectedTeacherId) {
      setClassData(null);
      return;
    }
    async function loadData() {
      setLoading(true);
      try {
        const docRef = doc(db, "schools", selectedTeacherId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const sData = docSnap.data();
          const active = sData.activeTerm || 'Term 1';
          setSelectedTerm(active);
          setClassData(sData);
        } else {
          setClassData(null);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedTeacherId]);

  // Build subject info from the teacher profile
  const buildSubjectInfo = (teacherProfile) => {
    const subjects = teacherProfile?.subjects;
    if (subjects && Array.isArray(subjects) && subjects.length > 0) {
      const map = {};
      subjects.forEach(sub => { map[sub.name] = sub.key; });
      return { subjectMap: map, subjectsList: subjects.map(s => s.name), teacherSubjects: subjects };
    }
    const isJHS = ['BS. 7', 'BS. 8', 'BS. 9'].includes(teacherProfile?.assignedClass);
    const fallback = isJHS
      ? { "English Language": "ENG. LANG.", "Mathematics": "MATHS", "Science": "SCIENCE", "Career Technology": "C. TECH", "Social Studies": "SOCIAL", "Computing": "COMPUTING", "Religious and Moral Education": "RME", "Ghanaian Language": "GH. LANG.", "Creative Arts & Design": "C. ARTS" }
      : { "English Language": "ENG. LANG.", "Mathematics": "MATHS", "Science": "SCIENCE", "History": "HISTORYY", "Our World Our People": "OWOP", "Computing": "COMPUTING", "Religious and Moral Education": "RME", "Ghanaian Language": "GH. LANG.", "Creative Arts": "C. ARTS" };
    return { subjectMap: fallback, subjectsList: Object.keys(fallback), teacherSubjects: Object.entries(fallback).map(([name, key]) => ({ name, key })) };
  };

  const { subjectMap, subjectsList, teacherSubjects: tSubjects } = buildSubjectInfo(selectedTeacher);

  const currentTermData = classData?.terms?.[selectedTerm] || { students: [], grades: {} };
  const currentStudents = currentTermData.students || [];
  const currentGrades = currentTermData.grades || {};

  const computedResults = currentStudents.length > 0 && classData
    ? computeClassResults(currentStudents, currentGrades, subjectsList, subjectMap)
    : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="glass-card p-6 border border-zinc-200 dark:border-zinc-800/80 rounded-xl flex items-end gap-4 max-w-xl">
        <div className="flex-1">
          <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 font-semibold">
            Select Class to View Report Cards
          </label>
          <select
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-ink"
          >
            <option value="">-- Choose a Class --</option>
            {teachers.map(t => (
              <option key={t.uid} value={t.uid}>{t.assignedClass} ({t.name})</option>
            ))}
          </select>
        </div>
        
        {classData && (
          <div className="flex-1">
            <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 font-semibold">
              Select Term
            </label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-ink"
            >
              {Object.keys(classData.terms || {}).map(term => (
                <option key={term} value={term}>{term}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading && <div className="p-8 text-center text-zinc-500">Loading records...</div>}

      {classData && !loading && (
        <div className="mt-6">
           <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 p-4 rounded-lg text-center mb-6 border border-amber-200 dark:border-amber-800 font-semibold text-sm shadow-sm">
              ADMINISTRATIVE VIEW (READ-ONLY) - You can now batch print or preview individual report cards here.
           </div>
           <ReportEditor
              students={currentStudents}
              metadata={{...classData.metadata, term: selectedTerm}}
              computedResults={computedResults}
              dropLists={classData.dropLists}
              institution={institution}
              onSave={() => {}}
              onPrintAll={() => {
                setPrintData({ 
                  students: currentStudents, 
                  metadata: {...classData.metadata, term: selectedTerm}, 
                  computedResults, 
                  teacherSubjects: tSubjects, 
                  currentUser: { email: 'admin@school.com', uid: selectedTeacherId } 
                });
                setPrintAll(true);
                setTimeout(() => window.print(), 300);
              }}
              onPrintSingle={(s) => {
                setPrintData({ 
                  students: [s], 
                  metadata: {...classData.metadata, term: selectedTerm}, 
                  computedResults, 
                  teacherSubjects: tSubjects, 
                  currentUser: { email: 'admin@school.com', uid: selectedTeacherId } 
                });
                setPrintSingleStudent(s);
                setTimeout(() => window.print(), 300);
              }}
              teacherSubjects={tSubjects}
              viewingTerm={selectedTerm}
              isReadOnly={true}
           />
        </div>
      )}
    </div>
  );
}

function AdminArchivesTab({ institution }) {
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  useEffect(() => {
    async function loadArchives() {
      if (!institution?.id) return;
      try {
        const qArch = query(collection(db, "archives"), where("institutionId", "==", institution.id));
        const snap = await getDocs(qArch);
        const list = [];
        snap.forEach(docSnap => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        list.sort((a,b) => new Date(b.archivedAt) - new Date(a.archivedAt));
        setArchives(list);
        
        if (list.length > 0) {
           setSelectedYear(list[0].academicYear);
           setSelectedTerm(list[0].term);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadArchives();
  }, [institution]);

  const uniqueYears = [...new Set(archives.map(a => a.academicYear))];
  
  const teachersForSelection = archives.filter(a => 
    a.academicYear === selectedYear && a.term === selectedTerm
  );

  const selectedArchive = archives.find(a => 
    a.academicYear === selectedYear && 
    a.term === selectedTerm && 
    a.teacherId === selectedTeacherId
  );
  
  // Auto-select first teacher if available and none selected
  useEffect(() => {
     if (teachersForSelection.length > 0 && (!selectedTeacherId || !teachersForSelection.find(t => t.teacherId === selectedTeacherId))) {
         setSelectedTeacherId(teachersForSelection[0].teacherId);
     }
  }, [teachersForSelection, selectedTeacherId]);

  const handleDownloadExcel = () => {
    if (!selectedArchive) return;
    const termData = {
      [selectedArchive.term]: {
        grades: selectedArchive.grades || {},
        students: selectedArchive.students || []
      }
    };
    
    exportYearlyData(
      termData,
      {
         schoolName: institution?.schoolName || 'School',
         academicYear: selectedArchive.academicYear || 'Year',
         classAssigned: selectedArchive.teacherName || 'Class'
      },
      selectedArchive.subList || []
    );
    toast.success("Downloading archived Excel data...");
  };

  if (loading) {
     return <div className="p-8 text-center text-zinc-500 text-sm">Loading archives...</div>;
  }

  if (archives.length === 0) {
     return (
        <div className="glass-card p-12 text-center border border-zinc-200 dark:border-zinc-800/80 rounded-xl">
          <Archive className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
          <h3 className="text-zinc-500 font-semibold">No archives found</h3>
          <p className="text-xs text-zinc-400 mt-2 max-w-md mx-auto">
            When the academic year ends and data is wiped to start a new year, the archived records will appear here.
          </p>
        </div>
     );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Archive className="w-6 h-6 text-emerald-ink dark:text-emerald-400" />
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">Yearly Data Archives</h2>
      </div>

      <div className="glass-card p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-wrap gap-4 items-end">
         <div className="flex-1 min-w-[150px]">
           <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Academic Year</label>
           <select 
             value={selectedYear}
             onChange={(e) => setSelectedYear(e.target.value)}
             className="w-full bg-white dark:bg-[#121214] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-medium"
           >
             {uniqueYears.map(y => (
               <option key={y} value={y}>{y}</option>
             ))}
           </select>
         </div>
         <div className="flex-1 min-w-[150px]">
           <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Term</label>
           <select 
             value={selectedTerm}
             onChange={(e) => setSelectedTerm(e.target.value)}
             className="w-full bg-white dark:bg-[#121214] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-medium"
           >
             {["Term 1", "Term 2", "Term 3"].map(t => (
               <option key={t} value={t}>{t}</option>
             ))}
           </select>
         </div>
         <div className="flex-1 min-w-[200px]">
           <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Class / Teacher</label>
           <select 
             value={selectedTeacherId}
             onChange={(e) => setSelectedTeacherId(e.target.value)}
             className="w-full bg-white dark:bg-[#121214] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm font-medium text-emerald-ink dark:text-emerald-400"
           >
             {teachersForSelection.length === 0 && <option value="">No classes found</option>}
             {teachersForSelection.map(t => (
               <option key={t.teacherId} value={t.teacherId}>{t.teacherName}</option>
             ))}
           </select>
         </div>
         <div>
           <button
             onClick={handleDownloadExcel}
             disabled={!selectedArchive}
             className="px-4 py-2 bg-emerald-ink hover:bg-emerald-ink/90 text-white rounded-lg text-sm font-bold disabled:opacity-50 transition-colors flex items-center gap-2"
           >
             <FileSpreadsheet className="w-4 h-4" />
             Export Excel
           </button>
         </div>
      </div>
      
      {selectedArchive ? (
         <div className="mt-8">
           <Gradebook 
             students={selectedArchive.students || []}
             initialGrades={selectedArchive.grades || {}}
             viewingTerm={selectedArchive.term}
             isReadOnly={true}
             teacherSubjects={selectedArchive.subList || []}
           />
         </div>
      ) : (
         <div className="py-12 text-center text-zinc-500 text-sm">
            No archive data available for this selection.
         </div>
      )}
    </div>
  );
}
