import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { HeartHandshake, DollarSign, Calendar, ArrowUpRight, Loader2 } from 'lucide-react';

interface TipSummary {
  today: number;
  week: number;
  month: number;
  total: number;
}

interface TipTransaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  room_number: string;
  request_code?: string;
  staff_amount: number;
  guest_name?: string;
  guest_message?: string;
}

export const StaffTipsPage: React.FC = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<TipSummary | null>(null);
  const [transactions, setTransactions] = useState<TipTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.staff_id) return;
    api.get<{ summary: TipSummary; transactions: TipTransaction[] }>(`/staff/${user.staff_id}/tips`)
      .then((res) => {
        setSummary(res.summary);
        setTransactions(res.transactions);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  if (loading || !summary) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-lg font-extrabold text-slate-900">My Tip Earnings</h2>
        <p className="text-xs text-slate-500 mt-0.5">Guest gratuity earnings and transaction history</p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today</span>
          <div className="text-2xl font-black text-rose-600 mt-1">${summary.today.toFixed(2)}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">This Week</span>
          <div className="text-2xl font-black text-slate-900 mt-1">${summary.week.toFixed(2)}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">This Month</span>
          <div className="text-2xl font-black text-slate-900 mt-1">${summary.month.toFixed(2)}</div>
        </div>
        <div className="bg-gradient-to-br from-rose-500 to-rose-600 text-white p-4 rounded-2xl shadow-soft">
          <span className="text-[10px] font-bold text-rose-100 uppercase tracking-wider">All-Time Total</span>
          <div className="text-2xl font-black mt-1">${summary.total.toFixed(2)}</div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h4 className="text-xs font-bold text-slate-800">Received Tips</h4>
        </div>
        <div className="divide-y divide-slate-100">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No tip transactions recorded yet.
            </div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-extrabold text-[11px]">
                      Room {tx.room_number}
                    </span>
                    <span className="text-xs font-bold text-slate-900">${tx.staff_amount.toFixed(2)}</span>
                  </div>
                  {tx.guest_message && (
                    <p className="text-xs text-slate-600 mt-1 italic">"{tx.guest_message}"</p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {new Date(tx.created_at).toLocaleDateString()} at {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div>
                  <StatusBadge status={tx.status} size="sm" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
