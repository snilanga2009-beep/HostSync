import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { StaffProfile } from '../../types';
import {
  Send,
  MessageSquare,
  Smartphone,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  RefreshCw,
  Search,
  Filter,
  Users,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Sliders
} from 'lucide-react';

interface NotificationLog {
  id: string;
  job_id?: string;
  staff_id?: string;
  channel: 'SMS' | 'WhatsApp';
  provider: string;
  recipient: string;
  message_template?: string;
  provider_message_id?: string;
  status: 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'READ';
  sent_at?: string;
  delivered_at?: string;
  failed_at?: string;
  error_code?: string;
  error_message?: string;
  retry_count: number;
  fallback_used: number;
  staff_name?: string;
  job_title?: string;
  request_code?: string;
  room_number?: string;
  created_at: string;
}

interface NotificationStats {
  total: number;
  smsSent: number;
  whatsappSent: number;
  delivered: number;
  failed: number;
  fallbackUsed: number;
}

export const NotificationCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<NotificationStats>({
    total: 0,
    smsSent: 0,
    whatsappSent: 0,
    delivered: 0,
    failed: 0,
    fallbackUsed: 0
  });
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterChannel, setFilterChannel] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterStaff, setFilterStaff] = useState('All');

  // Test trigger state
  const [testStaffId, setTestStaffId] = useState('');
  const [testingChannel, setTestingChannel] = useState<'SMS' | 'WhatsApp' | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const handleRetrySms = async (id: string) => {
    setRetryingId(id);
    try {
      const res = await api.post<any>(`/notifications/sms/retry/${id}`);
      if (res.success) {
        setTestResult({
          success: true,
          message: 'SMS retry queued and dispatched successfully!'
        });
        await loadData();
      } else {
        setTestResult({
          success: false,
          message: res.error || 'Failed to retry SMS dispatch.'
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Error executing SMS retry.'
      });
    } finally {
      setRetryingId(null);
    }
  };

  const loadData = async () => {
    try {
      const [statsRes, logsRes, staffRes] = await Promise.all([
        api.get<{ stats: NotificationStats }>('/notifications/center/stats'),
        api.get<{ logs: NotificationLog[] }>(`/notifications/center/logs?channel=${filterChannel}&status=${filterStatus}&staff_id=${filterStaff}`),
        api.get<{ staff: StaffProfile[] }>('/staff')
      ]);

      setStats(statsRes.stats);
      setLogs(logsRes.logs);
      setStaffList(staffRes.staff);
      if (!testStaffId && staffRes.staff.length > 0) {
        setTestStaffId(staffRes.staff[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [filterChannel, filterStatus, filterStaff]);

  const handleSendTest = async (channel: 'SMS' | 'WhatsApp') => {
    if (!testStaffId) return;
    setTestingChannel(channel);
    setTestResult(null);

    try {
      const res = await api.post<{ success: boolean; result: any }>('/notifications/test', {
        staffId: testStaffId,
        channel
      });

      if (res.success) {
        setTestResult({
          success: true,
          message: `Test ${channel} dispatched successfully to technician's device!`
        });
      } else {
        setTestResult({
          success: false,
          message: res.result?.errorMessage || `Failed to deliver test ${channel}.`
        });
      }
      await loadData();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Error triggering test notification.'
      });
    } finally {
      setTestingChannel(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Send className="w-5 h-5 text-brand-600" />
            Staff Mobile Notification Center
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Twilio SMS, WhatsApp Business delivery tracking, fallback management, and direct carrier dispatch
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => navigate('/admin/settings?tab=gateways')}
            className="px-3.5 py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5 text-brand-600" />
            Gateway Settings
          </button>
          <button
            onClick={loadData}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" /> Refresh Feed
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Dispatches</span>
          <span className="text-xl font-black text-slate-900 mt-1 block">{stats.total}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Smartphone className="w-3 h-3 text-blue-600" /> SMS Sent
          </span>
          <span className="text-xl font-black text-blue-600 mt-1 block">{stats.smsSent}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <MessageSquare className="w-3 h-3 text-emerald-600" /> WhatsApp Sent
          </span>
          <span className="text-xl font-black text-emerald-600 mt-1 block">{stats.whatsappSent}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Delivered
          </span>
          <span className="text-xl font-black text-emerald-600 mt-1 block">{stats.delivered}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider text-rose-600 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Delivery Failed
          </span>
          <span className="text-xl font-black text-rose-600 mt-1 block">{stats.failed}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft">
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider text-amber-600 flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> Fallback Used
          </span>
          <span className="text-xl font-black text-amber-600 mt-1 block">{stats.fallbackUsed}</span>
        </div>
      </div>

      {/* Live Carrier Test Console */}
      <div className="bg-gradient-to-r from-slate-900 to-brand-950 text-white p-5 rounded-2xl shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider">Live Testing & Diagnostics</span>
          <h3 className="text-sm font-extrabold mt-0.5">Instant Technician Channel Verification</h3>
          <p className="text-xs text-slate-300 mt-0.5 max-w-xl">
            Verify SMS and WhatsApp delivery directly to staff phone numbers without creating a real room request.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={testStaffId}
            onChange={(e) => setTestStaffId(e.target.value)}
            className="text-xs py-2 px-3 rounded-xl bg-slate-800 text-white border border-slate-700 font-semibold focus:outline-none"
          >
            {staffList.map((st) => (
              <option key={st.id} value={st.id}>
                {st.full_name} ({st.job_title})
              </option>
            ))}
          </select>

          <button
            onClick={() => handleSendTest('SMS')}
            disabled={testingChannel !== null}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
          >
            {testingChannel === 'SMS' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5" />}
            Test SMS
          </button>

          <button
            onClick={() => handleSendTest('WhatsApp')}
            disabled={testingChannel !== null}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
          >
            {testingChannel === 'WhatsApp' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
            Test WhatsApp
          </button>
        </div>
      </div>

      {testResult && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            testResult.success
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{testResult.message}</span>
          <button onClick={() => setTestResult(null)} className="text-slate-400 hover:text-slate-600 text-[10px]">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filters:
          </span>

          <select
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
            className="text-xs py-1.5 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-semibold focus:outline-none"
          >
            <option value="All">All Channels</option>
            <option value="SMS">SMS Only</option>
            <option value="WhatsApp">WhatsApp Only</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs py-1.5 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-semibold focus:outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="DELIVERED">Delivered</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
            <option value="QUEUED">Queued</option>
          </select>

          <select
            value={filterStaff}
            onChange={(e) => setFilterStaff(e.target.value)}
            className="text-xs py-1.5 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-semibold focus:outline-none"
          >
            <option value="All">All Staff</option>
            {staffList.map((st) => (
              <option key={st.id} value={st.id}>
                {st.full_name}
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs text-slate-400">
          Showing {logs.length} logged dispatches
        </span>
      </div>

      {/* Delivery Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200/80 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Room & Job</th>
                <th className="py-3 px-4">Technician</th>
                <th className="py-3 px-4">Channel & Provider</th>
                <th className="py-3 px-4">Recipient Phone</th>
                <th className="py-3 px-4">Delivery Status</th>
                <th className="py-3 px-4">Fallback</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    No notification logs match your filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Timestamp */}
                    <td className="py-3.5 px-4 text-slate-600 shrink-0">
                      <span className="font-bold text-slate-800 block">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(log.created_at).toLocaleDateString()}
                      </span>
                    </td>

                    {/* Room & Job */}
                    <td className="py-3.5 px-4">
                      {log.room_number ? (
                        <div>
                          <span className="font-extrabold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-lg border border-brand-200">
                            Room {log.room_number}
                          </span>
                          <span className="text-xs text-slate-500 ml-1 font-medium">{log.request_code}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">System Test</span>
                      )}
                    </td>

                    {/* Technician */}
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block">{log.staff_name || 'Staff Member'}</span>
                      <span className="text-[10px] text-slate-400">{log.job_title}</span>
                    </td>

                    {/* Channel & Provider */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        {log.channel === 'WhatsApp' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-lg border border-emerald-200 text-[11px]">
                            <MessageSquare className="w-3 h-3" /> WhatsApp
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-lg border border-blue-200 text-[11px]">
                            <Smartphone className="w-3 h-3" /> SMS
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">({log.provider})</span>
                      </div>
                    </td>

                    {/* Recipient */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-700">
                      {log.recipient}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          log.status === 'DELIVERED' || log.status === 'READ'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.status === 'SENT'
                            ? 'bg-blue-100 text-blue-800'
                            : log.status === 'FAILED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {log.status === 'DELIVERED' && <CheckCircle2 className="w-3 h-3" />}
                        {log.status === 'FAILED' && <XCircle className="w-3 h-3" />}
                        {log.status}
                      </span>
                      {log.error_message && (
                        <p className="text-[10px] text-rose-600 mt-0.5 max-w-xs truncate" title={log.error_message}>
                          {log.error_message}
                        </p>
                      )}
                    </td>

                    {/* Fallback */}
                    <td className="py-3.5 px-4">
                      {log.fallback_used === 1 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 font-bold rounded text-[10px] border border-amber-200">
                          <RotateCcw className="w-3 h-3" /> Auto Fallback
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      {log.status === 'FAILED' ? (
                        <button
                          onClick={() => handleRetrySms(log.id)}
                          disabled={retryingId === log.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50"
                          title="Retry SMS dispatch"
                        >
                          {retryingId === log.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                          Retry
                        </button>
                      ) : (
                        <span className="text-slate-300 text-[11px]">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
