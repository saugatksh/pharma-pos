import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    setMounted(true);
    const err = sessionStorage.getItem('authError');
    if (err) {
      setAuthError(err);
      sessionStorage.removeItem('authError');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password) return toast.error('Please enter username and password');
    setLoading(true);
    try {
      const user = await login(form.username, form.password);
      toast.success(`Welcome back, ${user.name}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #0f4c3a 100%)' }}>

      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #22c55e, transparent)', animation: 'float 8s ease-in-out infinite' }} />
        <div className="absolute top-1/2 -right-32 w-80 h-80 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent)', animation: 'float 10s ease-in-out infinite reverse' }} />
        <div className="absolute -bottom-32 left-1/3 w-72 h-72 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)', animation: 'float 12s ease-in-out infinite' }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
      </div>

      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-20px) scale(1.05)} }
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        .login-card { animation: fadeSlideUp 0.6s ease forwards; }
        .logo-ring { animation: float 4s ease-in-out infinite; }
        .shimmer-btn {
          background: linear-gradient(90deg, #16a34a, #22c55e, #16a34a);
          background-size: 200% auto;
          transition: background-position 0.4s ease, transform 0.1s ease, box-shadow 0.2s ease;
        }
        .shimmer-btn:hover:not(:disabled) { background-position: right center; transform: translateY(-1px); box-shadow: 0 8px 25px rgba(34,197,94,0.4); }
        .shimmer-btn:active:not(:disabled) { transform: translateY(0); }
        .input-field {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.15);
          color: white;
          transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
        }
        .input-field::placeholder { color: rgba(255,255,255,0.35); }
        .input-field:focus { outline: none; border-color: #22c55e; background: rgba(255,255,255,0.1); box-shadow: 0 0 0 3px rgba(34,197,94,0.15); }
        .input-field:-webkit-autofill { -webkit-box-shadow: 0 0 0 100px rgba(15,76,58,0.9) inset; -webkit-text-fill-color: white; }
      `}</style>

      <div className={`relative z-10 w-full max-w-md px-4 transition-all duration-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
        <div className="login-card">
          {/* Logo Section */}
          <div className="text-center mb-8">
            <div className="logo-ring inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-5 relative"
              style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)', boxShadow: '0 10px 40px rgba(34,197,94,0.4)' }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="15" y="4" width="10" height="32" rx="4" fill="white" fillOpacity="0.9"/>
                <rect x="4" y="15" width="32" height="10" rx="4" fill="white" fillOpacity="0.9"/>
              </svg>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-slate-900" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">PharmaPOS</h1>
            <p className="text-emerald-400 text-sm mt-1 font-medium tracking-wide uppercase">Pharmacy Management System</p>
          </div>

          {/* Card */}
          <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 25px 60px rgba(0,0,0,0.4)' }}>
            <h2 className="text-xl font-semibold text-white mb-1">Welcome back</h2>
            <p className="text-slate-400 text-sm mb-6">Sign in to your account to continue</p>

            {authError && (
              <div className="mb-5 rounded-xl px-4 py-3 text-sm font-medium text-center"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}>
                🔒 {authError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Username</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 8a3 3 0 100-6 3 3 0 000 6zm-5 6a5 5 0 0110 0H3z"/></svg>
                  </span>
                  <input
                    type="text"
                    value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value })}
                    className="input-field w-full pl-9 pr-4 py-3 rounded-xl text-sm"
                    placeholder="Enter your username"
                    autoComplete="username"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11 7V5a3 3 0 10-6 0v2H3v7h10V7h-2zM7 5a1 1 0 012 0v2H7V5zm1 7a1 1 0 110-2 1 1 0 010 2z"/></svg>
                  </span>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="input-field w-full pl-9 pr-11 py-3 rounded-xl text-sm"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                    {showPass
                      ? <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 00-2.79.588l.77.771A5.944 5.944 0 018 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0114.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/><path d="M11.297 9.176a3.5 3.5 0 00-4.474-4.474l.823.823a2.5 2.5 0 012.829 2.829l.822.822zm-2.943 1.299l.822.822a3.5 3.5 0 01-4.474-4.474l.823.823a2.5 2.5 0 002.829 2.829z"/><path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 001.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 018 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884l-12-12 .708-.708 12 12-.708.708z"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 011.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0114.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 011.172 8z"/><path d="M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM4.5 8a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0z"/></svg>
                    }
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="shimmer-btn w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed mt-2">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 8a3 3 0 100-6 3 3 0 000 6zm2-3a2 2 0 11-4 0 2 2 0 014 0zm4 8c0 1-1 1-1 1H1s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C9.516 10.68 8.289 10 6 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/></svg>
                    Sign In to PharmaPOS
                  </span>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-slate-500 mt-6">
            PharmaPOS - Developed by{" "}
            <a
              href="https://www.saugatbohara.com.np"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800"
            >
              Saugat Bohara
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}