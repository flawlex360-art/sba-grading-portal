import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db, isConfigValid, getFirebaseConfig } from '../utils/firebase';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { LogIn, Key, Mail, Lock, ShieldAlert, AlertCircle, HelpCircle, Save, Settings, Eye, EyeOff, X } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [systemExists, setSystemExists] = useState(false);
  
  // Password Reset State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    const checkSystemExists = async () => {
      try {
        const q = query(collection(db, "teachers"), where("isSeniorSuperUser", "==", true));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setSystemExists(true);
        }
      } catch (e) {
        console.error("Error checking admin status:", e);
      }
    };
    checkSystemExists();
  }, []);

  const config = getFirebaseConfig();
  const configValid = isConfigValid(config);

  const handleRegisterSystem = async () => {
    setLoading(true);
    setError('');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, 'system@flawlex.com', password);
      const teacherDocRef = doc(db, "teachers", userCredential.user.uid);
      await setDoc(teacherDocRef, {
        name: "Senior Super User",
        email: "system@flawlex.com",
        assignedClass: "System",
        createdDate: new Date().toISOString(),
        isSeniorSuperUser: true
      });
      onLoginSuccess(userCredential.user);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to register System account.");
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
      if (email.trim().toLowerCase() === 'system@flawlex.com') {
        if (systemExists) {
          setError("Incorrect password for System account.");
        } else {
          setError(
            <div className="flex flex-col gap-2">
              <span>System account not registered yet.</span>
              <span className="text-[10px] text-zinc-500 font-semibold">Click below to register this email/password as the single Senior Super User login for this database:</span>
              <button
                type="button"
                onClick={handleRegisterSystem}
                className="bg-emerald-ink hover:bg-emerald-900 text-white rounded px-2.5 py-1 mt-1 text-[10px] font-bold self-start transition-colors"
              >
                Register System Account
              </button>
            </div>
          );
        }
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

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (!configValid) {
      setResetError("Firebase is not configured yet.");
      return;
    }
    setResetLoading(true);
    setResetError('');
    setResetMessage('');
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetMessage("Password reset email sent! Please check your inbox.");
      setResetEmail('');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/user-not-found') {
        setResetError("No account found with this email.");
      } else if (err.code === 'auth/invalid-email') {
        setResetError("Invalid email address.");
      } else {
        setResetError("Failed to send reset email. Please try again.");
      }
    } finally {
      setResetLoading(false);
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
          <img src="/icon.png" className="w-32 h-32 object-contain mb-3 select-none" alt="Madifor logo" />
          <h1 className="text-xl font-bold tracking-tight text-white">Madifor Technologies SBA Portal</h1>
          <p className="text-xs text-zinc-400 mt-1 text-center">
            Sign in to access your classroom spreadsheets and report cards
          </p>
        </div>

        {error && (
          <div className="bg-zinc-900 border border-zinc-800 text-white rounded-lg p-3.5 text-xs flex gap-2.5 mb-6 animate-pulse shadow-md">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
            <p className="leading-relaxed font-medium">{error}</p>
          </div>
        )}

        {/* Email / Password Sign In Form */}
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
                  className="w-full bg-[#121214] border border-zinc-800/80 rounded-lg pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink focus:border-emerald-ink font-medium"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(true)}
                  className="text-[10px] font-semibold text-emerald-ink hover:text-emerald-400 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative flex items-center">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#121214] border border-zinc-800/80 rounded-lg pl-10 pr-10 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink focus:border-emerald-ink font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-zinc-500 hover:text-zinc-350 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-ink hover:bg-emerald-900 disabled:opacity-50 text-white rounded-lg py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-lg mt-6"
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

        <div className="mt-8 pt-4 border-t border-zinc-800/60 text-center flex flex-col gap-2">
          <p className="text-[10px] text-zinc-500 font-medium">SBA portal by Madifor Technologies (0592664865)</p>
        </div>

      </div>

      {/* Forgot Password Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#121214] border border-zinc-800 w-full max-w-sm rounded-xl p-6 shadow-2xl relative">
            <button 
              onClick={() => {
                setIsResetModalOpen(false);
                setResetError('');
                setResetMessage('');
                setResetEmail('');
              }}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-bold text-white mb-2">Reset Password</h2>
            <p className="text-xs text-zinc-400 mb-4">
              Enter your email address and we will send you a link to reset your password.
            </p>

            {resetError && (
              <div className="bg-rose-950/30 border border-rose-900 text-rose-400 rounded-lg p-3 text-xs mb-4">
                {resetError}
              </div>
            )}
            
            {resetMessage && (
              <div className="bg-emerald-950/30 border border-emerald-900 text-emerald-400 rounded-lg p-3 text-xs mb-4">
                {resetMessage}
              </div>
            )}

            <form onSubmit={handlePasswordReset}>
              <div className="mb-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full bg-[#09090b] border border-zinc-800/80 rounded-lg pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-ink focus:border-emerald-ink"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full bg-emerald-ink hover:bg-emerald-900 disabled:opacity-50 text-white rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-lg"
              >
                {resetLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
