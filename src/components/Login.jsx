import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db, isConfigValid, getFirebaseConfig } from '../utils/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { LogIn, Key, Mail, Lock, ShieldAlert, AlertCircle, HelpCircle, Save, Settings } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const config = getFirebaseConfig();
  const configValid = isConfigValid(config);
  const [showSetup, setShowSetup] = useState(!configValid);

  // Custom Firebase configuration states
  const [fbConfig, setFbConfig] = useState({
    apiKey: config.apiKey || '',
    authDomain: config.authDomain || '',
    projectId: config.projectId || '',
    storageBucket: config.storageBucket || '',
    messagingSenderId: config.messagingSenderId || '',
    appId: config.appId || ''
  });

  const handleFbChange = (e) => {
    const { name, value } = e.target;
    setFbConfig(prev => ({
      ...prev,
      [name]: value.trim()
    }));
  };

  const handleConfigSubmit = (e) => {
    e.preventDefault();
    localStorage.setItem('firebase_config', JSON.stringify(fbConfig));
    alert("Firebase config saved successfully! Reinitializing portal...");
    window.location.reload();
  };

  const handleRegisterAdmin = async () => {
    setLoading(true);
    setError('');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, 'admin@school.com', password);
      const teacherDocRef = doc(db, "teachers", userCredential.user.uid);
      await setDoc(teacherDocRef, {
        name: "School Admin",
        email: "admin@school.com",
        assignedClass: "Admin",
        createdDate: new Date().toISOString(),
        isAdmin: true
      });
      onLoginSuccess(userCredential.user);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to register Admin account.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!configValid) {
      setError("Firebase is not configured yet.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      onLoginSuccess(userCredential.user);
    } catch (err) {
      console.error(err);
      let errMsg = "Invalid email or password. Please try again.";
      if (email.trim().toLowerCase() === 'admin@school.com') {
        setError(
          <div className="flex flex-col gap-2">
            <span>No Admin account found. Would you like to register this password as your Administrator login?</span>
            <button
              type="button"
              onClick={handleRegisterAdmin}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded px-2.5 py-1 mt-1 text-[10px] font-bold self-start transition-colors"
            >
              Register Admin Account
            </button>
          </div>
        );
        setLoading(false);
        return;
      }
      if (err.code === 'auth/invalid-credential') {
        errMsg = "Incorrect email address or password.";
      } else if (err.code === 'auth/user-not-found') {
        errMsg = "No teacher account exists with this email address.";
      } else if (err.code === 'auth/wrong-password') {
        errMsg = "Incorrect password.";
      } else if (err.code === 'auth/network-request-failed') {
        errMsg = "Network error. Please check your internet connection.";
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] bg-gradient-to-br from-indigo-950/40 via-zinc-950 to-emerald-950/30 p-4 font-sans select-none">
      
      {/* Login Card Container */}
      <div className="w-full max-w-md glass-card border border-zinc-800/80 p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center mb-8 relative">
          <div className="w-12 h-12 bg-indigo-600/10 border border-indigo-500/30 rounded-xl flex items-center justify-center mb-3 text-indigo-400 shadow-inner">
            {showSetup ? <Settings className="w-6 h-6 animate-spin-slow" /> : <LogIn className="w-6 h-6" />}
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">SBA Grading Portal</h1>
          <p className="text-xs text-zinc-400 mt-1 text-center">
            {showSetup 
              ? "Link your grading portal to your Firebase cloud project" 
              : "Sign in to access your classroom spreadsheets and report cards"}
          </p>
        </div>

        {error && (
          <div className="bg-rose-950/20 border border-rose-800/40 text-rose-300 rounded-lg p-3.5 text-xs flex gap-2.5 mb-6 animate-pulse">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {showSetup ? (
          /* Firebase Settings Form */
          <form onSubmit={handleConfigSubmit} className="space-y-4 text-xs font-semibold text-zinc-300">
            <div className="bg-amber-950/20 border border-amber-800/40 text-amber-300 rounded-lg p-3 text-[11px] leading-relaxed mb-2">
              Please paste your Firebase Web App configuration credentials below.
            </div>

            <div>
              <label className="block text-[10px] text-zinc-400 uppercase tracking-wider mb-1">Firebase API Key</label>
              <input
                type="text"
                required
                name="apiKey"
                value={fbConfig.apiKey}
                onChange={handleFbChange}
                placeholder="AIzaSy..."
                className="w-full bg-[#121214] border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-[11px]"
              />
            </div>

            <div>
              <label className="block text-[10px] text-zinc-400 uppercase tracking-wider mb-1">Project ID</label>
              <input
                type="text"
                required
                name="projectId"
                value={fbConfig.projectId}
                onChange={handleFbChange}
                placeholder="my-grading-app-123"
                className="w-full bg-[#121214] border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-[11px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-zinc-400 uppercase tracking-wider mb-1">Auth Domain</label>
                <input
                  type="text"
                  name="authDomain"
                  value={fbConfig.authDomain}
                  onChange={handleFbChange}
                  placeholder="my-app.firebaseapp.com"
                  className="w-full bg-[#121214] border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-[10px]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 uppercase tracking-wider mb-1">Storage Bucket</label>
                <input
                  type="text"
                  name="storageBucket"
                  value={fbConfig.storageBucket}
                  onChange={handleFbChange}
                  placeholder="my-app.appspot.com"
                  className="w-full bg-[#121214] border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-[10px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-zinc-400 uppercase tracking-wider mb-1">App ID</label>
              <input
                type="text"
                required
                name="appId"
                value={fbConfig.appId}
                onChange={handleFbChange}
                placeholder="1:102938:web:abcdef..."
                className="w-full bg-[#121214] border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-[11px]"
              />
            </div>

            <div className="flex gap-2 pt-4">
              {configValid && (
                <button
                  type="button"
                  onClick={() => setShowSetup(false)}
                  className="flex-1 bg-transparent hover:bg-zinc-800 border border-zinc-800 text-zinc-400 rounded-lg py-2 text-xs font-semibold transition-colors"
                >
                  Back to Login
                </button>
              )}
              <button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow"
              >
                <Save className="w-3.5 h-3.5" />
                Save & Initialize
              </button>
            </div>
          </form>
        ) : (
          /* Email / Password Sign In Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@school.com"
                  className="w-full bg-[#121214] border border-zinc-800/80 rounded-lg pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#121214] border border-zinc-800/80 rounded-lg pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-lg mt-6"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <>
                  <Key className="w-3.5 h-3.5" />
                  Sign In
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-8 pt-4 border-t border-zinc-800/60 text-center flex flex-col gap-2">
          {!showSetup && (
            <button
              type="button"
              onClick={() => setShowSetup(true)}
              className="text-[10px] text-zinc-500 hover:text-indigo-400 transition-colors font-semibold"
            >
              Configure Firebase Project Settings
            </button>
          )}

        </div>

      </div>
    </div>
  );
}
