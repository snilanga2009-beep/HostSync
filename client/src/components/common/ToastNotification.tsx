import React from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

export const ToastNotification: React.FC = () => {
  const { activeAlert, dismissAlert } = useNotifications();

  if (!activeAlert) return null;

  const isUrgent = activeAlert.type === 'urgent';
  const isWarning = activeAlert.type === 'warning';
  const isSuccess = activeAlert.type === 'success';

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full animate-bounceIn">
      <div className={`p-4 rounded-2xl shadow-2xl border flex items-start gap-3 bg-white ${
        isUrgent ? 'border-rose-300 ring-2 ring-rose-500/20' : (isWarning ? 'border-amber-300 ring-2 ring-amber-500/20' : 'border-slate-200')
      }`}>
        <div className={`p-2 rounded-xl shrink-0 ${
          isUrgent ? 'bg-rose-100 text-rose-600' : (isWarning ? 'bg-amber-100 text-amber-600' : (isSuccess ? 'bg-emerald-100 text-emerald-600' : 'bg-brand-100 text-brand-600'))
        }`}>
          {isUrgent ? <AlertCircle className="w-5 h-5" /> : (isWarning ? <AlertTriangle className="w-5 h-5" /> : (isSuccess ? <CheckCircle className="w-5 h-5" /> : <Info className="w-5 h-5" />))}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-slate-900">{activeAlert.title}</h4>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{activeAlert.message}</p>
        </div>
        <button
          onClick={dismissAlert}
          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
