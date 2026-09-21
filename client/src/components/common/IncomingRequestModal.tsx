import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import {
  AlertTriangle,
  Bell,
  Clock,
  User,
  ArrowRight,
  X,
  Volume2,
  ShieldAlert,
  Send,
  DoorClosed,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

export const IncomingRequestModal: React.FC = () => {
  const { bigIssuePopup, dismissBigIssuePopup, playAlertSound } = useNotifications();
  const navigate = useNavigate();

  if (!bigIssuePopup) return null;

  const isEmergency =
    bigIssuePopup.priority?.toLowerCase() === 'emergency' ||
    bigIssuePopup.priority?.toLowerCase() === 'urgent' ||
    bigIssuePopup.priority?.toLowerCase() === 'high';

  const isMaintenance = bigIssuePopup.type === 'maintenance';

  const handleGoToDesk = () => {
    dismissBigIssuePopup();
    navigate('/admin/front-office');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/75 backdrop-blur-md animate-fadeIn">
      <div
        className={`relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border-2 transition-all transform animate-bounceIn ${
          isEmergency ? 'border-red-500 ring-4 ring-red-500/20' : 'border-brand-500 ring-4 ring-brand-500/20'
        }`}
      >
        {/* Top Glowing Alert Banner */}
        <div
          className={`px-6 py-4 flex items-center justify-between text-white ${
            isEmergency
              ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700'
              : 'bg-gradient-to-r from-slate-900 via-brand-900 to-red-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-inner">
                {isEmergency ? (
                  <ShieldAlert className="w-6 h-6 text-white animate-pulse" />
                ) : (
                  <Bell className="w-6 h-6 text-white animate-bounce" />
                )}
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20">
                  {isEmergency ? 'Urgent Alert' : 'New In-Room Request'}
                </span>
                <span className="text-xs text-white/80">• Just Now</span>
              </div>
              <h3 className="text-base font-black tracking-tight text-white mt-0.5">
                {isMaintenance ? 'Guest Reported Maintenance Issue' : 'Guest Requested Room Service / Amenities'}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => playAlertSound(isEmergency)}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors"
              title="Replay Alert Chime"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button
              onClick={dismissBigIssuePopup}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Huge Room Number & Status Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex flex-col items-center justify-center shadow-md">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">ROOM</span>
                <span className="text-2xl font-black tracking-tight leading-none text-white">
                  {bigIssuePopup.roomNumber}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    Room {bigIssuePopup.roomNumber}
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase border ${
                      isEmergency
                        ? 'bg-red-100 text-red-700 border-red-200'
                        : 'bg-blue-100 text-blue-700 border-blue-200'
                    }`}
                  >
                    {bigIssuePopup.priority || 'Normal'} Priority
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                  <span>Submitted live via In-Room QR Code</span>
                  <span>•</span>
                  <span className="font-mono text-slate-600 font-bold">{bigIssuePopup.requestCode}</span>
                </p>
              </div>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-200">
              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Guest Details</span>
              <span className="text-sm font-bold text-slate-800 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {bigIssuePopup.guestName || 'In-Room Guest'}
              </span>
              {bigIssuePopup.guestPhone && (
                <span className="text-xs font-mono text-slate-500">{bigIssuePopup.guestPhone}</span>
              )}
            </div>
          </div>

          {/* Issue Category & Details Card */}
          <div className="p-5 rounded-2xl border border-red-100 bg-red-50/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-red-700">
                {isMaintenance ? 'Issue Category & Problem' : 'Requested Amenities / Service'}
              </span>
              <span className="text-[11px] font-bold text-slate-500 bg-white px-2.5 py-0.5 rounded-full border border-slate-200 shadow-xs">
                {bigIssuePopup.category || 'General'}
              </span>
            </div>

            <p className="text-base font-bold text-slate-900 leading-snug">
              {bigIssuePopup.description || 'No additional notes provided by guest.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleGoToDesk}
              className="py-3.5 px-6 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-2xl text-xs font-extrabold shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Dispatch Staff to Room {bigIssuePopup.roomNumber}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              onClick={dismissBigIssuePopup}
              className="py-3.5 px-6 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 rounded-2xl text-xs font-bold border border-slate-200 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-slate-500" />
              <span>Acknowledge & Dismiss</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
