import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Users, FileSpreadsheet, Award, FileCode, Settings, Sun, Moon, Bot, Key, LogOut, Shield, ChevronDown, TrendingUp } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Roster from './components/Roster';
import Gradebook from './components/Gradebook';
import ConsolidatedView from './components/ConsolidatedView';
import ConsolidatedRecords from './components/ConsolidatedRecords';
import DropLists from './components/DropLists';
import ReportEditor from './components/ReportEditor';
import ChatPanel from './components/ChatPanel';
import ReportCard from './components/ReportCard';
import Login from './components/Login';
import AdminPanel from './components/AdminPanel';
import SeniorSuperUserPanel from './components/SeniorSuperUserPanel';
import { exportYearlyData } from './utils/excelExport';
import TrendAnalysis from './components/TrendAnalysis';
import { computeClassResults, isJhsClass } from './utils/calculations';
import { auth, db, getFirebaseConfig, isConfigValid } from './utils/firebase';
import { doc, getDoc, getDocFromServer, setDoc, updateDoc, FieldPath, deleteField, runTransaction, query, where, collection, getDocs } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import toast, { Toaster } from 'react-hot-toast';

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

const MAIN_TABS = [
  { id: 'dashboard', name: 'Home', icon: LayoutDashboard },
  { id: 'roster', name: 'Roster', icon: Users },
  { id: 'gradebook', name: 'Gradebook', icon: FileSpreadsheet },
  { id: 'positions', name: 'Class Overview', icon: Award },
  { id: 'open', name: 'Records (OPEN)', icon: FileCode },
  { id: 'reports', name: 'Report Cards', icon: FileCode },
  { id: 'trends', name: 'Progress & Trends', icon: TrendingUp }
];

const DEFAULT_JHS_SUBJECT_MAP = {
  "English Language": "ENG. LANG.",
  "Mathematics": "MATHS",
  "Science": "SCIENCE",
  "Career Technology": "C. TECH",
  "Social Studies": "SOCIAL",
  "Computing": "COMPUTING",
  "Religious and Moral Education": "RME",
  "Ghanaian Language": "GH. LANG.",
  "Creative Arts & Design": "C. ARTS"
};

const DEFAULT_PRIMARY_SUBJECT_MAP = {
  "English Language": "ENG. LANG.",
  "Mathematics": "MATHS",
  "Science": "SCIENCE",
  "History": "HISTORYY",
  "Our World Our People": "OWOP",
  "Computing": "COMPUTING",
  "Religious and Moral Education": "RME",
  "Ghanaian Language": "GH. LANG.",
  "Creative Arts": "C. ARTS"
};

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('school_active_tab') || 'dashboard';
  });
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    localStorage.setItem('school_active_tab', activeTab);
  }, [activeTab]);
  
  // Auth States
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [institution, setInstitution] = useState(null);
  
  // Multi-term states
  const [activeTerm, setActiveTerm] = useState('Term 1');
  const [viewingTerm, setViewingTerm] = useState('Term 1');
  const [termData, setTermData] = useState({});

  // Multi-class & Subject Teacher states
  const [accessibleClasses, setAccessibleClasses] = useState([]);
  const [activeClassEntry, setActiveClassEntry] = useState(null);
  const [classOwnerProfile, setClassOwnerProfile] = useState(null);
  const [rosterVersion, setRosterVersion] = useState(0);
  const rosterVersionRef = useRef(0);

  // Database States
  const [metadata, setMetadata] = useState(null);
  const [students, setStudents] = useState([]);
  const studentsRef = useRef([]);
  const [grades, setGrades] = useState({});
  const [dropLists, setDropLists] = useState(null);

  const isSubjectTeacherMode = Boolean(
    userProfile?.role === 'subject_teacher' ||
    (activeClassEntry && !activeClassEntry.isFormMaster)
  );
  const activeSchoolDocId = activeClassEntry?.classUid || currentUser?.uid;

  // Get full class subjects (for Report Cards / Broadsheet) and Gradebook subjects (scoped for Subject Teachers)
  const getTeacherSubjects = () => {
    const ownerProf = classOwnerProfile || userProfile;
    let fullClassSubjects = [];

    if (ownerProf && Array.isArray(ownerProf.subjects) && ownerProf.subjects.length > 0) {
      fullClassSubjects = ownerProf.subjects;
    } else {
      const effectiveClassName = activeClassEntry?.className || metadata?.classLevel || userProfile?.assignedClass || 'BS. 7';
      const isPrimary = ownerProf?.level === 'Primary' || (!isJhsClass(effectiveClassName) && ownerProf?.level !== 'JHS');
      const fallbackMap = isPrimary ? DEFAULT_PRIMARY_SUBJECT_MAP : DEFAULT_JHS_SUBJECT_MAP;
      fullClassSubjects = Object.entries(fallbackMap).map(([name, key]) => ({ name, key }));
    }

    // Ensure any allocated subjects for the active class are also represented in fullClassSubjects
    if (Array.isArray(activeClassEntry?.allocatedSubjects)) {
      activeClassEntry.allocatedSubjects.forEach(allocSub => {
        if (allocSub?.key && !fullClassSubjects.some(s => s.key === allocSub.key)) {
          fullClassSubjects = [...fullClassSubjects, allocSub];
        }
      });
    }

    const fullMap = {};
    fullClassSubjects.forEach(sub => {
      fullMap[sub.name] = sub.key;
    });

    // Restrict Gradebook tabs to allocated subjects when present (for Subject Teachers or JHS Form Masters with subject allocations)
    const gradebookSubjects = (Array.isArray(activeClassEntry?.allocatedSubjects) && activeClassEntry.allocatedSubjects.length > 0)
      ? activeClassEntry.allocatedSubjects
      : fullClassSubjects;

    return {
      subjectMap: fullMap,
      subjectsList: fullClassSubjects.map(s => s.name),
      teacherSubjects: fullClassSubjects,
      gradebookSubjects
    };
  };

  const { subjectMap, subjectsList, teacherSubjects, gradebookSubjects } = getTeacherSubjects();
  const [isLoading, setIsLoading] = useState(true);

  // API Key & Chat states
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [printAll, setPrintAll] = useState(false);
  const [printSingleStudent, setPrintSingleStudent] = useState(null);

  const handlePrintAll = () => {
    setPrintAll(true);
    setTimeout(() => {
      window.print();
      setPrintAll(false);
    }, 250);
  };

  const handlePrintSingle = (student) => {
    setPrintSingleStudent(student);
    setTimeout(() => {
      window.print();
      setPrintSingleStudent(null);
    }, 500);
  };

  const handlePrintAnalytics = (aiSummaryText) => {
    const subjectCount = teacherSubjects?.length || 9;
    const totalStudents = computedResults.length;
    const classAvg = totalStudents > 0 
      ? (computedResults.reduce((sum, s) => sum + (s.overallTotal || 0), 0) / (totalStudents * subjectCount)).toFixed(1)
      : '0';
    const passCount = computedResults.filter(s => (s.overallTotal / subjectCount) >= 40).length;
    const passRate = totalStudents > 0 ? ((passCount / totalStudents) * 100).toFixed(1) : '0';

    const sorted = [...computedResults].sort((a, b) => b.overallTotal - a.overallTotal);
    const top5 = sorted.slice(0, 5);
    const bottom5 = sorted.slice(-5);

    const topRows = top5.map((s, i) => `<tr><td style="padding:8px;border:1px solid #ccc;font-weight:bold">${i+1}</td><td style="padding:8px;border:1px solid #ccc">${s.name}</td><td style="padding:8px;border:1px solid #ccc;text-align:right">${(s.overallTotal / subjectCount).toFixed(1)}%</td></tr>`).join('');
    const bottomRows = bottom5.map((s, i) => `<tr><td style="padding:8px;border:1px solid #ccc;font-weight:bold">${totalStudents - 4 + i}</td><td style="padding:8px;border:1px solid #ccc">${s.name}</td><td style="padding:8px;border:1px solid #ccc;text-align:right">${(s.overallTotal / subjectCount).toFixed(1)}%</td></tr>`).join('');

    // Convert AI summary markdown to simple HTML
    let summaryHtml = '<p style="color:#888;font-style:italic">AI Summary not generated. Please generate the AI summary on the dashboard before exporting.</p>';
    if (aiSummaryText) {
      summaryHtml = aiSummaryText
        .replace(/^### (.*$)/gm, '<h3 style="margin-top:20px;margin-bottom:8px;font-size:16px;color:#111">$1</h3>')
        .replace(/^## (.*$)/gm, '<h2 style="margin-top:24px;margin-bottom:12px;font-size:20px;color:#111">$1</h2>')
        .replace(/^# (.*$)/gm, '<h1 style="margin-top:20px;margin-bottom:16px;font-size:24px;border-bottom:2px solid #e4e4e7;padding-bottom:8px;color:#111">$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^- (.*$)/gm, '<li style="margin-left:16px;margin-bottom:4px">$1</li>')
        .replace(/\n\n/g, '</p><p style="margin-bottom:12px;font-size:14px;line-height:1.7">')
        .replace(/\n/g, '<br/>');
      summaryHtml = '<p style="margin-bottom:12px;font-size:14px;line-height:1.7">' + summaryHtml + '</p>';
    }

    const html = `<html>
      <head>
        <title>Analytics Report - ${metadata?.classLevel || 'Class'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; color: #18181b; line-height: 1.6; }
          .page { padding: 40px; page-break-after: always; }
          .page:last-child { page-break-after: auto; }
          h1 { font-size: 24px; margin-bottom: 8px; }
          h2 { font-size: 20px; margin-bottom: 12px; padding-bottom: 4px; border-bottom: 1px solid #ccc; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { padding: 8px; border: 1px solid #ccc; background: #f4f4f5; text-align: left; font-size: 12px; }
          td { padding: 8px; border: 1px solid #ccc; }
          .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 24px 0; }
          .kpi-card { border: 1px solid #d4d4d8; border-radius: 8px; padding: 16px; text-align: center; }
          .kpi-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #71717a; margin-bottom: 4px; }
          .kpi-value { font-size: 28px; font-weight: 800; }
          .sig-row { display: flex; justify-content: space-between; margin-top: 80px; padding: 0 40px; }
          .sig-block { text-align: center; width: 240px; }
          .sig-line { border-bottom: 1px solid #000; height: 48px; margin-bottom: 4px; }
          .sig-title { font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; }
          .sig-sub { font-size: 11px; color: #71717a; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="page">
          <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:16px;margin-bottom:24px">
            <h1 style="font-size:28px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px">${metadata?.schoolName || 'School Name'}</h1>
            <div style="font-size:16px;font-weight:600;color:#555;text-transform:uppercase">${metadata?.district || ''}</div>
            <div style="margin-top:12px;display:flex;justify-content:center;gap:32px;font-size:13px;font-weight:600">
              <span>CLASS: ${metadata?.classLevel || 'N/A'}</span>
              <span>TERM: ${metadata?.term || 'N/A'}</span>
              <span>ACADEMIC YEAR: ${metadata?.academicYear || 'N/A'}</span>
            </div>
          </div>

          <div style="text-align:center;background:#f4f4f5;padding:20px;border-radius:8px;border:1px solid #d4d4d8;margin-bottom:28px">
            <h2 style="font-size:22px;font-weight:700;border:none;margin-bottom:12px">Class Performance Analytics Report</h2>
            <div class="kpi-grid">
              <div class="kpi-card"><div class="kpi-label">Class Average</div><div class="kpi-value" style="color:#059669">${classAvg}%</div></div>
              <div class="kpi-card"><div class="kpi-label">Pass Rate</div><div class="kpi-value" style="color:#2563eb">${passRate}%</div></div>
              <div class="kpi-card"><div class="kpi-label">Enrolment</div><div class="kpi-value">${totalStudents}</div></div>
            </div>
          </div>

          <div style="margin-bottom:20px">${summaryHtml}</div>
        </div>

        <div class="page">
          <h2>Top 5 Students</h2>
          <table style="margin-bottom:32px"><thead><tr><th>Pos</th><th>Name</th><th style="text-align:right">Average</th></tr></thead><tbody>${topRows}</tbody></table>

          <h2>Bottom 5 Students</h2>
          <table style="margin-bottom:32px"><thead><tr><th>Pos</th><th>Name</th><th style="text-align:right">Average</th></tr></thead><tbody>${bottomRows}</tbody></table>

          <div class="sig-row">
            <div class="sig-block">
              <div class="sig-line"></div>
              <div class="sig-title">Class Teacher</div>
              <div class="sig-sub">${metadata?.teacherName || ''}</div>
              <div class="sig-sub">Signature & Date</div>
            </div>
            <div class="sig-block">
              <div class="sig-line"></div>
              <div class="sig-title">Headmaster</div>
              <div class="sig-sub">${metadata?.headTeacherName || ''}</div>
              <div class="sig-sub">Signature, Date & Stamp</div>
            </div>
          </div>
        </div>
      </body>
    </html>`;

    const win = window.open('', '', 'left=0,top=0,width=800,height=900,toolbar=0,scrollbars=1,status=0');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  };

  // Hide document title during printing so it doesn't show in the browser print header
  useEffect(() => {
    const originalTitle = document.title;
    const handleBeforePrint = () => {
      document.title = '\u200B'; // zero-width space
    };
    const handleAfterPrint = () => {
      document.title = originalTitle;
    };
    
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  // Auth Subscription Listener
  const buildAccessibleClasses = (profile, uid) => {
    if (!profile || !uid) return [];
    const list = [];
    const allocMap = profile.classAllocations || {};
    const isDedicatedSubjectTeacher = profile.role === 'subject_teacher';

    // 1. If the teacher is a Form Master / Class Teacher, add their home class first
    if (!isDedicatedSubjectTeacher && profile.assignedClass && profile.assignedClass !== 'Subject Teacher') {
      const homeAlloc = allocMap[uid];
      list.push({
        classUid: uid,
        className: profile.assignedClass,
        isFormMaster: true,
        allocatedSubjects: Array.isArray(homeAlloc?.subjects) && homeAlloc.subjects.length > 0
          ? homeAlloc.subjects
          : null
      });
    }

    // 2. Add any additional JHS classes allocated to this teacher
    Object.entries(allocMap).forEach(([targetUid, alloc]) => {
      const cUid = alloc?.classUid || targetUid;
      if (!cUid) return;
      if (list.some(item => item.classUid === cUid)) return;
      if (Array.isArray(alloc?.subjects) && alloc.subjects.length > 0) {
        list.push({
          classUid: cUid,
          className: alloc.className || 'Assigned Class',
          isFormMaster: false,
          allocatedSubjects: alloc.subjects
        });
      }
    });

    return list;
  };

  // Auth Subscription Listener with Strict Multi-Tenant Isolation & Self-Healing
  useEffect(() => {
    if (!auth) {
      setIsLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // 1. Immediately purge all session state to prevent cross-session leakage
      setCurrentUser(user);
      setUserProfile(null);
      setInstitution(null);
      setMetadata(null);
      setStudents([]);
      studentsRef.current = [];
      setGrades({});
      setDropLists(null);
      setTermData({});
      setAccessibleClasses([]);
      setActiveClassEntry(null);
      setClassOwnerProfile(null);
      setRosterVersion(0);
      rosterVersionRef.current = 0;

      if (user) {
        setIsLoading(true);
        try {
          // 2. Fetch profile from 'teachers' collection — BYPASS IndexedDB cache to get fresh server data
          const profileDocRef = doc(db, "teachers", user.uid);
          let profileSnap;
          try {
            profileSnap = await getDocFromServer(profileDocRef);
          } catch (serverErr) {
            // Fallback to cache if offline
            console.warn("Server read failed, falling back to cache:", serverErr);
            profileSnap = await getDoc(profileDocRef);
          }
          let profileData = profileSnap.exists() ? profileSnap.data() : null;
          const userEmail = (user.email || '').toLowerCase().trim();

          // Check if Senior Super User
          if (userEmail === 'system@flawlex.com' || profileData?.isSeniorSuperUser) {
            setUserProfile({
              isSeniorSuperUser: true,
              name: "Senior Super User",
              email: user.email,
              ...profileData
            });
            setIsLoading(false);
            return;
          }

          // Determine if Admin User
          const isAdminUser = profileData?.isAdmin === true;

          // 3. Resolve Institution
          let userInstId = profileData?.institutionId;
          let instData = null;

          if (userInstId && userInstId !== 'unknown') {
            const instSnap = await getDoc(doc(db, "institutions", userInstId));
            if (instSnap.exists()) {
              instData = { id: instSnap.id, ...instSnap.data() };
            }
          }

          // If no institution loaded yet, query institutions by adminEmail
          if (!instData && userEmail) {
            const qInst = query(collection(db, "institutions"), where("adminEmail", "==", userEmail));
            const qSnap = await getDocs(qInst);
            if (!qSnap.empty) {
              const instDocs = qSnap.docs.map(d => ({ id: d.id, ...d.data() }));
              instDocs.sort((a,b) => (a.createdAt || a.id).localeCompare(b.createdAt || b.id));
              instData = instDocs[0];
              userInstId = instData.id;
            }
          }

          // ═══════════════════════════════════════════════════════
          // SECURITY GUARD: DELETED ACCOUNT DETECTION
          // If no profile doc exists on the SERVER and user is NOT a
          // registered institution admin, REJECT LOGIN immediately.
          // ═══════════════════════════════════════════════════════
          if (!profileSnap.exists() && !instData) {
            console.warn(`SECURITY: Deleted account login blocked for ${user.email} (${user.uid})`);
            sessionStorage.setItem(
              'auth_deleted_error',
              'Invalid login credentials. This account has been deleted by an administrator and can no longer be used.'
            );
            await signOut(auth);
            setCurrentUser(null);
            setUserProfile(null);
            setInstitution(null);
            setIsLoading(false);
            toast.error("This account has been deleted by an administrator and can no longer be used.");
            return;
          }

          if (instData) {
            setInstitution(instData);
          }

          // Self-heal teacher profile document if institutionId was missing or outdated
          if (profileSnap.exists() && userInstId && profileData?.institutionId !== userInstId) {
            await setDoc(profileDocRef, { institutionId: userInstId }, { merge: true });
            profileData = { ...profileData, institutionId: userInstId };
          }

          // 4. Handle Admin vs Teacher profile state
          if (isAdminUser) {
            setUserProfile({
              isAdmin: true,
              name: profileData?.name || "Admin",
              email: user.email,
              institutionId: userInstId,
              ...profileData
            });

            // Unblock UI immediately so Admin dashboard renders with zero delay
            setIsLoading(false);
            return;
          } else {
            // Teacher with valid profile
            const currentProf = profileData;
            setUserProfile(currentProf);

            const classesList = buildAccessibleClasses(currentProf, user.uid);
            setAccessibleClasses(classesList);

            const storedClassUid = sessionStorage.getItem('targetViewingClassUid');
            const chosenClass = classesList.find(c => c.classUid === storedClassUid) || classesList[0] || null;
            setActiveClassEntry(chosenClass);
            sessionStorage.removeItem('targetViewingClassUid');

            // If dedicated subject teacher has no classes allocated yet, do NOT auto-create a school doc
            if (currentProf?.role === 'subject_teacher' && !chosenClass) {
              setIsLoading(false);
              return;
            }

            const targetSchoolUid = chosenClass?.classUid || user.uid;
            await fetchTeacherData(targetSchoolUid, userInstId, currentProf, chosenClass, user.uid);
          }
        } catch (e) {
          console.error("Error loading user session:", e);
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const fetchTeacherData = async (uid, instId, currentProf = null, chosenClass = null, authUid = null) => {
    setIsLoading(true);
    try {
      let activeInstTerm = null;
      let fetchedInstData = null;

      if (instId && instId !== 'unknown') {
        const instRef = doc(db, "institutions", instId);
        const instSnap = await getDoc(instRef);
        if (instSnap.exists()) {
           fetchedInstData = { id: instSnap.id, ...instSnap.data() };
           setInstitution(fetchedInstData);
           activeInstTerm = fetchedInstData.activeTerm;
        }
      }

      // If loading another Form Master's class as a Subject Teacher, fetch the class owner's profile for full subject list
      if (uid && authUid && uid !== authUid) {
        try {
          let ownerSnap;
          try {
            ownerSnap = await getDocFromServer(doc(db, "teachers", uid));
          } catch {
            ownerSnap = await getDoc(doc(db, "teachers", uid));
          }
          if (ownerSnap.exists()) {
            setClassOwnerProfile(ownerSnap.data());
          }
        } catch (ownerErr) {
          console.warn("Could not fetch class owner profile:", ownerErr);
        }
      } else {
        setClassOwnerProfile(currentProf);
      }

      const isSubTeacherForThisClass = Boolean(
        currentProf?.role === 'subject_teacher' ||
        (chosenClass && !chosenClass.isFormMaster)
      );

      const docRef = doc(db, "schools", uid);
      let docSnap;
      try {
        docSnap = await getDocFromServer(docRef);
      } catch {
        docSnap = await getDoc(docRef);
      }

      if (docSnap.exists()) {
        const data = docSnap.data();
        
        let loadedTerms = data.terms ? structuredClone(data.terms) : null;
        let loadedActiveTerm = activeInstTerm || data.activeTerm || "Term 1";
        let needsMigrationWrite = false;

        // Auto-migrate legacy structure
        if (!loadedTerms) {
          loadedTerms = {
            "Term 1": {
              grades: data.grades || {},
              students: data.students || []
            }
          };
          needsMigrationWrite = true;
        }
        
        // Ensure all 3 terms exist
        ['Term 1', 'Term 2', 'Term 3'].forEach(t => {
          if (!loadedTerms[t]) {
            loadedTerms[t] = { grades: {}, students: [] };
            needsMigrationWrite = true;
          }
        });

        // Self-heal any literal dotted top-level keys ("terms.Term X.students" / "terms.Term X.grades")
        const dottedKeys = Object.keys(data).filter(k => k.startsWith('terms.'));
        const deleteFieldArgs = [];
        if (dottedKeys.length > 0) {
          dottedKeys.forEach(dk => {
            const parts = dk.split('.');
            const tName = parts[1];
            const fType = parts[2];
            if (tName && (fType === 'students' || fType === 'grades')) {
              if (!loadedTerms[tName]) loadedTerms[tName] = { grades: {}, students: [] };
              if (fType === 'students' && Array.isArray(data[dk])) {
                loadedTerms[tName].students = data[dk];
              } else if (fType === 'grades' && data[dk] && typeof data[dk] === 'object') {
                loadedTerms[tName].grades = {
                  ...(loadedTerms[tName].grades || {}),
                  ...data[dk]
                };
              }
              deleteFieldArgs.push(new FieldPath(dk), deleteField());
            }
          });
          needsMigrationWrite = true;
        }

        // Only write to Firestore when a real migration or dotted-key recovery is needed
        if (needsMigrationWrite && !isSubTeacherForThisClass) {
          if (deleteFieldArgs.length > 0) {
            updateDoc(docRef, new FieldPath('terms'), loadedTerms, new FieldPath('activeTerm'), loadedActiveTerm, ...deleteFieldArgs).catch(console.error);
          } else {
            setDoc(docRef, { terms: loadedTerms, activeTerm: loadedActiveTerm }, { merge: true }).catch(console.error);
          }
        } else if (deleteFieldArgs.length > 0) {
          updateDoc(docRef, new FieldPath('terms'), loadedTerms, ...deleteFieldArgs).catch(console.error);
        }

        const storedViewTerm = sessionStorage.getItem('targetViewingTerm');
        const viewTerm = (!isSubTeacherForThisClass && storedViewTerm && loadedTerms[storedViewTerm])
          ? storedViewTerm
          : loadedActiveTerm;

        setTermData(loadedTerms);
        setActiveTerm(loadedActiveTerm);
        setViewingTerm(viewTerm);
        sessionStorage.removeItem('targetViewingTerm');

        const activeTermData = loadedTerms[viewTerm] || { grades: {}, students: [] };
        const currentVer = activeTermData.rosterVersion || 0;
        setRosterVersion(currentVer);
        rosterVersionRef.current = currentVer;
        
        const effectiveInst = fetchedInstData || institution;
        const mergedMetadata = {
          ...(data.metadata || {}),
          classLevel: chosenClass?.className || data.metadata?.classLevel || currentProf?.assignedClass || "BS. 7",
          schoolName: effectiveInst?.schoolName || data.metadata?.schoolName || "School Name",
          academicYear: effectiveInst?.academicYear || data.metadata?.academicYear || "2026/2027"
        };
        setMetadata(mergedMetadata);
        setStudents(activeTermData.students || []);
        studentsRef.current = activeTermData.students || [];
        setGrades(activeTermData.grades || {});
        let loadedDropLists = data.dropLists;
        if (!loadedDropLists) {
          loadedDropLists = {
            conduct: ["Respectful", "Attentive", "Polite", "Helpful", "Confident", "Friendly"],
            interest: ["Reading novels", "Sports", "Creative Arts", "Music", "Gardening"],
            attitude: ["Hardworking", "Cooperative", "Obedient", "Punctual", "Sociable"],
            remark: ["Keep it up", "Good performance", "Can do better", "Needs to pay more attention in class", "Highly motivated"]
          };
          if (!isSubTeacherForThisClass) {
            setDoc(docRef, { dropLists: loadedDropLists }, { merge: true }).catch(console.error);
          }
        }
        // Migration: If the user has old compound activities, migrate them automatically
        if (loadedDropLists?.interest?.includes("Reading and research")) {
          loadedDropLists.interest = [
            "Reading novels", "Researching topics", "Sports", "Creative Arts", "Music", "Gardening",
            "Information Technology", "Drawing", "Painting", "Public speaking", "Debating", 
            "Science experiments", "Solving mathematics problems", "Cultural dancing", "Drama",
            "Handiwork", "Crafts", "Helping peers", "Teaching", "Writing", "Storytelling"
          ];
          if (!isSubTeacherForThisClass) {
            setDoc(docRef, { dropLists: loadedDropLists }, { merge: true }).catch(console.error);
          }
        }
        setDropLists(loadedDropLists);
      } else {
        // NEVER auto-create a dummy school document for a Subject Teacher!
        if (isSubTeacherForThisClass) {
          toast.error("The selected class record has not been initialized by its Form Master yet.");
          setIsLoading(false);
          return;
        }
        // Fallback default templates initialized for a Form Master / Class Teacher
        const template = {
          metadata: {
            schoolName: fetchedInstData?.schoolName || "My School Name",
            district: "My District",
            classLevel: currentProf?.assignedClass || "BS. 7",
            term: "1st Term",
            academicYear: fetchedInstData?.academicYear || "2026/2027",
            date: new Date().toISOString().split('T')[0],
            nextTermBegins: "",
            timesOpen: 57
          },
          students: [],
          grades: {},
          terms: {
            "Term 1": {
              grades: {},
              students: [],
              rosterVersion: 0
            },
            "Term 2": {
              grades: {},
              students: [],
              rosterVersion: 0
            },
            "Term 3": {
              grades: {},
              students: [],
              rosterVersion: 0
            }
          },
          activeTerm: activeInstTerm || "Term 1",
          dropLists: {
            conduct: [
              "Respectful and cooperative",
              "Disciplined and focused",
              "Regular and punctual",
              "Shows leadership potential",
              "Needs to improve focus",
              "Well-behaved and attentive",
              "Polite and hardworking",
              "Demonstrates excellent behavior",
              "Quiet but observant",
              "Easily distracted in class",
              "Needs to be more respectful",
              "Playful but intelligent",
              "Participates actively in class",
              "Always eager to help others",
              "Needs constant supervision"
            ],
            interest: [
              "Reading novels",
              "Researching topics",
              "Sports",
              "Creative Arts",
              "Music",
              "Gardening",
              "Information Technology",
              "Drawing",
              "Painting",
              "Public speaking",
              "Debating",
              "Science experiments",
              "Solving mathematics problems",
              "Cultural dancing",
              "Drama",
              "Handiwork",
              "Crafts",
              "Helping peers",
              "Teaching",
              "Writing",
              "Storytelling"
            ],
            remarks: [
              "Excellent performance. Keep it up!",
              "A very good student. Well done.",
              "Good progress made. Work harder.",
              "Fair performance. Needs more effort.",
              "Can do better with regular study.",
              "Outstanding academic performance.",
              "Shows great potential for improvement.",
              "Satisfactory performance, but capable of more.",
              "Needs to pay more attention in class.",
              "Must improve upon current academic standing.",
              "Highly motivated and dedicated learner.",
              "A promising student with a bright future."
            ],
            classes: [
              "BS. 1", "BS. 1A", "BS. 1B",
              "BS. 2", "BS. 2A", "BS. 2B",
              "BS. 3", "BS. 3A", "BS. 3B",
              "BS. 4", "BS. 4A", "BS. 4B",
              "BS. 5", "BS. 5A", "BS. 5B",
              "BS. 6", "BS. 6A", "BS. 6B",
              "BS. 7", "BS. 7A", "BS. 7B",
              "BS. 8", "BS. 8A", "BS. 8B",
              "BS. 9", "BS. 9A", "BS. 9B"
            ]
          }
        };
        await setDoc(docRef, template);
        setMetadata(template.metadata);
        setStudents(template.students);
        studentsRef.current = template.students;
        setGrades(template.grades);
        setDropLists(template.dropLists);
      }
    } catch (e) {
      console.error("Error loading school document:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync data when viewingTerm changes
  useEffect(() => {
    if (Object.keys(termData).length > 0) {
      const activeTermData = termData[viewingTerm] || { grades: {}, students: [] };
      setGrades(activeTermData.grades || {});
      setStudents(activeTermData.students || []);
      studentsRef.current = activeTermData.students || [];
      const ver = activeTermData.rosterVersion || 0;
      setRosterVersion(ver);
      rosterVersionRef.current = ver;
    }
  }, [viewingTerm, termData]);

  // Enforce allowed tabs and lock to current term when in Subject Teacher Mode
  useEffect(() => {
    if (isSubjectTeacherMode) {
      if (viewingTerm !== activeTerm) {
        setViewingTerm(activeTerm);
      }
      if (activeTab !== 'gradebook' && activeTab !== 'reports' && activeTab !== 'trends') {
        setActiveTab('gradebook');
      }
    }
  }, [isSubjectTeacherMode, activeTab, viewingTerm, activeTerm]);

  const handleSaveMetadata = async (newMeta) => {
    if (isSubjectTeacherMode) return;
    setMetadata(newMeta);
    const targetDocId = activeSchoolDocId || currentUser?.uid;
    if (currentUser && targetDocId) {
      try {
        await setDoc(doc(db, "schools", targetDocId), { metadata: newMeta }, { merge: true });
      } catch (e) {
        console.error("Metadata sync error:", e);
      }
    }
  };

  const handleSaveRoster = async (newRoster, snMap = null) => {
    if (isSubjectTeacherMode) {
      throw new Error("Subject teachers cannot modify the class student roster.");
    }
    const targetDocId = activeSchoolDocId || currentUser?.uid;
    if (!currentUser || !targetDocId) return;

    const schoolRef = doc(db, "schools", targetDocId);
    let finalGrades = { ...grades };
    let nextVer = (rosterVersionRef.current || 0) + 1;

    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(schoolRef);
        const sData = snap.exists() ? snap.data() : {};
        const serverTermData = sData.terms?.[activeTerm] || {};
        const serverGrades = serverTermData.grades || grades || {};
        nextVer = (serverTermData.rosterVersion || 0) + 1;

        if (snMap) {
          const remapped = {};
          Object.keys(serverGrades).forEach(subject => {
            remapped[subject] = {};
            Object.keys(serverGrades[subject] || {}).forEach(oldSn => {
              const newSn = snMap[oldSn];
              if (newSn) {
                remapped[subject][newSn] = serverGrades[subject][oldSn];
              }
            });
          });
          finalGrades = remapped;
          tx.update(
            schoolRef,
            new FieldPath('terms', activeTerm, 'students'),
            newRoster,
            new FieldPath('terms', activeTerm, 'grades'),
            finalGrades,
            new FieldPath('terms', activeTerm, 'rosterVersion'),
            nextVer
          );
        } else {
          finalGrades = serverGrades;
          tx.update(
            schoolRef,
            new FieldPath('terms', activeTerm, 'students'),
            newRoster,
            new FieldPath('terms', activeTerm, 'rosterVersion'),
            nextVer
          );
        }
      });

      setStudents(newRoster);
      studentsRef.current = newRoster;
      setGrades(finalGrades);
      setRosterVersion(nextVer);
      rosterVersionRef.current = nextVer;

      setTermData(prev => ({
        ...prev,
        [activeTerm]: {
          ...(prev[activeTerm] || {}),
          students: newRoster,
          grades: finalGrades,
          rosterVersion: nextVer
        }
      }));
    } catch (e) {
      console.error("Roster sync error:", e);
      throw e;
    }
  };

  const handleSaveGrades = async (subjectKey, subjectGrades) => {
    const targetDocId = activeSchoolDocId || currentUser?.uid;
    if (!currentUser || !targetDocId) return;

    // Optimistically update local state for smooth typing/blur
    const updatedGrades = { ...grades, [subjectKey]: subjectGrades };
    setGrades(updatedGrades);

    setTermData(prev => ({
      ...prev,
      [activeTerm]: {
        ...(prev[activeTerm] || {}),
        grades: updatedGrades
      }
    }));

    try {
      const schoolRef = doc(db, "schools", targetDocId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(schoolRef);
        if (!snap.exists()) {
          throw new Error("Class record does not exist.");
        }
        const sData = snap.data();
        const serverTermData = sData.terms?.[activeTerm] || {};
        const serverVer = serverTermData.rosterVersion || 0;
        const serverStudents = serverTermData.students || [];
        const localStudents = studentsRef.current || [];

        // Protect against S/N reshuffling if Form Master edited the roster while Gradebook was open
        const snChanged = serverStudents.length !== localStudents.length ||
          serverStudents.some((st, idx) => st.sn !== localStudents[idx]?.sn || st.name !== localStudents[idx]?.name);

        if ((serverVer !== rosterVersionRef.current && serverVer > 0) || snChanged) {
          const err = new Error("ROSTER_VERSION_MISMATCH");
          err.code = "ROSTER_VERSION_MISMATCH";
          throw err;
        }

        const auditMeta = {
          updatedBy: currentUser.uid,
          updatedByName: userProfile?.name || currentUser.email || "Teacher",
          updatedAt: new Date().toISOString()
        };

        tx.update(
          schoolRef,
          new FieldPath('terms', activeTerm, 'grades', subjectKey),
          subjectGrades,
          new FieldPath('terms', activeTerm, 'gradeMeta', subjectKey),
          auditMeta
        );
      });
    } catch (e) {
      if (e?.code === "ROSTER_VERSION_MISMATCH" || e?.message === "ROSTER_VERSION_MISMATCH") {
        toast.error("The Form Master just updated the class student list! Reloading fresh student list to protect grade accuracy...", { duration: 4000 });
        sessionStorage.setItem('targetViewingClassUid', targetDocId);
        setTimeout(() => window.location.reload(), 1500);
        return;
      }
      console.error("Grades sync error:", e);
      toast.error("Failed to save marks to the server. Please check your connection.");
    }
  };

  const handleSaveStudentReport = async (updatedStudent) => {
    if (isSubjectTeacherMode) return;
    // 1. Update the authoritative ref synchronously so concurrent calls see this change instantly
    const latestRoster = studentsRef.current.map(s => s.sn === updatedStudent.sn ? updatedStudent : s);
    studentsRef.current = latestRoster;
    
    // 2. Update React UI state
    setStudents(latestRoster);
    
    setTermData(prev => ({
      ...prev,
      [activeTerm]: {
        ...(prev[activeTerm] || {}),
        students: latestRoster
      }
    }));

    // 3. Send the authoritative latest roster to Firebase using FieldPath
    const targetDocId = activeSchoolDocId || currentUser?.uid;
    if (currentUser && targetDocId) {
      try {
        await updateDoc(
          doc(db, "schools", targetDocId),
          new FieldPath('terms', activeTerm, 'students'),
          latestRoster
        );
      } catch (e) {
        console.error("Report comments sync error:", e);
      }
    }
  };

  const handleSaveDropLists = async (newDropLists) => {
    if (isSubjectTeacherMode) return;
    setDropLists(newDropLists);
    const targetDocId = activeSchoolDocId || currentUser?.uid;
    if (currentUser && targetDocId) {
      try {
        await setDoc(doc(db, "schools", targetDocId), { dropLists: newDropLists }, { merge: true });
      } catch (e) {
        console.error("Droplists sync error:", e);
      }
    }
  };

  // Theme Toggler
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleExportYearlyData = () => {
    exportYearlyData(termData, metadata, teacherSubjects);
  };

  const handleStartNewYear = async (newAcademicYear) => {
    if (!currentUser) return;
    
    // 1. Take a snapshot of everything
    const snapshot = {
      metadata: metadata,
      termData: termData,
      timestamp: new Date().toISOString(),
      teacherId: currentUser.uid
    };

    try {
      // 2. Save to archives collection
      const archiveId = `${currentUser.uid}_${metadata.academicYear.replace(/[^a-z0-9]/gi, '_')}`;
      await setDoc(doc(db, "archives", archiveId), snapshot);

      // 3. Wipe current state (use updateDoc so top-level `terms` is replaced rather than deep-merged)
      const emptyTerms = {
        "Term 1": { grades: {}, students: [], rosterVersion: 0 },
        "Term 2": { grades: {}, students: [], rosterVersion: 0 },
        "Term 3": { grades: {}, students: [], rosterVersion: 0 }
      };

      const newMeta = { ...metadata, academicYear: newAcademicYear };
      const targetDocId = activeSchoolDocId || currentUser.uid;

      await updateDoc(doc(db, "schools", targetDocId), {
        terms: emptyTerms,
        metadata: newMeta,
        activeTerm: "Term 1"
      });

      // Update React State
      setTermData(emptyTerms);
      setMetadata(newMeta);
      setActiveTerm("Term 1");
      setViewingTerm("Term 1");
      setGrades({});
      setStudents([]);
      studentsRef.current = [];
      setRosterVersion(0);
      rosterVersionRef.current = 0;

      toast.success("Gradebook reset successfully. Previous year archived.");
    } catch (e) {
      console.error("Archive error:", e);
      toast.error("Failed to archive and reset.");
    }
  };



  const handleLogout = async () => {
    if (auth) {
      try {
        await signOut(auth);
      } catch (e) {
        console.error("Logout error:", e);
      }
    }
  };

  // 1. Loading screen
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 bg-zinc-50 dark:bg-[#09090b]">
        <div className="w-8 h-8 rounded-full border-4 border-zinc-200 border-t-emerald-ink animate-spin" />
        <span className="text-sm text-zinc-500 font-semibold uppercase tracking-widest animate-pulse">
          Loading Madifor Technologies SBA Portal...
        </span>
      </div>
    );
  }

  // 2. Authentication Gate: If no user is logged in, show Login Screen
  if (!currentUser) {
    return (
      <>
        <Login onLoginSuccess={(user) => setCurrentUser(user)} />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#18181b',
              color: '#fff',
              fontSize: '14px',
              borderRadius: '12px',
              border: '1px solid #27272a'
            }
          }}
        />
      </>
    );
  }

  // 3. System Routing: If user is Senior Super User, show the System Dashboard
if (userProfile?.isSeniorSuperUser) {
  return (
    <>
      <SeniorSuperUserPanel onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: '#18181b',
            color: '#fff',
            fontSize: '14px',
            borderRadius: '12px',
            border: '1px solid #27272a'
          }
        }}
      />
    </>
  );
}

// 3. Admin Routing: If user is Admin, show the Admin Dashboard
  if (userProfile?.isAdmin) {
    return (
      <>
        <AdminPanel adminUser={currentUser} institution={institution} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
        <Toaster 
          position="top-center" 
          toastOptions={{
            style: {
              background: '#18181b',
              color: '#fff',
              fontSize: '14px',
              borderRadius: '12px',
              border: '1px solid #27272a'
            }
          }} 
        />
      </>
    );
  }

  // 3b. Dedicated Subject Teacher with no classes allocated yet
  if (userProfile?.role === 'subject_teacher' && accessibleClasses.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] flex flex-col items-center justify-center p-6 text-center">
        <div className="glass-card max-w-md w-full p-8 border border-zinc-200 dark:border-zinc-800 space-y-4">
          <img src="/icon.png" className="w-16 h-16 object-contain mx-auto" alt="Madifor logo" />
          <h2 className="text-base font-black text-zinc-900 dark:text-white uppercase tracking-wide">
            Subject Teacher Account Active
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Welcome, <strong>{userProfile?.name || currentUser?.email}</strong>. Your JHS Subject Teacher login is active, but no classes or subjects have been assigned to your account yet.
          </p>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg p-3 font-semibold">
            Please ask your School Administrator to assign your JHS classes and subjects under the &ldquo;Subject Management&rdquo; tab.
          </p>
          <button
            onClick={handleLogout}
            className="w-full bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-white rounded-lg py-2.5 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
        </div>
      </div>
    );
  }

  // 4. Default Database Guard for Teachers (prevents crashes before metadata loads)
  if (!metadata || !dropLists) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 bg-zinc-50 dark:bg-[#09090b]">
        <div className="w-8 h-8 rounded-full border-4 border-zinc-200 border-t-emerald-ink animate-spin" />
        <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
          Initializing Class Project...
        </span>
      </div>
    );
  }

  // Calculate ranks and totals class-wide in real-time
  const computedResults = computeClassResults(students, grades, subjectsList, subjectMap, { formula: institution?.gradingFormula || 'default' });

  const isPrinting = printAll || !!printSingleStudent;
  const isReadOnly = viewingTerm !== activeTerm;
  const visibleTabs = isSubjectTeacherMode
    ? MAIN_TABS.filter(t => t.id === 'gradebook' || t.id === 'reports' || t.id === 'trends')
    : MAIN_TABS;

  return (
    <>
      <div className={`min-h-screen bg-zinc-50 dark:bg-[#09090b] transition-colors duration-300 flex flex-col ${isPrinting ? 'no-print hidden-for-print' : ''}`}>
      
      {/* 1. Header Bar */}
      <header className="glass-panel sticky top-0 z-40 px-3 md:px-6 py-3 md:py-4 flex items-center justify-between no-print shadow-sm gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {institution?.schoolCrestUrl ? (
                <img src={getDirectImageUrl(institution.schoolCrestUrl)} referrerPolicy="no-referrer" className="w-8 h-8 object-contain select-none bg-white rounded shadow-sm p-0.5 shrink-0" alt="School Crest" />
              ) : (
                <img src="/icon.png" className="w-14 h-14 object-contain select-none shrink-0" alt="Madifor logo" />
              )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-md font-black tracking-wider text-zinc-900 dark:text-white truncate">
                SBA Portal
              </h1>
              {isSubjectTeacherMode && (
                <span className="text-[9px] bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800 px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider shrink-0">
                  Subject Teacher
                </span>
              )}
            </div>
            <p className="text-[9px] sm:text-[10px] text-zinc-400 font-bold uppercase leading-tight line-clamp-2 sm:line-clamp-none">
              {metadata.schoolName} — {activeClassEntry?.className || metadata.classLevel}
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* User Profile Info */}
          <div className="hidden sm:flex flex-col text-right mr-2">
            <span className="text-xs font-bold text-zinc-750 dark:text-zinc-300">
              {userProfile?.name || "Teacher"}
            </span>
            <span className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">
              {isSubjectTeacherMode
                ? `${activeClassEntry?.className || metadata.classLevel} (${(activeClassEntry?.allocatedSubjects || []).map(s => s.key).join(', ')})`
                : (userProfile?.assignedClass || metadata.classLevel)}
            </span>
          </div>

          {/* Class Switcher (Shown when teacher has access to multiple classes or is a Subject Teacher) */}
          {(accessibleClasses.length > 1 || userProfile?.role === 'subject_teacher') && (
            <div className="relative group shrink-0">
              <select
                value={activeClassEntry?.classUid || ''}
                onChange={(e) => {
                  sessionStorage.setItem('targetViewingClassUid', e.target.value);
                  sessionStorage.setItem('targetViewingTerm', viewingTerm);
                  window.location.reload();
                }}
                title="Switch Assigned Class"
                className="appearance-none outline-none text-[10px] sm:text-xs font-black tracking-wider pl-2 pr-6 sm:pl-3.5 sm:pr-8 py-1.5 sm:py-2 rounded-lg sm:rounded-xl transition-all cursor-pointer shadow-sm bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/40 dark:to-zinc-900 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 hover:shadow-md"
              >
                {accessibleClasses.map(cls => (
                  <option key={cls.classUid} value={cls.classUid} className="font-semibold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900">
                    {cls.className} {cls.isFormMaster ? '(Form Master)' : `(${(cls.allocatedSubjects || []).length} Subj)`}
                  </option>
                ))}
              </select>
              <div className="absolute right-1.5 sm:right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-700 dark:text-emerald-400">
                <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4" />
              </div>
            </div>
          )}

          {/* Term Display (Subject Teachers locked to current term; Class Teachers can switch terms) */}
          {isSubjectTeacherMode ? (
            <div
              className="shrink-0 text-[10px] sm:text-xs font-black tracking-wider px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl shadow-sm bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 select-none"
              title="Current Active Term"
            >
              {activeTerm}
            </div>
          ) : (
            <div className="relative group shrink-0">
              <select 
                value={viewingTerm}
                onChange={(e) => {
                  if (activeClassEntry?.classUid) {
                    sessionStorage.setItem('targetViewingClassUid', activeClassEntry.classUid);
                  }
                  sessionStorage.setItem('targetViewingTerm', e.target.value);
                  window.location.reload();
                }}
                className={`appearance-none outline-none text-[10px] sm:text-xs font-black tracking-wider pl-2 pr-6 sm:pl-4 sm:pr-10 py-1.5 sm:py-2 rounded-lg sm:rounded-xl transition-all cursor-pointer shadow-sm ${
                  isReadOnly 
                    ? 'bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50 hover:shadow-amber-500/10' 
                    : 'bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:shadow-lg focus:ring-2 focus:ring-emerald-500/20'
                }`}
              >
                {Object.keys(termData).sort().map(term => (
                  <option key={term} value={term} className="font-semibold">{term}</option>
                ))}
              </select>
              <div className={`absolute right-1.5 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-300 group-hover:translate-y-[-40%] ${
                isReadOnly ? 'text-amber-600 dark:text-amber-500' : 'text-zinc-400 dark:text-zinc-500'
              }`}>
                <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4" />
              </div>
              {isReadOnly && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
              )}
            </div>
          )}          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="p-1.5 sm:p-2 shrink-0 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {theme === 'light' ? <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="p-1.5 sm:p-2 shrink-0 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-550 hover:text-rose-500 dark:text-zinc-400 dark:hover:text-rose-455 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Log Out"
          >
            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Floating Assistant Trigger (Hidden in Subject Teacher mode) */}
          {!isSubjectTeacherMode && (
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="bg-emerald-ink hover:bg-emerald-900 shrink-0 text-white rounded-lg p-1.5 sm:p-2 flex items-center gap-1.5 text-xs font-semibold shadow-sm transition-colors"
            >
              <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden md:inline">Ask AI</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. Secondary Tab Switcher */}
      <nav className="bg-white dark:bg-[#0c0c0f] border-b border-zinc-200 dark:border-zinc-800 px-3 md:px-6 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar select-none no-print">
        {visibleTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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

      {/* 3. Main Scrollable Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-6 transition-all duration-300">
        {!isSubjectTeacherMode && activeTab === 'dashboard' && (
          <Dashboard
            metadata={metadata}
            students={students}
            computedResults={computedResults}
            onSave={handleSaveMetadata}
            onStartNewYear={handleStartNewYear}
            onExportYearlyData={handleExportYearlyData}
            teacherSubjects={teacherSubjects}
            isReadOnly={isReadOnly}
            viewingTerm={viewingTerm}
          />
        )}
        {!isSubjectTeacherMode && activeTab === 'roster' && (
          <Roster
            students={students}
            metadata={metadata}
            onSave={handleSaveRoster}
            onImport={(newStudents, snMap) => {
              handleSaveRoster(newStudents, snMap);
            }}
            isReadOnly={isReadOnly}
          />
        )}
        {activeTab === 'gradebook' && (
          <Gradebook
            students={students}
            gradesStore={grades}
            onSave={handleSaveGrades}
            teacherSubjects={gradebookSubjects}
            apiKey={apiKey}
            isReadOnly={isReadOnly}
          />
        )}
        {!isSubjectTeacherMode && activeTab === 'positions' && (
          <ConsolidatedView
            computedResults={computedResults}
            teacherSubjects={teacherSubjects}
            onPrintAnalytics={handlePrintAnalytics}
            metadata={metadata}
          />
        )}
        {activeTab === 'trends' && (
          <TrendAnalysis
            termData={termData}
            students={students}
            metadata={metadata}
            teacherSubjects={isSubjectTeacherMode ? gradebookSubjects : teacherSubjects}
            allocatedSubjects={gradebookSubjects}
            isSubjectTeacherMode={isSubjectTeacherMode}
          />
        )}
        {!isSubjectTeacherMode && activeTab === 'open' && (
          <ConsolidatedRecords
            students={students}
            gradesStore={grades}
            teacherSubjects={teacherSubjects}
            viewingTerm={viewingTerm}
          />
        )}
        {activeTab === 'reports' && (
          <ReportEditor
            students={students}
            metadata={metadata}
            computedResults={computedResults}
            dropLists={dropLists}
            onSave={handleSaveStudentReport}
            onPrintAll={handlePrintAll}
            onPrintSingle={handlePrintSingle}
            teacherSubjects={teacherSubjects}
            viewingTerm={viewingTerm}
            isReadOnly={isReadOnly || isSubjectTeacherMode}
            isSubjectTeacherView={isSubjectTeacherMode}
            institution={institution}
            termData={termData}
          />
        )}
        {!isSubjectTeacherMode && activeTab === 'droplists' && (
          <DropLists
            dropLists={dropLists}
            onSave={handleSaveDropLists}
          />
        )}
      </main>

      <footer className="w-full text-center py-4 text-[10px] text-zinc-500 font-medium no-print">
        SBA portal by Madifor Technologies (0592664865)
      </footer>
      {/* 4. Floating Chat Panel */}
      {!isSubjectTeacherMode && (
        <ChatPanel
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          apiKey={apiKey}
          contextData={{
            metadata: {
              ...metadata,
              schoolName: institution?.name || metadata?.schoolName || 'Unknown School'
            },
            students: students,
            grades: grades
          }}
        />
      )}



      </div>

      {/* Root-Level Print Layout (bypasses all outer margin/padding spacing) */}
      {isPrinting && (
        <div className="print-all-container">
          {printAll ? (
            students.map(student => (
              <ReportCard
                key={student.sn}
                student={student}
                metadata={metadata}
                calculatedScores={computedResults}
                teacherSubjects={teacherSubjects}
                currentUser={currentUser}
                institution={institution}
                viewingTerm={viewingTerm}
              />
            ))
          ) : (
            <ReportCard
              student={printSingleStudent}
              metadata={metadata}
              calculatedScores={computedResults}
              teacherSubjects={teacherSubjects}
              currentUser={currentUser}
              institution={institution}
              viewingTerm={viewingTerm}
            />
          )}
        </div>
      )}
      <Toaster 
        position="top-center" 
        toastOptions={{
          style: {
            background: '#18181b',
            color: '#fff',
            fontSize: '14px',
            borderRadius: '12px',
            border: '1px solid #27272a'
          }
        }} 
      />
    </>
  );
}
