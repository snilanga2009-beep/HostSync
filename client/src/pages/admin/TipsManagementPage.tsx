import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Tip } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import {
  HeartHandshake,
  DollarSign,
  Search,
  Filter,
  Settings,
  Download,
  Building,
  Users,
  CheckCircle2,
  Loader2,
  Trash2
} from 'lucide-react';

interface TipSummary {
  paid: { total: number; count: number };
  pending: { total: number; count: number };
  failed: { total: number; count: number };
  staffDisbursed: number;
  hotelPoolRetained: number;
}

export const TipsManagementPage: React.FC = () => {
  const [tips, setTips] = useState<Tip[]>([]);
  const [summary, setSummary] = useState<TipSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Settings modal
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [distRule, setDistRule] = useState('100_staff');
  const [staffPercent, setStaffPercent] = useState(100);
  const [hotelPoolPercent, setHotelPoolPercent] = useState(0);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadData = async () => {
    try {
      const [tipsRes, sumRes] = await Promise.all([
        api.get<{ tips: Tip[] }>('/tips'),
        api.get<TipSummary>('/tips/summary')
      ]);
      setTips(tipsRes.tips);
      setSummary(sumRes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveDistribution = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.put('/tips/distribution-settings', {
        rule: distRule,
        staffPercent: distRule === '100_staff' ? 100 : staffPercent,
        hotelPoolPercent: distRule === '100_staff' ? 0 : hotelPoolPercent
      });
      setSettingsModalOpen(false);
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteTip = async (tip: Tip) => {
    if (!window.confirm(`Are you sure you want to permanently delete/void this tip record ($${tip.amount.toFixed(2)} for ${tip.staff_name} in Room ${tip.room_number})? This cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/tips/${tip.id}`);
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to delete tip');
    }
  };

  const handleExportCSV = () => {
    window.location.href = '/api/reports/export-csv?type=tips';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Staff Tips & Gratuities</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit guest gratuities, track Square payouts, and configure hotel distribution rules
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setSettingsModalOpen(true)}
            className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Settings className="w-4 h-4 text-slate-500" /> Distribution Rules
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Tips Paid</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">${summary.paid.total.toFixed(2)}</div>
            <p className="text-[11px] text-slate-500 mt-1">{summary.paid.count} verified transactions</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Direct Staff Payout</span>
            <div className="text-2xl font-black text-slate-900 mt-1">${summary.staffDisbursed.toFixed(2)}</div>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">Disbursed to staff</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hotel Pool Retained</span>
            <div className="text-2xl font-black text-slate-900 mt-1">${summary.hotelPoolRetained.toFixed(2)}</div>
            <p className="text-[11px] text-slate-500 mt-1">Retained per tip policy</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending / Processing</span>
            <div className="text-2xl font-black text-amber-600 mt-1">${summary.pending.total.toFixed(2)}</div>
            <p className="text-[11px] text-slate-500 mt-1">{summary.pending.count} checkout sessions</p>
          </div>
        </div>
      )}

      {/* Tips Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Room</th>
                <th className="py-3.5 px-4">Staff Member</th>
                <th className="py-3.5 px-4">Tip Amount</th>
                <th className="py-3.5 px-4">Staff Payout</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Transaction ID</th>
                <th className="py-3.5 px-4">Guest Note</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tips.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No tip transactions found.
                  </td>
                </tr>
              ) : (
                tips.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(t.created_at).toLocaleDateString()}
                      <p className="text-[10px] text-slate-400">{new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-extrabold text-slate-800 text-[11px]">
                        Room {t.room_number}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900">{t.staff_name}</p>
                      <p className="text-[10px] text-slate-500">{t.staff_title}</p>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      ${t.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-600">
                      ${(t.staff_amount || t.amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={t.status} size="sm" />
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {t.transaction_id || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate italic">
                      {t.guest_message ? `"${t.guest_message}"` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteTip(t)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors inline-flex"
                        title="Delete / Void Tip Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Distribution Settings Modal */}
      <Modal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        title="Tip Distribution Policy"
        subtitle="Configure how guest tips are shared between staff and hotel pool"
      >
        <form onSubmit={handleSaveDistribution} className="space-y-4">
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Policy Rule
            </label>

            {/* Option A */}
            <div
              onClick={() => {
                setDistRule('100_staff');
                setStaffPercent(100);
                setHotelPoolPercent(0);
              }}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                distRule === '100_staff'
                  ? 'border-brand-500 bg-brand-50/70 ring-1 ring-brand-500/30'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Option A: 100% to Staff</span>
                {distRule === '100_staff' && <CheckCircle2 className="w-4 h-4 text-brand-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                The entire guest gratuity goes directly to the tipped technician or room service staff.
              </p>
            </div>

            {/* Option B */}
            <div
              onClick={() => {
                setDistRule('split_ratio');
                setStaffPercent(80);
                setHotelPoolPercent(20);
              }}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                distRule === 'split_ratio'
                  ? 'border-brand-500 bg-brand-50/70 ring-1 ring-brand-500/30'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Option B: Shared Ratio (Staff / Hotel Pool)</span>
                {distRule === 'split_ratio' && <CheckCircle2 className="w-4 h-4 text-brand-600" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Tip is divided according to customized percentages (e.g. 80% staff, 20% hotel employee pool).
              </p>
            </div>
          </div>

          {distRule === 'split_ratio' && (
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Staff Share (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={staffPercent}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setStaffPercent(val);
                    setHotelPoolPercent(100 - val);
                  }}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Hotel Pool (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={hotelPoolPercent}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setHotelPoolPercent(val);
                    setStaffPercent(100 - val);
                  }}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none font-bold"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={savingSettings}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
          >
            Save Distribution Policy
          </button>
        </form>
      </Modal>
    </div>
  );
};
