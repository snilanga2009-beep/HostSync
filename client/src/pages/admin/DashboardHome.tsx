import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge } from '../../components/common/PriorityBadge';
import { ReportSummaryModal } from '../../components/common/ReportSummaryModal';
import {
  DoorClosed,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  BellRing,
  HeartHandshake,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Loader2,
  Calendar,
  Sparkles
} from 'lucide-react';

interface KPIResponse {
  rooms: {
    total: number;
    occupied: number;
    available: number;
    cleaning: number;
    maintenance: number;
  };
  requests: {
    open: number;
    urgent: number;
    assigned: number;
    completedToday: number;
    pendingServices: number;
  };
  financials: {
    tipsToday: number;
  };
}

interface RecentRequest {
  id: string;
  request_code: string;
  room_number: string;
  priority: string;
  status: string;
  description: string;
  created_at: string;
  assigned_staff_name?: string;
  reported_items_summary?: string;
  type?: 'maintenance' | 'service';
}

interface DashboardHomeProps {
  onNavigate: (path: string) => void;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({ onNavigate }) => {
  const [kpi, setKpi] = useState<KPIResponse | null>(null);
  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);

  const loadData = async () => {
    try {
      const [kpiRes, reqRes, srvRes] = await Promise.all([
        api.get<KPIResponse>('/reports/dashboard-kpi'),
        api.get<{ requests: RecentRequest[] }>('/requests'),
        api.get<{ services?: any[]; requests?: any[] }>('/requests/services/list').catch(() => ({ services: [] }))
      ]);
      setKpi(kpiRes);

      const combined: RecentRequest[] = [];
      (reqRes.requests || []).forEach(r => {
        combined.push({
          ...r,
          type: 'maintenance'
        });
      });

      const srvList: any[] = (srvRes as any)?.services || (srvRes as any)?.requests || [];
      srvList.forEach((s: any) => {
        combined.push({
          id: s.id,
          request_code: s.request_code,
          room_number: s.room_number,
          priority: s.priority || 'Normal',
          status: s.status || 'Submitted',
          description: s.service_type ? `${s.service_type}: ${s.notes || ''}` : (s.notes || 'Service Request'),
          created_at: s.created_at,
          assigned_staff_name: s.assigned_staff_name,
          reported_items_summary: s.service_type ? `[Service] ${s.service_type}` : '[Service] Guest Request',
          type: 'service'
        });
      });

      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRecentRequests(combined.slice(0, 8));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleNewRequest = () => {
      loadData();
    };
    window.addEventListener('hotel_new_request', handleNewRequest);
    const interval = setInterval(loadData, 15000);
    return () => {
      window.removeEventListener('hotel_new_request', handleNewRequest);
      clearInterval(interval);
    };
  }, []);

  if (loading || !kpi) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
      </div>
    );
  }

  const occupancyRate = kpi.rooms.total > 0
    ? Math.round((kpi.rooms.occupied / kpi.rooms.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-brand-950 rounded-2xl p-6 text-white shadow-luxury flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" /> Operations Overview
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">Ocean Pearl Resort & Spa</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-lg leading-relaxed">
            Real-time room availability, active in-room guest maintenance dispatch, and staff assignment hub.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setSummaryModalOpen(true)}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" /> Executive Report
          </button>
          <button
            onClick={() => onNavigate('/admin/maintenance')}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Wrench className="w-4 h-4" /> Open Dispatch
          </button>
          <button
            onClick={() => onNavigate('/admin/qr-sheets')}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            Print QR Sheet
          </button>
        </div>
      </div>

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Rooms & Occupancy */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Occupancy</span>
            <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <DoorClosed className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{occupancyRate}%</span>
            <span className="text-xs font-semibold text-slate-500">
              ({kpi.rooms.occupied}/{kpi.rooms.total} Rooms)
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-600">
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">{kpi.rooms.available} Available</span>
            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">{kpi.rooms.cleaning} Cleaning</span>
          </div>
        </div>

        {/* Open Maintenance Requests */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Open Maintenance</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{kpi.requests.open}</span>
            <span className="text-xs font-semibold text-slate-500">Requests</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px]">
            <span className={`px-2 py-0.5 rounded font-bold ${
              kpi.requests.urgent > 0 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-slate-100 text-slate-600'
            }`}>
              {kpi.requests.urgent} Urgent / Emergency
            </span>
          </div>
        </div>

        {/* Completed Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Completed Today</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{kpi.requests.completedToday}</span>
            <span className="text-xs font-semibold text-emerald-600">Fixed</span>
          </div>
          <div className="mt-3 text-[11px] text-slate-500">
            {kpi.requests.assigned} currently in progress
          </div>
        </div>

        {/* Tips Received Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tips Today</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <HeartHandshake className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">${kpi.financials.tipsToday.toFixed(2)}</span>
            <span className="text-xs font-semibold text-rose-600">Staff Gratuity</span>
          </div>
          <div className="mt-3 text-[11px] text-slate-500">
            100% credited to room staff
          </div>
        </div>
      </div>

      {/* Live Front Office Dispatch Queue */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Active Maintenance Dispatch Queue</h3>
            <p className="text-xs text-slate-500 mt-0.5">Real-time alerts submitted by in-room guests</p>
          </div>
          <button
            onClick={() => onNavigate('/admin/maintenance')}
            className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1"
          >
            View All ({kpi.requests.open}) <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-3 px-4">Request</th>
                <th className="py-3 px-4">Room</th>
                <th className="py-3 px-4">Reported Items</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Assigned To</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No active maintenance requests. All rooms operating smoothly.
                  </td>
                </tr>
              ) : (
                recentRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{req.request_code}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-extrabold text-[11px]">
                        {req.room_number}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-700 font-medium">
                      {req.reported_items_summary || req.description}
                    </td>
                    <td className="py-3 px-4">
                      <PriorityBadge priority={req.priority} />
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {req.assigned_staff_name ? (
                        <span className="font-semibold text-slate-900">{req.assigned_staff_name}</span>
                      ) : (
                        <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={req.status} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onNavigate('/admin/maintenance')}
                        className="px-2.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg font-bold text-[11px] transition-colors"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
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
