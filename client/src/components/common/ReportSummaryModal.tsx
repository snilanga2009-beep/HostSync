import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Modal } from './Modal';
import {
  BarChart3,
  Wrench,
  CheckCircle2,
  Clock,
  DollarSign,
  HeartHandshake,
  TrendingUp,
  AlertTriangle,
  Printer,
  Calendar,
  Sparkles,
  BedDouble,
  Star,
  Users,
  BellRing,
  Loader2,
  RefreshCw
} from 'lucide-react';

interface ReportSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SummaryData {
  timeframe: string;
  summary: {
    totalDispatches: number;
    totalResolved: number;
    resolutionRate: number;
    maintenance: {
      total: number;
      completed: number;
      pending: number;
      urgent: number;
      totalRepairCost: number;
      avgTurnaroundMinutes: number;
    };
    services: {
      total: number;
      delivered: number;
      pending: number;
    };
    tips: {
      totalAmount: number;
      totalCount: number;
      avgAmount: string;
    };
    rooms: {
      total: number;
      occupied: number;
      available: number;
      maintenance: number;
      cleaning: number;
      occupancyRate: number;
    };
  };
  topEquipment: Array<{
    item_name: string;
    report_count: number;
    urgent_count: number;
  }>;
  topServices: Array<{
    service_type: string;
    request_count: number;
    total_units: number;
  }>;
  topStaff: Array<{
    staff_id: string;
    full_name: string;
    job_title: string;
    department: string;
    rating: number;
    avatar_url?: string;
    total_assigned: number;
    completed_tasks: number;
    total_tips_earned: number;
  }>;
}

export const ReportSummaryModal: React.FC<ReportSummaryModalProps> = ({ isOpen, onClose }) => {
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async (tf: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<SummaryData>(`/reports/executive-summary?timeframe=${tf}`);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load executive summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSummary(timeframe);
    }
  }, [isOpen, timeframe]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Executive Operations & Hospitality Summary"
      subtitle="High-level operational performance, dispatch turnaround rates, and service efficiency"
      maxWidth="5xl"
    >
      <div className="space-y-6 print:p-0">
        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 print:hidden">
          {/* Timeframe Filter Buttons */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            {[
              { key: 'today', label: 'Today' },
              { key: 'week', label: 'Last 7 Days' },
              { key: 'month', label: 'Last 30 Days' },
              { key: 'all', label: 'All-Time' }
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTimeframe(t.key as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  timeframe === t.key
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchSummary(timeframe)}
              disabled={loading}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-red-600' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-md shadow-red-600/20 transition-all inline-flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Export PDF</span>
            </button>
          </div>
        </div>

        {/* Content Section */}
        {loading && !data ? (
          <div className="py-20 text-center flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-2" />
            <p className="text-xs font-bold text-slate-500">Calculating executive analytics...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center text-red-700">
            <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-600" />
            <p className="text-xs font-bold">{error}</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Primary KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Total Dispatches Card */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/5 rounded-bl-full pointer-events-none" />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Total Dispatches
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <div className="text-2xl font-black text-slate-900">
                    {data.summary.totalDispatches}
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {data.summary.resolutionRate}% Resolved
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <span>{data.summary.maintenance.total} Maintenance</span>
                  <span>{data.summary.services.total} Supplies</span>
                </div>
              </div>

              {/* Turnaround Time */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Avg Turnaround
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <div className="text-2xl font-black text-slate-900">
                    {data.summary.maintenance.avgTurnaroundMinutes > 0
                      ? `${data.summary.maintenance.avgTurnaroundMinutes} min`
                      : 'Immediate'}
                  </div>
                  <Clock className="w-4 h-4 text-red-600" />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <span>{data.summary.maintenance.completed} Closed</span>
                  <span className="text-amber-600 font-bold">{data.summary.maintenance.pending} Pending</span>
                </div>
              </div>

              {/* Repair Expenditure */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Recorded Repair Cost
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <div className="text-2xl font-black text-red-600">
                    ${data.summary.maintenance.totalRepairCost.toFixed(2)}
                  </div>
                  <DollarSign className="w-4 h-4 text-red-600" />
                </div>
                <p className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                  Total replacement parts & work orders
                </p>
              </div>

              {/* Tips Collected */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Guest Gratuities
                </span>
                <div className="flex items-baseline justify-between mt-1">
                  <div className="text-2xl font-black text-emerald-600">
                    ${data.summary.tips.totalAmount.toFixed(2)}
                  </div>
                  <HeartHandshake className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <span>{data.summary.tips.totalCount} tips</span>
                  <span>Avg ${data.summary.tips.avgAmount}</span>
                </div>
              </div>
            </div>

            {/* Room Health & Occupancy Card */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-red-400 text-xs font-black uppercase tracking-wider mb-1">
                  <BedDouble className="w-4 h-4" />
                  <span>Room Inventory & Occupancy Snapshot</span>
                </div>
                <div className="text-xl font-extrabold tracking-tight">
                  {data.summary.rooms.occupancyRate}% Current Hotel Occupancy
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {data.summary.rooms.occupied} of {data.summary.rooms.total} guest rooms currently occupied
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 self-stretch md:self-auto">
                <div className="bg-white/10 px-3 py-2 rounded-xl text-center">
                  <span className="block text-[10px] font-bold text-slate-300 uppercase">Available</span>
                  <span className="text-lg font-black text-emerald-400">{data.summary.rooms.available}</span>
                </div>
                <div className="bg-white/10 px-3 py-2 rounded-xl text-center">
                  <span className="block text-[10px] font-bold text-slate-300 uppercase">Cleaning</span>
                  <span className="text-lg font-black text-amber-400">{data.summary.rooms.cleaning}</span>
                </div>
                <div className="bg-white/10 px-3 py-2 rounded-xl text-center">
                  <span className="block text-[10px] font-bold text-slate-300 uppercase">Maintenance</span>
                  <span className="text-lg font-black text-rose-400">{data.summary.rooms.maintenance}</span>
                </div>
              </div>
            </div>

            {/* Two-Column Grid: Equipment Breakdown & Guest Services */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Equipment Diagnostics */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-red-600" />
                    <span>Top In-Room Equipment Incidents</span>
                  </h4>
                  <span className="text-[10px] text-slate-400 font-bold">Volume</span>
                </div>

                {data.topEquipment.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No maintenance incidents recorded in this timeframe.</p>
                ) : (
                  <div className="space-y-2.5">
                    {data.topEquipment.map((eq) => {
                      const maxCount = data.topEquipment[0]?.report_count || 1;
                      const pct = Math.round((eq.report_count / maxCount) * 100);
                      return (
                        <div key={eq.item_name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800">{eq.item_name}</span>
                            <div className="flex items-center gap-2">
                              {eq.urgent_count > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                  {eq.urgent_count} urgent
                                </span>
                              )}
                              <span className="font-bold text-slate-700">{eq.report_count} reports</span>
                            </div>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-red-600 to-rose-400 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Guest Amenity & Supply Dispatches */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <BellRing className="w-3.5 h-3.5 text-red-600" />
                    <span>Most Requested Guest Amenities</span>
                  </h4>
                  <span className="text-[10px] text-slate-400 font-bold">Total Delivered</span>
                </div>

                {data.topServices.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No service requests recorded in this timeframe.</p>
                ) : (
                  <div className="space-y-2.5">
                    {data.topServices.map((sv) => {
                      const maxCount = data.topServices[0]?.request_count || 1;
                      const pct = Math.round((sv.request_count / maxCount) * 100);
                      return (
                        <div key={sv.service_type} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800">{sv.service_type}</span>
                            <span className="font-bold text-slate-700">{sv.request_count} orders ({sv.total_units} units)</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-slate-900 to-slate-700 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Staff Performance Leaderboard */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-red-600" />
                  <span>Operations Staff & Technician Leaderboard</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-bold">Ranked by Tasks Completed</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 uppercase font-black text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4 text-center">Assigned</th>
                      <th className="py-3 px-4 text-center">Completed</th>
                      <th className="py-3 px-4 text-center">Guest Rating</th>
                      <th className="py-3 px-4 text-right">Tips Disbursed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.topStaff.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No staff activity logged.
                        </td>
                      </tr>
                    ) : (
                      data.topStaff.map((st) => (
                        <tr key={st.staff_id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={
                                  st.avatar_url ||
                                  `https://ui-avatars.com/api/?name=${encodeURIComponent(st.full_name)}&background=dc2626&color=fff&bold=true`
                                }
                                alt={st.full_name}
                                className="w-8 h-8 rounded-lg object-cover border border-slate-200"
                              />
                              <div>
                                <p className="font-extrabold text-slate-900">{st.full_name}</p>
                                <p className="text-[10px] text-slate-400">{st.job_title}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {st.department}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-700">{st.total_assigned}</td>
                          <td className="py-3 px-4 text-center font-black text-emerald-600">{st.completed_tasks}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                              <span>{st.rating?.toFixed(1) || '5.0'}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900">
                            ${st.total_tips_earned.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-400">
          <span>ResortCare Operational Intelligence Engine</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
          >
            Close Report
          </button>
        </div>
      </div>
    </Modal>
  );
};
