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
import { computeClassResults } from './utils/calculations';
import { auth, db, getFirebaseConfig, isConfigValid } from './utils/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { Toaster } from 'react-hot-toast';

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

  // Database States
  const [metadata, setMetadata] = useState(null);
  const [students, setStudents] = useState([]);
  const studentsRef = useRef([]);
  const [grades, setGrades] = useState({});
  const [dropLists, setDropLists] = useState(null);

  // Get active subjects based on teacher profile
  const getTeacherSubjects = () => {
    if (userProfile && Array.isArray(userProfile.subjects) && userProfile.subjects.length > 0) {
      const map = {};
      userProfile.subjects.forEach(sub => {
        map[sub.name] = sub.key;
      });
      return {
        subjectMap: map,
        subjectsList: userProfile.subjects.map(s => s.name),
        teacherSubjects: userProfile.subjects
      };
    }
    
    const fallbackMap = (userProfile?.level === 'Primary') 
      ? DEFAULT_PRIMARY_SUBJECT_MAP 
      : DEFAULT_JHS_SUBJECT_MAP;
      
    const teacherSubjects = Object.entries(fallbackMap).map(([name, key]) => ({ name, key }));

    return {
      subjectMap: fallbackMap,
      subjectsList: Object.keys(fallbackMap),
      teacherSubjects
    };
  };

  const { subjectMap, subjectsList, teacherSubjects } = getTeacherSubjects();
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
  useEffect(() => {
    if (!auth) {
      // Offline fallback or Firebase config missing
      setIsLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        if (user.email === 'admin@school.com') {
          setUserProfile({ isAdmin: true, name: "Admin" });
          setIsLoading(false);
        } else {
          try {
            const docRef = doc(db, "teachers", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              setUserProfile(docSnap.data());
            } else {
              setUserProfile({ name: "Teacher", assignedClass: "BS. 7" });
            }
          } catch (e) {
            console.error("Error loading profile:", e);
          }
          await fetchTeacherData(user.uid);
        }
      } else {
        setUserProfile(null);
        setMetadata(null);
        setStudents([]);
        studentsRef.current = [];
        setGrades({});
        setDropLists(null);
        setIsLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const fetchTeacherData = async (uid, instId) => {
    setIsLoading(true);
    try {
      let activeInstTerm = null;
      let instCrestUrl = null;

      if (instId && instId !== 'unknown') {
        const instRef = doc(db, "institutions", instId);
        const instSnap = await getDoc(instRef);
        if (instSnap.exists()) {
           const instData = instSnap.data();
           setInstitution({ id: instSnap.id, ...instData });
           activeInstTerm = instData.activeTerm;
           instCrestUrl = instData.schoolCrestUrl;
        }
      }

      const docRef = doc(db, "schools", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        let loadedTerms = data.terms;
        let loadedActiveTerm = activeInstTerm || data.activeTerm || "Term 1";

        // Auto-migrate legacy structure
        if (!loadedTerms) {
          loadedTerms = {
            "Term 1": {
              grades: data.grades || {},
              students: data.students || []
            }
          };
        }
        
        // Ensure all 3 terms exist
        ['Term 1', 'Term 2', 'Term 3'].forEach(t => {
           if (!loadedTerms[t]) loadedTerms[t] = { grades: {}, students: [] };
        });

        // Fire-and-forget migration save to keep it in sync
        setDoc(doc(db, "schools", uid), { terms: loadedTerms, activeTerm: loadedActiveTerm }, { merge: true }).catch(console.error);

        const currentViewTerm = loadedActiveTerm;
        setTermData(loadedTerms);
        setActiveTerm(currentViewTerm);
        setViewingTerm(currentViewTerm);

        const activeTermData = loadedTerms[currentViewTerm] || { grades: {}, students: [] };
        
        setMetadata(data.metadata);
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
            setDoc(doc(db, "schools", uid), { dropLists: loadedDropLists }, { merge: true }).catch(console.error);
          }
        // Migration: If the user has old compound activities, migrate them automatically
        if (loadedDropLists?.interest?.includes("Reading and research")) {
            loadedDropLists.interest = [
              "Reading novels", "Researching topics", "Sports", "Creative Arts", "Music", "Gardening",
              "Information Technology", "Drawing", "Painting", "Public speaking", "Debating", 
              "Science experiments", "Solving mathematics problems", "Cultural dancing", "Drama",
              "Handiwork", "Crafts", "Helping peers", "Teaching", "Writing", "Storytelling"
            ];
            // Fire-and-forget save the migrated droplists to Firestore
            setDoc(doc(db, "schools", uid), { dropLists: loadedDropLists }, { merge: true }).catch(console.error);
        }
        setDropLists(loadedDropLists);
      } else {
        // Fallback default templates initialized for this teacher
        const template = {
          metadata: {
            schoolName: "My School Name",
            district: "My District",
            classLevel: "BS. 7",
            term: "1st Term",
            academicYear: "2025/2026",
            date: new Date().toISOString().split('T')[0],
            nextTermBegins: "",
            timesOpen: 57
          },
          students: [],
          grades: {},
          terms: {
            "Term 1": {
              grades: {},
              students: []
            }
          },
          activeTerm: "Term 1",
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
            classes: ["BS. 1", "BS. 2", "BS. 3", "BS. 4", "BS. 5", "BS. 6", "BS. 7", "BS. 8", "BS. 9"]
          }
        };
        await setDoc(docRef, template);
        setMetadata(template.metadata);
        setStudents(template.students);
        studentsRef.current = template.students;
        setGrades(template.grades);
        setDropLists(template.dropLists);
        // End of fetchTeacherData
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
    }
  }, [viewingTerm, termData]);

  const handleSaveMetadata = async (newMeta) => {
    setMetadata(newMeta);
    if (currentUser) {
      try {
        await setDoc(doc(db, "schools", currentUser.uid), { metadata: newMeta }, { merge: true });
      } catch (e) {
        console.error("Metadata sync error:", e);
      }
    }
  };

  const handleSaveRoster = async (newRoster, snMap = null) => {
    setStudents(newRoster);
    studentsRef.current = newRoster;

    let updatedGrades = { ...grades };
    let gradesChanged = false;

    if (snMap) {
      const newGrades = {};
      Object.keys(updatedGrades).forEach(subject => {
        newGrades[subject] = {};
        Object.keys(updatedGrades[subject]).forEach(oldSn => {
          const newSn = snMap[oldSn];
          if (newSn) {
            newGrades[subject][newSn] = updatedGrades[subject][oldSn];
          }
        });
      });
      updatedGrades = newGrades;
      gradesChanged = true;
      setGrades(updatedGrades);
    }

    setTermData(prev => ({
      ...prev,
      [activeTerm]: {
        ...(prev[activeTerm] || {}),
        students: newRoster,
        ...(gradesChanged ? { grades: updatedGrades } : {})
      }
    }));

    if (currentUser) {
      try {
        const payload = {
          [`terms.${activeTerm}.students`]: newRoster
        };
        if (gradesChanged) {
          payload[`terms.${activeTerm}.grades`] = updatedGrades;
        }
        await setDoc(doc(db, "schools", currentUser.uid), payload, { merge: true });
      } catch (e) {
        console.error("Roster sync error:", e);
      }
    }
  };

  const handleSaveGrades = async (subjectKey, subjectGrades) => {
    const updatedGrades = { ...grades, [subjectKey]: subjectGrades };
    setGrades(updatedGrades);

    setTermData(prev => ({
      ...prev,
      [activeTerm]: {
        ...(prev[activeTerm] || {}),
        grades: updatedGrades
      }
    }));

    if (currentUser) {
      try {
        await setDoc(doc(db, "schools", currentUser.uid), { 
          [`terms.${activeTerm}.grades`]: updatedGrades 
        }, { merge: true });
      } catch (e) {
        console.error("Grades sync error:", e);
      }
    }
  };

  const handleSaveStudentReport = async (updatedStudent) => {
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

    // 3. Send the authoritative latest roster to Firebase
    if (currentUser) {
      try {
        await setDoc(doc(db, "schools", currentUser.uid), { 
          [`terms.${activeTerm}.students`]: latestRoster 
        }, { merge: true });
      } catch (e) {
        console.error("Report comments sync error:", e);
      }
    }
  };

  const handleSaveDropLists = async (newDropLists) => {
    setDropLists(newDropLists);
    if (currentUser) {
      try {
        await setDoc(doc(db, "schools", currentUser.uid), { dropLists: newDropLists }, { merge: true });
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

      // 3. Wipe current state
      const emptyTerms = {
        "Term 1": { grades: {}, students: [] },
        "Term 2": { grades: {}, students: [] },
        "Term 3": { grades: {}, students: [] }
      };

      const newMeta = { ...metadata, academicYear: newAcademicYear };

      await setDoc(doc(db, "schools", currentUser.uid), {
        terms: emptyTerms,
        metadata: newMeta,
        activeTerm: "Term 1"
      }, { merge: true });

      // Update React State
      setTermData(emptyTerms);
      setMetadata(newMeta);
      setActiveTerm("Term 1");
      setViewingTerm("Term 1");
      setGrades({});
      setStudents([]);
      studentsRef.current = [];

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
          Loading Flawlex Technologies SBA Portal...
        </span>
      </div>
    );
  }

  // 2. Authentication Gate: If no user is logged in, show Login Screen
  if (!currentUser) {
    return <Login onLoginSuccess={(user) => setCurrentUser(user)} />;
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
        <AdminPanel adminUser={currentUser} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
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

  return (
    <>
      <div className={`min-h-screen bg-zinc-50 dark:bg-[#09090b] transition-colors duration-300 flex flex-col ${isPrinting ? 'no-print hidden-for-print' : ''}`}>
      
      {/* 1. Header Bar */}
      <header className="glass-panel sticky top-0 z-40 px-6 py-4 flex items-center justify-between no-print shadow-sm">
        <div className="flex items-center gap-2.5">
          {institution?.schoolCrestUrl ? (
                <img src={institution.schoolCrestUrl} className="w-8 h-8 object-contain select-none bg-white rounded shadow-sm p-0.5" alt="School Crest" />
              ) : (
                <img src="/icon.png" className="w-7 h-7 object-contain select-none" alt="Flawlex logo" />
              )}
          <div>
            <h1 className="text-md font-black tracking-wider text-zinc-900 dark:text-white">
              SBA Portal
            </h1>
            <p className="text-[10px] text-zinc-400 font-bold uppercase">
              {metadata.schoolName} — {metadata.classLevel}
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2">
          {/* User Profile Info */}
          <div className="hidden sm:flex flex-col text-right mr-2">
            <span className="text-xs font-bold text-zinc-750 dark:text-zinc-300">
              {userProfile?.name || "Teacher"}
            </span>
            <span className="text-[9px] text-zinc-400 uppercase font-bold tracking-wider">
              {userProfile?.assignedClass || metadata.classLevel}
            </span>
          </div>

          {/* Term Switcher */}
          <div className="relative group">
            <select 
              value={viewingTerm}
              onChange={(e) => setViewingTerm(e.target.value)}
              className={`appearance-none outline-none text-xs font-black tracking-wider pl-4 pr-10 py-2 rounded-xl transition-all cursor-pointer shadow-sm ${
                isReadOnly 
                  ? 'bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50 hover:shadow-amber-500/10' 
                  : 'bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-950 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:shadow-lg focus:ring-2 focus:ring-emerald-500/20'
              }`}
            >
              {Object.keys(termData).sort().map(term => (
                <option key={term} value={term} className="font-semibold">{term}</option>
              ))}
            </select>
            <div className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-300 group-hover:translate-y-[-40%] ${
              isReadOnly ? 'text-amber-600 dark:text-amber-500' : 'text-zinc-400 dark:text-zinc-500'
            }`}>
              <ChevronDown className="w-4 h-4" />
            </div>
            {isReadOnly && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
            )}
          </div>          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-550 hover:text-rose-500 dark:text-zinc-400 dark:hover:text-rose-455 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>

          {/* Floating Assistant Trigger */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="bg-emerald-ink hover:bg-emerald-900 text-white rounded-lg p-2 flex items-center gap-1.5 text-xs font-semibold shadow-sm transition-colors"
          >
            <Bot className="w-4 h-4" />
            <span className="hidden md:inline">Ask AI</span>
          </button>
        </div>
      </header>

      {/* 2. Secondary Tab Switcher */}
      <nav className="bg-white dark:bg-[#0c0c0f] border-b border-zinc-200 dark:border-zinc-800 px-3 md:px-6 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar select-none no-print">
        {MAIN_TABS.map(tab => {
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
        {activeTab === 'dashboard' && (
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
        {activeTab === 'roster' && (
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
            teacherSubjects={teacherSubjects}
            apiKey={apiKey}
            isReadOnly={isReadOnly}
          />
        )}
        {activeTab === 'positions' && (
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
            teacherSubjects={teacherSubjects}
          />
        )}
        {activeTab === 'open' && (
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
            isReadOnly={isReadOnly}
          />
        )}
        {activeTab === 'droplists' && (
          <DropLists
            dropLists={dropLists}
            onSave={handleSaveDropLists}
          />
        )}
      </main>

      <footer className="w-full text-center py-4 text-[10px] text-zinc-500 font-medium no-print">
        SBA portal by Flawlex Technologiess (0592664865)
      </footer>
      {/* 4. Floating Chat Panel */}
      <ChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        apiKey={apiKey}
      />



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
              />
            ))
          ) : (
            <ReportCard
              student={printSingleStudent}
              metadata={metadata}
              calculatedScores={computedResults}
              teacherSubjects={teacherSubjects}
              currentUser={currentUser}
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
