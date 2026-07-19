import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db, isConfigValid, getFirebaseConfig } from '../utils/firebase';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { LogIn, Key, Mail, Lock, ShieldAlert, AlertCircle, HelpCircle, Save, Settings, Eye, EyeOff } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [adminExists, setAdminExists] = useState(false);

  useEffect(() => {
    const checkAdminExists = async () => {
      try {
        const q = query(collection(db, "teachers"), where("isAdmin", "==", true));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setAdminExists(true);
        }
      } catch (e) {
        console.error("Error checking admin status:", e);
      }
    };
    checkAdminExists();
  }, []);

  const config = getFirebaseConfig();
  const configValid = isConfigValid(config);

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
        if (adminExists) {
          setError("Incorrect password for Administrator account.");
        } else {
          setError(
            <div className="flex flex-col gap-2">
              <span>Admin account not registered yet.</span>
              <span className="text-[10px] text-zinc-500 font-semibold">Click below to register this email/password as the single Administrator login for this database:</span>
              <button
                type="button"
                onClick={handleRegisterAdmin}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded px-2.5 py-1 mt-1 text-[10px] font-bold self-start transition-colors"
              >
                Register Admin Account
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] bg-gradient-to-br from-indigo-950/40 via-zinc-950 to-emerald-950/30 p-4 font-sans select-none">
      
      {/* Login Card Container */}
      <div className="w-full max-w-md glass-card border border-zinc-800/80 p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center mb-8 relative">
          <img src="/icon.png" className="w-16 h-16 object-contain mb-3 select-none" alt="Flawlex logo" />
          <h1 className="text-xl font-bold tracking-tight text-white">Flawlex Technologies SBA Portal</h1>
          <p className="text-xs text-zinc-400 mt-1 text-center">
            Sign in to access your classroom spreadsheets and report cards
          </p>
        </div>

        {error && (
          <div className="bg-rose-950/20 border border-rose-800/40 text-rose-300 rounded-lg p-3.5 text-xs flex gap-2.5 mb-6 animate-pulse">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
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
                  className="w-full bg-[#121214] border border-zinc-800/80 rounded-lg pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#121214] border border-zinc-800/80 rounded-lg pl-10 pr-10 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
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

        <div className="mt-8 pt-4 border-t border-zinc-800/60 text-center flex flex-col gap-2">
          <p className="text-[10px] text-zinc-500 font-medium">SBA portal by Flawlex Technologiess (0592664865)</p>
        </div>

      </div>
    </div>
  );
}
