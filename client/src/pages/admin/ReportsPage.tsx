import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { ReportSummaryModal } from '../../components/common/ReportSummaryModal';
import {
  BarChart3,
  Download,
  Wrench,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  Star,
  Loader2,
  Sparkles
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [techPerformance, setTechPerformance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<any>('/reports/maintenance-analytics'),
      api.get<{ performance: any[] }>('/reports/technician-performance')
    ])
      .then(([aRes, pRes]) => {
        setAnalytics(aRes);
        setTechPerformance(pRes.performance);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const downloadCSV = (type: string) => {
    window.location.href = `/api/reports/export-csv?type=${type}`;
  };

  if (loading || !analytics) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Hospitality & Maintenance Reports</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Equipment reliability diagnostics, repair expenditure, and technician response metrics
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => setSummaryModalOpen(true)}
            className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-md shadow-red-600/20 transition-all flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" /> Executive Summary Modal
          </button>
          <button
            onClick={() => downloadCSV('requests')}
            className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-slate-500" /> Export Maintenance CSV
          </button>
          <button
            onClick={() => downloadCSV('tips')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> Export Tips CSV
          </button>
        </div>
      </div>

      {/* Top Stat Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Recorded Repair Cost</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            ${analytics.costSummary?.total_repair_cost.toFixed(2) || '0.00'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Across {analytics.costSummary?.jobs_with_cost || 0} work orders with parts replaced
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Most Reported Equipment</span>
          <div className="text-2xl font-black text-rose-600 mt-1">
            {analytics.mostReportedEquipment[0]?.item_name || 'Air Conditioner'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {analytics.mostReportedEquipment[0]?.report_count || 0} incidents recorded
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Problem Category</span>
          <div className="text-2xl font-black text-brand-600 mt-1">
            {analytics.problemsByType[0]?.problem_type || 'Not cooling'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {analytics.problemsByType[0]?.count || 0} logged failures
          </p>
        </div>
      </div>

      {/* Breakdown Charts & Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Reported Equipment Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Most Reported In-Room Equipment
          </h3>
          <div className="space-y-2.5">
            {analytics.mostReportedEquipment.map((eq: any) => {
              const maxCount = analytics.mostReportedEquipment[0]?.report_count || 1;
              const pct = Math.round((eq.report_count / maxCount) * 100);
              return (
                <div key={eq.item_name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{eq.item_name}</span>
                    <span className="font-semibold text-slate-600">{eq.report_count} reports</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-500 to-sky-400 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Failure Categories Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft space-y-4">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Reported Problem Categories
          </h3>
          <div className="space-y-2.5">
            {analytics.problemsByType.map((pb: any) => {
              const maxP = analytics.problemsByType[0]?.count || 1;
              const pct = Math.round((pb.count / maxP) * 100);
              return (
                <div key={pb.problem_type} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{pb.problem_type}</span>
                    <span className="font-semibold text-slate-600">{pb.count} times</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-rose-400 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Technician Performance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Technician & Staff Efficiency
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Assigned Tasks</th>
                <th className="py-3 px-4">Completed Tasks</th>
                <th className="py-3 px-4">Guest Rating</th>
                <th className="py-3 px-4 text-right">Tips Earned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {techPerformance.map((tp) => (
                <tr key={tp.staff_id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <p className="font-bold text-slate-900">{tp.full_name}</p>
                    <p className="text-[10px] text-slate-500">{tp.job_title}</p>
                  </td>
                  <td className="py-3 px-4 text-slate-600 font-medium">{tp.department}</td>
                  <td className="py-3 px-4 font-bold text-slate-800">{tp.total_assigned}</td>
                  <td className="py-3 px-4 font-bold text-emerald-600">{tp.completed_tasks}</td>
                  <td className="py-3 px-4 font-bold text-amber-600 flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{tp.rating?.toFixed(1) || '5.0'}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    ${tp.total_tips_earned.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Executive Report Summary Modal */}
      <ReportSummaryModal
        isOpen={summaryModalOpen}
        onClose={() => setSummaryModalOpen(false)}
      />
    </div>
  );
};
