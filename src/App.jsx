import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, FileSpreadsheet, Award, FileCode, Settings, Sun, Moon, Bot, Key, LogOut, Shield } from 'lucide-react';
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
import { computeClassResults } from './utils/calculations';
import { auth, db, getFirebaseConfig, isConfigValid } from './utils/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';

const MAIN_TABS = [
  { id: 'dashboard', name: 'Home', icon: LayoutDashboard },
  { id: 'roster', name: 'Roster', icon: Users },
  { id: 'gradebook', name: 'Gradebook', icon: FileSpreadsheet },
  { id: 'positions', name: 'Class Overview', icon: Award },
  { id: 'open', name: 'Records (OPEN)', icon: FileCode },
  { id: 'reports', name: 'Report Cards', icon: FileCode },
  { id: 'droplists', name: 'Drop Lists', icon: Settings }
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

  // Database States
  const [metadata, setMetadata] = useState(null);
  const [students, setStudents] = useState([]);
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

  // Printing states (Root level to bypass parent spacing layout issues)
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
    }, 250);
  };

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
        setGrades({});
        setDropLists(null);
        setIsLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const fetchTeacherData = async (uid) => {
    setIsLoading(true);
    try {
      const docRef = doc(db, "schools", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMetadata(data.metadata);
        setStudents(data.students || []);
        setGrades(data.grades || {});
        setDropLists(data.dropLists);
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
        await setDoc(docRef, template);
        setMetadata(template.metadata);
        setStudents(template.students);
        setGrades(template.grades);
        setDropLists(template.dropLists);
      }
    } catch (e) {
      console.error("Error loading school document:", e);
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleSaveRoster = async (newRoster) => {
    setStudents(newRoster);
    if (currentUser) {
      try {
        await setDoc(doc(db, "schools", currentUser.uid), { students: newRoster }, { merge: true });
      } catch (e) {
        console.error("Roster sync error:", e);
      }
    }
  };

  const handleSaveGrades = async (subjectKey, subjectGrades) => {
    const updatedGrades = { ...grades, [subjectKey]: subjectGrades };
    setGrades(updatedGrades);
    if (currentUser) {
      try {
        await setDoc(doc(db, "schools", currentUser.uid), { grades: updatedGrades }, { merge: true });
      } catch (e) {
        console.error("Grades sync error:", e);
      }
    }
  };

  const handleSaveStudentReport = async (updatedStudent) => {
    const updatedRoster = students.map(s => s.sn === updatedStudent.sn ? updatedStudent : s);
    setStudents(updatedRoster);
    if (currentUser) {
      try {
        await setDoc(doc(db, "schools", currentUser.uid), { students: updatedRoster }, { merge: true });
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

  // 3. Admin Routing: If user is Admin, show the Admin Dashboard
  if (userProfile?.isAdmin) {
    return <AdminPanel adminUser={currentUser} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />;
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
  const computedResults = computeClassResults(students, grades, subjectsList, subjectMap);

  const isPrinting = printAll || !!printSingleStudent;

  return (
    <>
      <div className={`min-h-screen bg-zinc-50 dark:bg-[#09090b] transition-colors duration-300 flex flex-col ${isPrinting ? 'no-print hidden-for-print' : ''}`}>
      
      {/* 1. Header Bar */}
      <header className="glass-panel sticky top-0 z-40 px-6 py-4 flex items-center justify-between no-print shadow-sm">
        <div className="flex items-center gap-2.5">
          <img src="/icon.png" className="w-7 h-7 object-contain select-none" alt="Flawlex logo" />
          <div>
            <h1 className="text-md font-black tracking-wider text-zinc-900 dark:text-white">
              Flawlex Technologies SBA Portal
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



          {/* Theme Switcher */}
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
      <nav className="bg-white dark:bg-[#0c0c0f] border-b border-zinc-200 dark:border-zinc-800 px-6 py-2 flex items-center gap-1 overflow-x-auto select-none no-print">
        {MAIN_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 md:px-4 md:py-2 text-sm md:text-xs font-bold rounded-lg border transition-all truncate ${
                isActive
                  ? 'border-emerald-ink/20 bg-champagne/40 dark:bg-emerald-900/10 text-emerald-ink dark:text-emerald-400 font-extrabold shadow-sm'
                  : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <Icon className="w-5 h-5 md:w-4 md:h-4 flex-shrink-0" />
              {tab.name}
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
            teacherSubjects={teacherSubjects}
          />
        )}
        {activeTab === 'roster' && (
          <Roster
            students={students}
            onSave={handleSaveRoster}
            onImport={(newStudents) => setStudents(newStudents)}
          />
        )}
        {activeTab === 'gradebook' && (
          <Gradebook
            students={students}
            gradesStore={grades}
            onSave={handleSaveGrades}
            teacherSubjects={teacherSubjects}
            apiKey={apiKey}
          />
        )}
        {activeTab === 'positions' && (
          <ConsolidatedView
            computedResults={computedResults}
            teacherSubjects={teacherSubjects}
          />
        )}
        {activeTab === 'open' && (
          <ConsolidatedRecords
            students={students}
            gradesStore={grades}
            teacherSubjects={teacherSubjects}
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
              />
            ))
          ) : (
            <ReportCard
              student={printSingleStudent}
              metadata={metadata}
              calculatedScores={computedResults}
              teacherSubjects={teacherSubjects}
            />
          )}
        </div>
      )}
    </>
  );
}
