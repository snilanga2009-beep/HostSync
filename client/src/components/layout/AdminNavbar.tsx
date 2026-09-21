import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useLanguage } from '../../context/LanguageContext';
import { useBranding } from '../../context/BrandingContext';
import {
  Menu,
  Bell,
  Volume2,
  VolumeX,
  Globe,
  ExternalLink,
  CheckCheck,
  Smartphone,
  ChevronDown
} from 'lucide-react';

interface AdminNavbarProps {
  onToggleSidebar: () => void;
  title: string;
  onNavigate: (path: string) => void;
}

export const AdminNavbar: React.FC<AdminNavbarProps> = ({ onToggleSidebar, title, onNavigate }) => {
  const { user } = useAuth();
  const branding = useBranding();
  const { notifications, unreadCount, soundEnabled, setSoundEnabled, markAsRead, markAllAsRead } = useNotifications();
  const { language, setLanguage } = useLanguage();
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-8 py-3.5 flex items-center justify-between shadow-xs">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base lg:text-lg font-bold text-slate-900 leading-tight">{title}</h1>
          <p className="text-[11px] text-slate-500 hidden sm:block">{branding.hotelName || 'Resort Operations'} • Room Maintenance & Guest Ops</p>
        </div>
      </div>

      {/* Right: Quick shortcuts, Notifications, Language, Audio */}
      <div className="flex items-center gap-2 lg:gap-3">
        {/* Quick Launch Guest In-Room Experience (Room 101) */}
        <a
          href="/guest/r/ocean101token"
          target="_blank"
          rel="noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-xl text-xs font-bold border border-brand-200 transition-colors shadow-xs"
          title="Open Mobile Guest QR view for Room 101 in new tab"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Guest QR Demo</span>
          <ExternalLink className="w-3 h-3 opacity-60" />
        </a>

        {/* Audio Sound Chime Toggle */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`p-2 rounded-xl border transition-colors ${
            soundEnabled
              ? 'text-slate-600 border-slate-200 hover:bg-slate-50'
              : 'text-slate-400 border-slate-200 bg-slate-100'
          }`}
          title={soundEnabled ? 'Alert Chime: ON' : 'Alert Chime: MUTED'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4 text-brand-600" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Language Selector */}
        <div className="relative group">
          <button className="flex items-center gap-1 p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold">
            <Globe className="w-4 h-4" />
            <span className="uppercase text-[11px]">{language}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
          <div className="absolute right-0 mt-1 w-32 bg-white rounded-xl shadow-xl border border-slate-200 py-1 hidden group-hover:block z-50">
            <button onClick={() => setLanguage('en')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 font-medium">English</button>
            <button onClick={() => setLanguage('si')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 font-medium">සිංහල (Sinhala)</button>
            <button onClick={() => setLanguage('es')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 font-medium">Español</button>
            <button onClick={() => setLanguage('fr')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 font-medium">Français</button>
            <button onClick={() => setLanguage('ar')} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 font-medium">العربية (Arabic)</button>
          </div>
        </div>

        {/* Notifications Bell Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-scaleUp">
              <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 bg-brand-100 text-brand-700 rounded-full text-[10px] font-extrabold">
                      {unreadCount} New
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[11px] text-brand-600 hover:text-brand-800 font-semibold flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">No notifications yet</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (n.is_read === 0) markAsRead(n.id);
                        if (n.link) {
                          onNavigate(n.link);
                          setShowNotifications(false);
                        }
                      }}
                      className={`p-3.5 hover:bg-slate-50 cursor-pointer transition-colors ${
                        n.is_read === 0 ? 'bg-brand-50/30' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="text-xs font-bold text-slate-900">{n.title}</h5>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-normal">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
