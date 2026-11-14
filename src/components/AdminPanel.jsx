import React, { useState, useEffect } from 'react';
import { db, createTeacherUser, updateTeacherPassword, deleteTeacherAccount } from '../utils/firebase';
import { collection, doc, setDoc, updateDoc, getDocs, getDoc, deleteDoc, writeBatch, query, where } from 'firebase/firestore';
import { 
  UserPlus, Users, LogOut, Shield, CheckCircle, AlertCircle, Sparkles, 
  Sun, Moon, Pencil, X, Trash2, Server, CloudUpload, RefreshCw, Eye, EyeOff, FastForward,
  LayoutDashboard, FileSpreadsheet, Archive, Printer, Settings, BookOpen, MessageSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import ConsolidatedView from './ConsolidatedView';
import ReportEditor from './ReportEditor';
import TrendAnalysis from './TrendAnalysis';
import ReportCard from './ReportCard';
import Gradebook from './Gradebook';
import SchoolSmsConfigPanel from './SchoolSmsConfigPanel';
import { exportYearlyData } from '../utils/excelExport';
import { computeClassResults, isJhsClass } from '../utils/calculations';

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
  const [editingSubjectTeacherId, setEditingSubjectTeacherId] = useState('');

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
        <header className="border-b border-zinc-200 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-950/60 backdrop-blur px-6 py-4 flex flex-col sm:flex-row flex-wrap items-center justify-between gap-4 shadow-sm no-print">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            {institution?.schoolCrestUrl ? (
              <img src={getDirectImageUrl(institution.schoolCrestUrl)} referrerPolicy="no-referrer" className="w-8 h-8 object-contain bg-white rounded p-0.5 shadow-sm shrink-0" alt="Crest" />
            ) : (
              <img src="/icon.png" className="w-12 h-12 object-contain shrink-0" alt="Madifor logo" />
            )}
            <div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
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
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5 w-full sm:w-auto">
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
            { id: 'accounts', name: 'Class Management', icon: Users },
            { id: 'subjects', name: 'Subject Management', icon: BookOpen },
            { id: 'overview', name: 'Classes Overview', icon: LayoutDashboard },
            { id: 'reports', name: 'Report Cards', icon: FileSpreadsheet },
            { id: 'archives', name: 'Data Archives', icon: Archive },
            { id: 'sms', name: 'SMS & Package', icon: MessageSquare }
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
          
          {adminTab === 'accounts' && (
            <AdminAccountsTab
              teachers={teachers}
              fetchTeachersList={fetchTeachersList}
              fetching={teachersLoading}
              institution={institution}
              onOpenSubjectManagement={(teacher) => {
                setEditingSubjectTeacherId(teacher.uid);
                setAdminTab('subjects');
              }}
            />
          )}
          {adminTab === 'subjects' && (
            <AdminSubjectManagementTab
              teachers={teachers}
              fetchTeachersList={fetchTeachersList}
              fetching={teachersLoading}
              institution={institution}
              initialTeacherId={editingSubjectTeacherId}
              clearInitialTeacherId={() => setEditingSubjectTeacherId('')}
            />
          )}
          {adminTab === 'overview' && (
            <AdminOverviewTab
              teachers={teachers.filter(t => t.role !== 'subject_teacher' && t.assignedClass !== 'Subject Teacher')}
            />
          )}
          {adminTab === 'reports' && (
            <AdminReportsTab 
              teachers={teachers.filter(t => t.role !== 'subject_teacher' && t.assignedClass !== 'Subject Teacher')} 
              setPrintAll={setPrintAll} 
              setPrintSingleStudent={setPrintSingleStudent} 
              setPrintData={setPrintData}
              institution={institution}
            />
          )}
          {adminTab === 'archives' && <AdminArchivesTab institution={institution} />}
          {adminTab === 'sms' && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6">
              {institution?.id ? (
                <SchoolSmsConfigPanel
                  institution={institution}
                  canManagePackage={false}
                  onSaved={(updated) =>
                    setInstitution((prev) => (prev ? { ...prev, ...updated } : prev))
                  }
                />
              ) : (
                <div className="text-sm text-zinc-500 py-8 text-center">
                  Loading school SMS configuration...
                </div>
              )}
            </div>
          )}
          
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
                viewingTerm={printData.metadata?.term}
              />
            ))
          ) : (
            <ReportCard
              student={printSingleStudent}
              metadata={printData.metadata}
              calculatedScores={printData.computedResults}
              teacherSubjects={printData.teacherSubjects}
              currentUser={printData.currentUser}
              institution={institution}
              viewingTerm={printData.metadata?.term}
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

const ALL_CLASSES_LIST = [
  "BS. 7", "BS. 7A", "BS. 7B",
  "BS. 8", "BS. 8A", "BS. 8B",
  "BS. 9", "BS. 9A", "BS. 9B",
  "BS. 1", "BS. 1A", "BS. 1B",
  "BS. 2", "BS. 2A", "BS. 2B",
  "BS. 3", "BS. 3A", "BS. 3B",
  "BS. 4", "BS. 4A", "BS. 4B",
  "BS. 5", "BS. 5A", "BS. 5B",
  "BS. 6", "BS. 6A", "BS. 6B"
];

function AdminAccountsTab({ teachers, fetchTeachersList, fetching, institution, onOpenSubjectManagement }) {
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
    // Route dedicated subject teachers directly to the Subject Management tab so they don't accidentally get a dummy class doc created
    if (teacher.role === 'subject_teacher' && onOpenSubjectManagement) {
      onOpenSubjectManagement(teacher);
      return;
    }
    setSelectedTeacher(teacher);
    setEditName(teacher.name === 'New Teacher' ? '' : (teacher.name || ''));
    setEditClass(teacher.assignedClass || 'BS. 7');
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
    if (!editDistrict) {
      setEditError("All fields except Teacher's Name are required.");
      return;
    }

    setSavingEdit(true);
    setEditError('');
    setEditSuccess('');

    try {
      const finalEditName = editName.trim() || 'New Teacher';

      // 2. Update teachers/{uid} doc
      const finalEditSubjects = (editLevel === 'Primary' ? PRIMARY_SUBJECTS_LIST : JHS_SUBJECTS_LIST)
        .filter(s => editSelectedSubjects.includes(s.key));

      const teacherDocRef = doc(db, "teachers", selectedTeacher.uid);
      await setDoc(teacherDocRef, {
        name: finalEditName,
        assignedClass: editClass,
        level: editLevel,
        subjects: finalEditSubjects
      }, { merge: true });

      // 3. Update schools/{uid} metadata doc without overwriting nested terms/grades
      const schoolDocRef = doc(db, "schools", selectedTeacher.uid);
      const schoolDocSnap = await getDoc(schoolDocRef);
      
      if (schoolDocSnap.exists()) {
        const currentData = schoolDocSnap.data();
        const newActiveTerm = institution?.activeTerm || currentData.activeTerm || "Term 1";

        await setDoc(schoolDocRef, {
          activeTerm: newActiveTerm,
          metadata: {
            ...(currentData.metadata || {}),
            schoolName: institution?.schoolName || editSchoolName.trim(),
            district: editDistrict.trim(),
            classLevel: editClass,
            term: institution?.activeTerm === 'Term 3' ? 'THREE' : (institution?.activeTerm === 'Term 2' ? 'TWO' : 'ONE'),
            academicYear: institution?.academicYear || editAcademicYear.trim(),
            teacherName: finalEditName
          }
        }, { merge: true });
      } else {
        const updatedSchoolData = getInitialSchoolData(
          finalEditName,
          editClass,
          institution?.schoolName || editSchoolName.trim(),
          editDistrict.trim(),
          institution?.activeTerm || 'Term 1',
          institution?.academicYear || editAcademicYear.trim()
        );
        await setDoc(schoolDocRef, updatedSchoolData);
      }

      // 4. If class name changed, sync className inside any subject teachers' classAllocations pointing to this Form Master
      if (selectedTeacher.assignedClass !== editClass) {
        const holders = teachers.filter(other => other.classAllocations?.[selectedTeacher.uid]);
        for (const holder of holders) {
          const nextAlloc = structuredClone(holder.classAllocations || {});
          if (nextAlloc[selectedTeacher.uid]) {
            nextAlloc[selectedTeacher.uid].className = editClass;
            await updateDoc(doc(db, "teachers", holder.uid), {
              classAllocations: nextAlloc
            }).catch(() => {});
          }
        }
      }

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

                // Step 2b: Clean up any subject allocations on other teachers pointing to this deleted classUid
                const affectedTeachers = teachers.filter(other => other.uid !== targetUid && other.classAllocations?.[targetUid]);
                for (const other of affectedTeachers) {
                  const nextAlloc = { ...(other.classAllocations || {}) };
                  const nextKeys = { ...(other.allocationKeys || {}) };
                  delete nextAlloc[targetUid];
                  delete nextKeys[targetUid];
                  await updateDoc(doc(db, "teachers", other.uid), {
                    classAllocations: nextAlloc,
                    allocationKeys: nextKeys
                  }).catch(() => {});
                }
                
                // Step 3: Delete Firebase Auth credentials so they can never log in again
                if (teacher.email) {
                  try {
                    await deleteTeacherAccount(teacher.email, teacher.authPass || "").catch(() => {});
                  } catch (authErr) {
                    console.warn(`Auth cleanup for ${teacher.email}:`, authErr.message);
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
    if (!email || !password || !district) {
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
        authPass: password,
        assignedClass: assignedClass,
        createdDate: new Date().toISOString(),
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
        institution ? (institution.academicYear || "2026/2027") : academicYear.trim()
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
                      const calculatedLevel = isJhsClass(newClass) ? 'JHS' : 'Primary';
                      setLevel(calculatedLevel);
                      if (calculatedLevel === 'Primary') {
                        setSelectedSubjects(PRIMARY_SUBJECTS_LIST.map(s => s.key));
                      } else {
                        setSelectedSubjects(JHS_SUBJECTS_LIST.filter(s => s.key !== 'FRENCH' && s.key !== 'ARABIC').map(s => s.key));
                      }
                    }}
                    className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink"
                  >
                    {ALL_CLASSES_LIST.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
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
                    disabled
                    value={institution?.academicYear || "2026/2027"}
                    className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-500 cursor-not-allowed"
                    title="Managed by Senior Super Admin"
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
                  <p className="text-[10px] text-zinc-550 dark:text-zinc-400 mt-0.5">Manage credentials for the Madifor Technologies SBA Portal ({teachers.length} active)</p>
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
                          {teacher.role === 'subject_teacher' ? (
                            <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                              Subject Teacher
                            </span>
                          ) : (
                            <span className="bg-emerald-ink/10 text-emerald-ink dark:text-emerald-400 border border-emerald-ink/20 dark:border-emerald-ink/25 px-2 py-0.5 rounded text-[10px] font-bold">
                              {teacher.assignedClass}
                            </span>
                          )}
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
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Assigned Class</label>
                    <select
                      value={editClass}
                      onChange={(e) => {
                        const newClass = e.target.value;
                        setEditClass(newClass);
                        const calculatedLevel = isJhsClass(newClass) ? 'JHS' : 'Primary';
                        setEditLevel(calculatedLevel);
                        if (calculatedLevel === 'Primary') {
                          setEditSelectedSubjects(PRIMARY_SUBJECTS_LIST.map(s => s.key));
                        } else {
                          setEditSelectedSubjects(JHS_SUBJECTS_LIST.filter(s => s.key !== 'FRENCH' && s.key !== 'ARABIC').map(s => s.key));
                        }
                      }}
                      className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink"
                    >
                      {ALL_CLASSES_LIST.map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Term</label>
                    <input
                      type="text"
                      disabled
                      value={institution?.activeTerm || "Term 1"}
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-500 cursor-not-allowed uppercase"
                      title="Managed by Senior Super Admin"
                    />
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
                      disabled
                      value={institution?.academicYear || "2026/2027"}
                      className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-500 cursor-not-allowed"
                      title="Managed by Senior Super Admin"
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
        SBA portal by Madifor Technologies (0592664865)
      </footer>
    </>
  );
}




// -------------------------------------------------------------
// Sub-components for Admin Tabs
// -------------------------------------------------------------

function AdminSubjectManagementTab({ teachers, fetchTeachersList, fetching, institution, initialTeacherId, clearInitialTeacherId }) {
  const [mode, setMode] = useState('existing'); // 'existing' | 'new'
  const [selectedTeacherUid, setSelectedTeacherUid] = useState('');
  const [teacherRoleType, setTeacherRoleType] = useState('subject_teacher'); // 'subject_teacher' | 'class_teacher'
  const [homeClass, setHomeClass] = useState('BS. 7');

  // New Subject Teacher account fields
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Matrix state: { [classOwnerUid]: ['MATHS', 'SCIENCE'] }
  const [matrixSelection, setMatrixSelection] = useState({});
  const [saving, setSaving] = useState(false);
  const [pendingConflicts, setPendingConflicts] = useState(null);

  // Live class data for coverage & grading tracker
  const [jhsSchoolsMap, setJhsSchoolsMap] = useState({});
  const [coverageClassUid, setCoverageClassUid] = useState('');

  // JHS teachers eligible in this school
  const jhsTeachers = teachers.filter(t => t.level === 'JHS' || isJhsClass(t.assignedClass) || t.role === 'subject_teacher');

  // Official JHS Form Master classes (excluding dedicated subject teachers, and if editing an existing teacher as dedicated subject teacher, excluding their own duplicate class doc)
  const jhsFormClasses = teachers.filter(t => {
    if (t.role === 'subject_teacher' || t.assignedClass === 'Subject Teacher') return false;
    if (!isJhsClass(t.assignedClass) && t.level !== 'JHS') return false;
    if (mode === 'existing' && teacherRoleType === 'subject_teacher' && t.uid === selectedTeacherUid) {
      return false;
    }
    return true;
  }).sort((a, b) => (a.assignedClass || '').localeCompare(b.assignedClass || ''));

  // Load school documents for JHS classes to power the live grading completion tracker
  useEffect(() => {
    let active = true;
    async function loadJhsSchoolDocs() {
      const formClasses = teachers.filter(t => t.role !== 'subject_teacher' && (isJhsClass(t.assignedClass) || t.level === 'JHS'));
      const map = {};
      await Promise.all(formClasses.map(async (fc) => {
        try {
          const snap = await getDoc(doc(db, "schools", fc.uid));
          if (snap.exists()) {
            map[fc.uid] = snap.data();
          }
        } catch (e) {
          console.error(e);
        }
      }));
      if (active) {
        setJhsSchoolsMap(map);
        if (!coverageClassUid && formClasses.length > 0) {
          setCoverageClassUid(formClasses[0].uid);
        }
      }
    }
    if (teachers.length > 0) loadJhsSchoolDocs();
    return () => { active = false; };
  }, [teachers]);

  // Select teacher helper
  const handleSelectExistingTeacher = (uid) => {
    setSelectedTeacherUid(uid);
    setPendingConflicts(null);
    const found = teachers.find(t => t.uid === uid);
    if (!found) {
      setMatrixSelection({});
      return;
    }

    // Determine default role type: if they already have role === 'subject_teacher' or only have 1-2 subjects assigned on a duplicate class, suggest 'subject_teacher'
    const existingAlloc = found.classAllocations || {};
    const hasExistingAlloc = Object.keys(existingAlloc).length > 0;
    const isLikelySubjectOnly = found.role === 'subject_teacher' ||
      (Array.isArray(found.subjects) && found.subjects.length > 0 && found.subjects.length <= 3);

    setTeacherRoleType(isLikelySubjectOnly ? 'subject_teacher' : 'class_teacher');
    setHomeClass(isJhsClass(found.assignedClass) ? found.assignedClass : 'BS. 7');

    if (hasExistingAlloc) {
      const nextMatrix = {};
      Object.entries(existingAlloc).forEach(([cUid, entry]) => {
        const targetUid = entry?.classUid || cUid;
        nextMatrix[targetUid] = (entry?.subjects || []).map(s => s.key);
      });
      setMatrixSelection(nextMatrix);
    } else {
      setMatrixSelection({});
    }
  };

  // Handle deep-link from User Management tab
  useEffect(() => {
    if (initialTeacherId && teachers.some(t => t.uid === initialTeacherId)) {
      setMode('existing');
      handleSelectExistingTeacher(initialTeacherId);
      if (clearInitialTeacherId) clearInitialTeacherId();
    } else if (!selectedTeacherUid && jhsTeachers.length > 0 && mode === 'existing') {
      handleSelectExistingTeacher(jhsTeachers[0].uid);
    }
  }, [initialTeacherId, teachers]);

  // Find who currently holds (classUid, subjectKey) among OTHER teachers
  const getSlotHolder = (classUid, subjectKey) => {
    const currentEditingUid = mode === 'existing' ? selectedTeacherUid : null;
    for (const t of teachers) {
      if (t.uid === currentEditingUid) continue;
      const alloc = t.classAllocations?.[classUid];
      if (alloc && Array.isArray(alloc.subjects) && alloc.subjects.some(s => s.key === subjectKey)) {
        return t;
      }
    }
    return null;
  };

  const toggleMatrixCell = (classUid, subjectKey) => {
    setPendingConflicts(null);
    setMatrixSelection(prev => {
      const currentList = prev[classUid] || [];
      const exists = currentList.includes(subjectKey);
      const nextList = exists
        ? currentList.filter(k => k !== subjectKey)
        : [...currentList, subjectKey];
      return {
        ...prev,
        [classUid]: nextList
      };
    });
  };

  const computeConflicts = () => {
    const conflicts = [];
    Object.entries(matrixSelection).forEach(([classUid, subKeys]) => {
      const clsObj = jhsFormClasses.find(c => c.uid === classUid);
      if (!clsObj) return;
      (subKeys || []).forEach(subKey => {
        const holder = getSlotHolder(classUid, subKey);
        if (holder) {
          const subObj = JHS_SUBJECTS_LIST.find(s => s.key === subKey);
          conflicts.push({
            classUid,
            className: clsObj.assignedClass,
            subjectKey: subKey,
            subjectName: subObj?.name || subKey,
            holderUid: holder.uid,
            holderName: holder.name
          });
        }
      });
    });
    return conflicts;
  };

  const handleSaveAllocations = async (e, forceConfirmTransfer = false) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!institution?.id) {
      toast.error("No active institution found.");
      return;
    }

    // Build clean classAllocations & allocationKeys maps for active JHS classes
    const builtAllocations = {};
    const builtKeys = {};
    let totalSubjectsSelected = 0;

    jhsFormClasses.forEach(cls => {
      const chosenKeys = matrixSelection[cls.uid] || [];
      if (chosenKeys.length > 0) {
        const subObjects = JHS_SUBJECTS_LIST.filter(s => chosenKeys.includes(s.key));
        if (subObjects.length > 0) {
          builtAllocations[cls.uid] = {
            classUid: cls.uid,
            className: cls.assignedClass,
            subjects: subObjects
          };
          builtKeys[cls.uid] = subObjects.map(s => s.key);
          totalSubjectsSelected += subObjects.length;
        }
      }
    });

    if (mode === 'new') {
      if (!newName.trim() || !newEmail.trim() || !newPassword) {
        toast.error("Please enter Teacher Name, Login Email, and Password.");
        return;
      }
      if (totalSubjectsSelected === 0) {
        toast.error("Please tick at least one JHS Class & Subject in the grid below.");
        return;
      }
    } else {
      if (!selectedTeacherUid) {
        toast.error("Please select a teacher first.");
        return;
      }
    }

    // Check for conflicts with other teachers
    const conflicts = computeConflicts();
    if (conflicts.length > 0 && !forceConfirmTransfer) {
      setPendingConflicts(conflicts);
      return;
    }

    setSaving(true);
    try {
      let targetUid = selectedTeacherUid;
      let targetName = newName.trim();

      if (mode === 'new') {
        targetUid = await createTeacherUser(newEmail.trim(), newPassword);
      } else {
        const existingT = teachers.find(t => t.uid === selectedTeacherUid);
        targetName = existingT?.name || 'Teacher';

        // Safety check: if converting an existing teacher to 'Dedicated Subject Teacher', verify their schools/{uid} doc has 0 students
        if (teacherRoleType === 'subject_teacher' && existingT?.role !== 'subject_teacher') {
          const checkSnap = await getDoc(doc(db, "schools", targetUid));
          if (checkSnap.exists()) {
            const sData = checkSnap.data();
            const totalLearners = ['Term 1', 'Term 2', 'Term 3'].reduce((sum, tName) => {
              return sum + (sData.terms?.[tName]?.students?.length || 0);
            }, 0) + (sData.students?.length || 0);
            if (totalLearners > 0) {
              toast.error(
                `Cannot convert "${targetName}" to a Dedicated Subject Teacher because their class (${existingT?.assignedClass || 'Form Class'}) already has enrolled learners! Please select "JHS Form Master + Extra Classes" instead.`,
                { duration: 6000 }
              );
              setSaving(false);
              return;
            }
          }
        }
      }

      const batch = writeBatch(db);

      // 1. If there were conflicts confirmed for transfer, remove those slots from previous holders using batch.update so deleted keys are removed
      if (conflicts.length > 0) {
        const holdersToUpdate = {};
        conflicts.forEach(c => {
          if (!holdersToUpdate[c.holderUid]) {
            const holderDoc = teachers.find(t => t.uid === c.holderUid);
            holdersToUpdate[c.holderUid] = {
              classAllocations: structuredClone(holderDoc?.classAllocations || {}),
              allocationKeys: structuredClone(holderDoc?.allocationKeys || {})
            };
          }
          const hAlloc = holdersToUpdate[c.holderUid].classAllocations[c.classUid];
          if (hAlloc && Array.isArray(hAlloc.subjects)) {
            hAlloc.subjects = hAlloc.subjects.filter(s => s.key !== c.subjectKey);
            if (hAlloc.subjects.length === 0) {
              delete holdersToUpdate[c.holderUid].classAllocations[c.classUid];
              delete holdersToUpdate[c.holderUid].allocationKeys[c.classUid];
            } else {
              holdersToUpdate[c.holderUid].allocationKeys[c.classUid] = hAlloc.subjects.map(s => s.key);
            }
          }
        });

        Object.entries(holdersToUpdate).forEach(([hUid, updatedMaps]) => {
          batch.update(doc(db, "teachers", hUid), updatedMaps);
        });
      }

      // 2. Ensure any assigned subject (e.g. FRENCH or ARABIC) is also enabled on the target Form Master's class subject list
      Object.entries(builtAllocations).forEach(([cUid, allocEntry]) => {
        const formMaster = teachers.find(t => t.uid === cUid);
        if (formMaster) {
          const currentSubs = Array.isArray(formMaster.subjects) && formMaster.subjects.length > 0
            ? [...formMaster.subjects]
            : JHS_SUBJECTS_LIST.filter(s => s.key !== 'FRENCH' && s.key !== 'ARABIC');
          let changed = false;
          allocEntry.subjects.forEach(sub => {
            if (!currentSubs.some(cs => cs.key === sub.key)) {
              currentSubs.push(sub);
              changed = true;
            }
          });
          if (changed) {
            batch.update(doc(db, "teachers", cUid), { subjects: currentSubs });
          }
        }
      });

      // 3. Save target teacher document (use batch.update for existing teachers so unticked classAllocations keys are cleanly replaced)
      if (mode === 'new') {
        batch.set(doc(db, "teachers", targetUid), {
          name: targetName,
          email: newEmail.trim().toLowerCase(),
          authPass: newPassword,
          role: 'subject_teacher',
          assignedClass: 'Subject Teacher',
          level: 'JHS',
          institutionId: institution.id,
          createdDate: new Date().toISOString(),
          classAllocations: builtAllocations,
          allocationKeys: builtKeys
        });
        // If reclaiming an email that was previously a Class Teacher before being deleted, remove any leftover blank school doc
        batch.delete(doc(db, "schools", targetUid));
      } else {
        const isDedicated = teacherRoleType === 'subject_teacher';
        batch.update(doc(db, "teachers", targetUid), {
          role: isDedicated ? 'subject_teacher' : 'class_teacher',
          assignedClass: isDedicated ? 'Subject Teacher' : homeClass,
          level: 'JHS',
          classAllocations: builtAllocations,
          allocationKeys: builtKeys
        });

        // If converted to Dedicated Subject Teacher, clean up any orphaned blank duplicate schools/{uid} document
        if (isDedicated) {
          batch.delete(doc(db, "schools", targetUid));
        }
      }

      await batch.commit();
      setPendingConflicts(null);

      if (mode === 'new') {
        toast.success(`Subject Teacher "${targetName}" created and allocated!`);
        setNewName('');
        setNewEmail('');
        setNewPassword('');
        setMatrixSelection({});
      } else {
        toast.success(`Subject allocations updated for "${targetName}"!`);
      }

      await fetchTeachersList();
    } catch (err) {
      console.error("Failed saving subject allocations:", err);
      toast.error(err.message || "Failed to save subject allocations.");
    } finally {
      setSaving(false);
    }
  };

  const allocatedTeachersList = teachers.filter(t =>
    t.role === 'subject_teacher' ||
    (t.classAllocations && Object.keys(t.classAllocations).length > 0)
  );

  const selectedCoverageClass = jhsFormClasses.find(c => c.uid === coverageClassUid) || jhsFormClasses[0] || null;
  const selectedCoverageSchoolDoc = selectedCoverageClass ? jhsSchoolsMap[selectedCoverageClass.uid] : null;
  const activeCoverageTerm = institution?.activeTerm || selectedCoverageSchoolDoc?.activeTerm || 'Term 1';
  const activeCoverageTermData = selectedCoverageSchoolDoc?.terms?.[activeCoverageTerm] || { students: [], grades: {}, gradeMeta: {} };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
      {/* Left 6 Columns: Creator & Matrix Allocation Editor */}
      <div className="lg:col-span-6 space-y-4">
        <div className="glass-card p-6 border border-zinc-200 dark:border-zinc-800/80 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-ink dark:text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">JHS Subject Allocation Matrix</h3>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Assign multiple subjects across JHS classes (BS. 7, BS. 8, BS. 9) to a single login
                </p>
              </div>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setMode('existing');
                setPendingConflicts(null);
                if (jhsTeachers.length > 0 && !selectedTeacherUid) {
                  handleSelectExistingTeacher(jhsTeachers[0].uid);
                }
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                mode === 'existing'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Assign / Convert Existing Teacher
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('new');
                setPendingConflicts(null);
                setMatrixSelection({});
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                mode === 'new'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              + New Subject Teacher Login
            </button>
          </div>

          <form onSubmit={(e) => handleSaveAllocations(e, false)} className="space-y-4 text-xs font-semibold">
            {mode === 'existing' ? (
              <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900/40 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div>
                  <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Select JHS Teacher Account
                  </label>
                  <select
                    value={selectedTeacherUid}
                    onChange={(e) => handleSelectExistingTeacher(e.target.value)}
                    className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink"
                  >
                    <option value="">-- Select Teacher --</option>
                    {jhsTeachers.map(t => (
                      <option key={t.uid} value={t.uid}>
                        {t.name} ({t.email}) — {t.role === 'subject_teacher' ? 'Subject Teacher' : t.assignedClass}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedTeacherUid && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                        Account Role Type
                      </label>
                      <select
                        value={teacherRoleType}
                        onChange={(e) => setTeacherRoleType(e.target.value)}
                        className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink"
                      >
                        <option value="subject_teacher">Dedicated Subject Teacher (No Form Class)</option>
                        <option value="class_teacher">Form Master + Subject Teacher</option>
                      </select>
                    </div>
                    {teacherRoleType === 'class_teacher' && (
                      <div>
                        <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                          Form Master Home Class
                        </label>
                        <select
                          value={homeClass}
                          onChange={(e) => setHomeClass(e.target.value)}
                          className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink"
                        >
                          {ALL_CLASSES_LIST.filter(c => isJhsClass(c)).map(cls => (
                            <option key={cls} value={cls}>{cls}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
                {teacherRoleType === 'subject_teacher' && selectedTeacherUid && (
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-lg p-2">
                    Saving as <strong>Dedicated Subject Teacher</strong> will link this login directly to the ticked JHS classes below and automatically remove any duplicate blank class record for this teacher.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900/40 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div>
                  <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Subject Teacher Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Amlado Seyram"
                    className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                      Login Email
                    </label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="maths@school.com"
                      className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                      Login Password
                    </label>
                    <input
                      type="text"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Class x Subject Allocation Checkbox Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-bold">
                  Tick Assigned JHS Classes & Subjects
                </label>
                <button
                  type="button"
                  onClick={() => setMatrixSelection({})}
                  className="text-[10px] text-zinc-500 hover:text-rose-500 underline"
                >
                  Clear All Ticks
                </button>
              </div>

              {jhsFormClasses.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-xl">
                  No JHS Form Master classes (BS. 7, BS. 8, BS. 9) found yet. Create the main class accounts in User Management first.
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300">
                        <th className="p-2.5 font-bold">JHS Subject</th>
                        {jhsFormClasses.map(cls => (
                          <th key={cls.uid} className="p-2 text-center min-w-[92px] border-l border-zinc-200 dark:border-zinc-800">
                            <div className="font-black text-emerald-ink dark:text-emerald-400 text-[11px]">{cls.assignedClass}</div>
                            <div className="text-[9px] font-medium text-zinc-400 truncate max-w-[90px] mx-auto" title={cls.name}>
                              {cls.name}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                      {JHS_SUBJECTS_LIST.map(sub => (
                        <tr key={sub.key} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
                          <td className="p-2.5 font-semibold text-zinc-800 dark:text-zinc-200">
                            <div>{sub.name}</div>
                            <div className="text-[9px] text-zinc-400 font-mono">{sub.key}</div>
                          </td>
                          {jhsFormClasses.map(cls => {
                            const isChecked = (matrixSelection[cls.uid] || []).includes(sub.key);
                            const holder = getSlotHolder(cls.uid, sub.key);
                            return (
                              <td
                                key={cls.uid}
                                onClick={() => toggleMatrixCell(cls.uid, sub.key)}
                                className={`p-2 text-center border-l border-zinc-200 dark:border-zinc-800 cursor-pointer select-none transition-colors ${
                                  isChecked
                                    ? 'bg-emerald-50/80 dark:bg-emerald-950/30'
                                    : holder
                                      ? 'bg-amber-50/40 dark:bg-amber-950/15'
                                      : ''
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className="rounded border-zinc-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                                />
                                {holder && (
                                  <div
                                    className="text-[9px] mt-0.5 px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-bold truncate max-w-[85px] mx-auto"
                                    title={`Currently assigned to ${holder.name}`}
                                  >
                                    {holder.name.split(' ')[0]}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Conflict Warning & Confirmation Card */}
            {pendingConflicts && pendingConflicts.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 dark:text-amber-200">
                    <p className="font-bold">Subject Reassignment Confirmation</p>
                    <p className="text-[11px] mt-0.5">
                      The following class subject(s) are currently assigned to another teacher. Confirming will automatically transfer them to this teacher:
                    </p>
                    <ul className="list-disc list-inside mt-1.5 space-y-0.5 text-[11px] font-semibold">
                      {pendingConflicts.map((c, idx) => (
                        <li key={idx}>
                          {c.className} — {c.subjectName} (from <strong>{c.holderName}</strong>)
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingConflicts(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={(e) => handleSaveAllocations(e, true)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                  >
                    {saving ? "Transferring..." : "Confirm & Transfer Subjects"}
                  </button>
                </div>
              </div>
            )}

            {!pendingConflicts && (
              <button
                type="submit"
                disabled={saving || jhsFormClasses.length === 0}
                className="w-full bg-emerald-ink hover:bg-emerald-900 disabled:opacity-50 text-white rounded-lg py-2.5 text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow"
              >
                {saving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving Subject Allocations...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {mode === 'new' ? 'Create Subject Teacher & Allocate' : 'Save Subject Allocations'}
                  </>
                )}
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Right 6 Columns: Allocated Subject Teachers Directory & Live Coverage Tracker */}
      <div className="lg:col-span-6 space-y-6">
        {/* Card 1: Active Subject Teachers & Multi-Class Teachers */}
        <div className="glass-card p-6 border border-zinc-200 dark:border-zinc-800/80 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Allocated JHS Subject Teachers ({allocatedTeachersList.length})
              </h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                Teachers with multi-class or subject-specific login access
              </p>
            </div>
          </div>

          {allocatedTeachersList.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
              No subject allocations configured yet. Use the matrix on the left to assign subjects across BS. 7, BS. 8, and BS. 9.
            </div>
          ) : (
            <div className="space-y-3 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
              {allocatedTeachersList.map(t => {
                const allocEntries = Object.values(t.classAllocations || {});
                return (
                  <div
                    key={t.uid}
                    className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 flex flex-col gap-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-zinc-900 dark:text-white">{t.name}</span>
                          {t.role === 'subject_teacher' ? (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800 font-bold uppercase">
                              Subject Teacher
                            </span>
                          ) : (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold uppercase">
                              Form Master ({t.assignedClass}) + Subject
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">{t.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('existing');
                          handleSelectExistingTeacher(t.uid);
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-ink/10 hover:bg-emerald-ink/20 text-emerald-ink dark:text-emerald-400 border border-emerald-ink/20 flex items-center gap-1 transition-colors shrink-0"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit Matrix
                      </button>
                    </div>

                    {allocEntries.length === 0 ? (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 italic">
                        No classes assigned yet — click Edit Matrix to allocate subjects.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {allocEntries.map(entry => (
                          <div
                            key={entry.classUid}
                            className="text-[10px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1 font-semibold"
                          >
                            <span className="font-black text-emerald-ink dark:text-emerald-400 mr-1.5">{entry.className}:</span>
                            <span className="text-zinc-700 dark:text-zinc-300">
                              {(entry.subjects || []).map(s => s.key).join(', ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Card 2: Live JHS Class Subject Coverage & Grading Tracker */}
        <div className="glass-card p-6 border border-zinc-200 dark:border-zinc-800/80 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Live JHS Subject Coverage & Grading Status
              </h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                Track which teacher holds each subject and whether marks have been entered ({activeCoverageTerm})
              </p>
            </div>
            {jhsFormClasses.length > 0 && (
              <select
                value={selectedCoverageClass?.uid || ''}
                onChange={(e) => setCoverageClassUid(e.target.value)}
                className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-bold text-emerald-ink dark:text-emerald-400"
              >
                {jhsFormClasses.map(cls => (
                  <option key={cls.uid} value={cls.uid}>
                    {cls.assignedClass} ({cls.name})
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedCoverageClass ? (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                    <th className="p-2.5">Subject</th>
                    <th className="p-2.5">Assigned Teacher</th>
                    <th className="p-2.5 text-center">Grading Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                  {(selectedCoverageClass.subjects || JHS_SUBJECTS_LIST.filter(s => s.key !== 'FRENCH' && s.key !== 'ARABIC')).map(sub => {
                    // Find subject teacher assigned to (selectedCoverageClass.uid, sub.key)
                    const assignedSubTeacher = teachers.find(t =>
                      t.classAllocations?.[selectedCoverageClass.uid]?.subjects?.some(s => s.key === sub.key)
                    );
                    const totalLearners = (activeCoverageTermData.students || []).length;
                    const subGradesMap = activeCoverageTermData.grades?.[sub.key] || {};
                    const gradedLearners = (activeCoverageTermData.students || []).filter(st => {
                      const g = subGradesMap[st.sn];
                      return g && (g.gw1 || g.test || g.gw2 || g.proj || g.exams);
                    }).length;
                    const meta = activeCoverageTermData.gradeMeta?.[sub.key];

                    return (
                      <tr key={sub.key} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30">
                        <td className="p-2.5 font-semibold text-zinc-800 dark:text-zinc-200">
                          {sub.name} <span className="text-[10px] text-zinc-400 font-mono">({sub.key})</span>
                        </td>
                        <td className="p-2.5">
                          {assignedSubTeacher ? (
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                              {assignedSubTeacher.name}
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-500">
                              {selectedCoverageClass.name} <span className="text-[9px] text-zinc-400">(Form Master)</span>
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center">
                          {totalLearners === 0 ? (
                            <span className="text-[10px] text-zinc-400">No Roster Yet</span>
                          ) : gradedLearners >= totalLearners ? (
                            <span
                              className="inline-block bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold"
                              title={meta?.updatedByName ? `Last saved by ${meta.updatedByName}` : ''}
                            >
                              {gradedLearners}/{totalLearners} Graded ✓
                            </span>
                          ) : gradedLearners > 0 ? (
                            <span
                              className="inline-block bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded text-[10px] font-bold"
                              title={meta?.updatedByName ? `Last saved by ${meta.updatedByName}` : ''}
                            >
                              {gradedLearners}/{totalLearners} In Progress
                            </span>
                          ) : (
                            <span className="inline-block bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded text-[10px] font-semibold">
                              0/{totalLearners} Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-zinc-500">
              No JHS classes available to inspect.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
    const isJHS = isJhsClass(teacherProfile?.assignedClass);
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
          onClick={() => {
            setSelectedTerm(c.schoolData?.activeTerm || 'Term 1');
            setSelectedClass(c);
          }}
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
    const isJHS = isJhsClass(teacherProfile?.assignedClass);
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
              termData={classData.terms}
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
