import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  let colorStyles = 'bg-slate-100 text-slate-700 border-slate-200';

  const s = status.toLowerCase();

  if (s === 'available' || s === 'completed' || s === 'paid' || s === 'working' || s === 'delivered' || s === 'active') {
    colorStyles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (s === 'occupied' || s === 'in progress' || s === 'assigned' || s === 'accepted' || s === 'processing') {
    colorStyles = 'bg-sky-50 text-sky-700 border-sky-200';
  } else if (s === 'cleaning' || s === 'on the way' || s === 'received' || s === 'needs inspection') {
    colorStyles = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (s === 'maintenance' || s === 'emergency' || s === 'failed' || s === 'not working' || s === 'damaged' || s === 'broken' || s === 'out of service') {
    colorStyles = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (s === 'submitted' || s === 'pending' || s === 'vacant') {
    colorStyles = 'bg-purple-50 text-purple-700 border-purple-200';
  }

  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${padding} ${colorStyles}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75"></span>
      {status}
    </span>
  );
};
