import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import {
  LayoutDashboard,
  DoorClosed,
  BedDouble,
  Wrench,
  Layers,
  BellRing,
  Users,
  QrCode,
  HeartHandshake,
  CreditCard,
  BarChart3,
  ScrollText,
  Settings,
  LogOut,
  X,
  Sparkles,
  Send,
  Sliders,
  ConciergeBell,
  UserCheck
} from 'lucide-react';

interface AdminSidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  currentPath,
  onNavigate,
  isOpen,
  onClose
}) => {
  const { user, logout, isAdmin, isTechnician } = useAuth();
  const branding = useBranding();

  const navItems = [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, roles: ['Super Admin', 'Hotel Admin', 'Front Office Staff', 'Maintenance Manager'] },
    { label: 'Front Office Desk', path: '/admin/front-office', icon: ConciergeBell, roles: ['Super Admin', 'Hotel Admin', 'Front Office Staff'] },
    { label: 'Rooms', path: '/admin/rooms', icon: DoorClosed, roles: ['Super Admin', 'Hotel Admin', 'Front Office Staff'] },
    { label: 'Room Types', path: '/admin/room-types', icon: BedDouble, roles: ['Super Admin', 'Hotel Admin'] },
    { label: 'Room Items', path: '/admin/room-items', icon: Layers, roles: ['Super Admin', 'Hotel Admin', 'Maintenance Manager'] },
    { label: 'Maintenance', path: '/admin/maintenance', icon: Wrench, roles: ['Super Admin', 'Hotel Admin', 'Front Office Staff', 'Maintenance Manager', 'Technician'] },
    { label: 'Guest Supplies', path: '/admin/guest-requests', icon: BellRing, roles: ['Super Admin', 'Hotel Admin', 'Front Office Staff', 'Room Service Boy', 'Housekeeping Staff'] },
    { label: 'Staff Management', path: '/admin/staff', icon: Users, roles: ['Super Admin', 'Hotel Admin', 'Maintenance Manager'] },
    { label: 'Users & Admins', path: '/admin/users', icon: UserCheck, roles: ['Super Admin', 'Hotel Admin'] },
    { label: 'Notification Center', path: '/admin/notifications-center', icon: Send, roles: ['Super Admin', 'Hotel Admin', 'Maintenance Manager', 'Front Office Staff'] },
    { label: 'SMS & WhatsApp', path: '/admin/settings?tab=gateways', icon: Sliders, roles: ['Super Admin', 'Hotel Admin'] },
    { label: 'Printable QR Sheets', path: '/admin/qr-sheets', icon: QrCode, roles: ['Super Admin', 'Hotel Admin', 'Front Office Staff'] },
    { label: 'Staff Tips', path: '/admin/tips', icon: HeartHandshake, roles: ['Super Admin', 'Hotel Admin', 'Front Office Staff'] },
    { label: 'Payment Gateway', path: '/admin/payments', icon: CreditCard, roles: ['Super Admin', 'Hotel Admin'] },
    { label: 'Reports & Analytics', path: '/admin/reports', icon: BarChart3, roles: ['Super Admin', 'Hotel Admin', 'Maintenance Manager'] },
    { label: 'Audit Trail', path: '/admin/audit', icon: ScrollText, roles: ['Super Admin', 'Hotel Admin'] },
    { label: 'System Settings', path: '/admin/settings', icon: Settings, roles: ['Super Admin', 'Hotel Admin'] },
  ];

  // If technician, add quick link to technician tasks
  const filteredNavItems = navItems.filter(item => {
    if (!user) return false;
    if (user.role === 'Super Admin') return true;
    return item.roles.includes(user.role);
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-950 text-slate-200 flex flex-col transition-transform duration-300 ease-in-out border-r border-slate-800 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header Branding */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.hotelName}
                className="w-10 h-10 rounded-xl object-cover border border-red-500/40 bg-white p-0.5 shadow-md shadow-red-900/30 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-700 flex items-center justify-center text-white shadow-lg shadow-red-600/30 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-black tracking-tight text-white flex items-center gap-1.5 truncate">
                {branding.productName || 'ResortCare'}
                <span className="text-[9px] px-1.5 py-0.5 bg-red-600/30 text-red-300 font-extrabold rounded-md border border-red-500/30">PRO</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate max-w-[130px]" title={branding.hotelName}>
                {branding.hotelName || 'Ocean Pearl Resort'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 lg:hidden shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Technician Shortcut if applicable */}
        {isTechnician && (
          <div className="px-4 pt-3 pb-1">
            <button
              onClick={() => { onNavigate('/staff/tasks'); onClose(); }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/10 transition-all"
            >
              <Wrench className="w-4 h-4" /> My Technician Tasks
            </button>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const fullUrl = window.location.pathname + window.location.search;
            const isActive = item.path.includes('?')
              ? fullUrl === item.path
              : (currentPath === item.path && !window.location.search.includes('tab=gateways'));

            return (
              <button
                key={item.path}
                onClick={() => {
                  onNavigate(item.path);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        {user && (
          <div className="p-3 border-t border-slate-800 bg-slate-950/40">
            <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-800/50">
              <img
                src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=dc2626&color=fff`}
                alt={user.full_name}
                className="w-9 h-9 rounded-lg object-cover border border-slate-700"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{user.full_name}</p>
                <p className="text-[10px] text-brand-300 font-medium truncate">{user.role}</p>
              </div>
              <button
                onClick={logout}
                title="Logout"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
