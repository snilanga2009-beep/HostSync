import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import {
  Sparkles,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Loader2,
  AlertCircle
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const branding = useBranding();

  const [email, setEmail] = useState('admin@oceanpearl.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.post<{ token: string; user: any }>('/auth/login', {
        email,
        password
      });

      login(res.token, res.user);

      // Navigate based on role
      if (res.user.role === 'Technician' || res.user.role === 'Room Service Boy' || res.user.role === 'Housekeeping Staff') {
        navigate('/staff/tasks');
      } else if (res.user.role === 'Front Office Staff') {
        navigate('/admin/front-office');
      } else {
        navigate('/admin');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const setDemoRole = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow in Red */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        {branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={branding.hotelName}
            className="w-16 h-16 rounded-2xl object-cover mx-auto mb-3 border-2 border-red-500/40 bg-white p-1 shadow-xl shadow-red-900/30"
          />
        ) : (
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-rose-700 flex items-center justify-center text-white mx-auto shadow-xl shadow-red-600/30 mb-3">
            <Sparkles className="w-7 h-7" />
          </div>
        )}
        <h2 className="text-2xl font-black text-white tracking-tight">{branding.hotelName || branding.productName || 'ResortCare'}</h2>
        <p className="text-xs text-slate-400 mt-1">{branding.subtitle || 'Smart Guest Service & Room Maintenance Platform'}</p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 relative z-10">
        <div className="bg-white py-8 px-6 sm:px-8 rounded-3xl shadow-2xl border border-slate-200/80">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Staff Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-600/20 transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              <span>Sign In to ResortCare</span>
            </button>
          </form>

          {/* 1-Click Role Switcher for Instant Evaluation */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 text-center">
              Quick Test Login (1-Click Demo Accounts)
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setDemoRole('admin@oceanpearl.com')}
                className="p-2 rounded-lg bg-slate-50 hover:bg-brand-50 text-slate-700 hover:text-brand-700 font-semibold text-left border border-slate-200/60 transition-colors"
              >
                Super Admin
              </button>
              <button
                type="button"
                onClick={() => setDemoRole('frontdesk@oceanpearl.com')}
                className="p-2 rounded-lg bg-slate-50 hover:bg-brand-50 text-slate-700 hover:text-brand-700 font-semibold text-left border border-slate-200/60 transition-colors"
              >
                Front Office Staff
              </button>
              <button
                type="button"
                onClick={() => setDemoRole('david@oceanpearl.com')}
                className="p-2 rounded-lg bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-700 font-semibold text-left border border-slate-200/60 transition-colors"
              >
                Technician David
              </button>
              <button
                type="button"
                onClick={() => setDemoRole('john@oceanpearl.com')}
                className="p-2 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-semibold text-left border border-slate-200/60 transition-colors"
              >
                Room Service John
              </button>
            </div>
          </div>

          {/* Guest Portal Callout */}
          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            <a
              href="/guest/r/ocean101token"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-800"
            >
              <Smartphone className="w-4 h-4" />
              <span>Experience Mobile Guest QR Portal (Room 101)</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
