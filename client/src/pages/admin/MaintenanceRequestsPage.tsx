import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { MaintenanceRequest, StaffProfile } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge } from '../../components/common/PriorityBadge';
import { Modal } from '../../components/common/Modal';
import { StaffDispatchModal } from '../../components/common/StaffDispatchModal';
import {
  Wrench,
  Search,
  Filter,
  UserPlus,
  Clock,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Calendar,
  Image as ImageIcon,
  Loader2,
  Copy,
  ExternalLink,
  Send,
  Check,
  Smartphone,
  Sparkles,
  BellRing,
  ConciergeBell,
  RefreshCw,
  Trash2
} from 'lucide-react';

export const MaintenanceRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'maintenance' | 'service'>('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Modals
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const handleCopyJobUrl = (token: string) => {
    const url = `${window.location.origin}/job/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleResend = async (requestId: string) => {
    setResending(true);
    try {
      const res = await api.post<any>(`/requests/${requestId}/resend-notification`, {});
      alert(`Notification dispatched!\nChannels: ${res.notification?.channelsSent?.join(', ') || 'SMS/WhatsApp'}\nStatus: ${res.notification?.overallStatus}`);
      const updated = await api.get<any>(`/requests/${requestId}`);
      setSelectedRequest(updated);
      await loadRequests();
    } catch (err: any) {
      alert(err.message || 'Failed to resend notification');
    } finally {
      setResending(false);
    }
  };

  const loadRequests = async () => {
    try {
      const [maintRes, srvRes] = await Promise.all([
        api.get<{ requests: any[] }>(
          `/requests?search=${encodeURIComponent(search)}&status=${statusFilter}&priority=${priorityFilter}`
        ),
        api.get<{ services?: any[]; requests?: any[] }>('/requests/services/list')
      ]);

      const combined: any[] = [];
      (maintRes.requests || []).forEach((m: any) => {
        combined.push({
          ...m,
          ticketType: 'maintenance'
        });
      });

      const srvList = srvRes.services || srvRes.requests || [];
      srvList.forEach((s: any) => {
        combined.push({
          id: s.id,
          request_code: s.request_code,
          room_number: s.room_number,
          building_name: s.building_name || 'Main Wing',
          priority: s.priority || 'Normal',
          status: s.status || 'Submitted',
          reported_items_summary: s.service_type || 'Guest Supplies',
          description: s.notes || s.special_instructions || 'Service Request',
          created_at: s.created_at,
          assigned_staff_name: s.assigned_staff_name,
          assigned_staff_avatar: s.assigned_staff_avatar,
          assigned_staff_title: s.assigned_staff_title || 'Guest Services',
          ticketType: 'service'
        });
      });

      // Filter by type
      let list = combined;
      if (typeFilter !== 'all') {
        list = list.filter((item) => item.ticketType === typeFilter);
      }

      // Filter by status if applied
      if (statusFilter) {
        list = list.filter((item) => (item.status || '').toLowerCase() === statusFilter.toLowerCase());
      }

      // Filter by priority if applied
      if (priorityFilter) {
        list = list.filter((item) => (item.priority || '').toLowerCase() === priorityFilter.toLowerCase());
      }

      // Filter by search query if applied
      if (search.trim()) {
        const q = search.toLowerCase();
        list = list.filter(
          (item) =>
            (item.request_code || '').toLowerCase().includes(q) ||
            (item.room_number || '').toLowerCase().includes(q) ||
            (item.reported_items_summary || '').toLowerCase().includes(q) ||
            (item.description || '').toLowerCase().includes(q)
        );
      }

      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setRequests(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadRequests();
  }, [typeFilter, statusFilter, priorityFilter]);

  useEffect(() => {
    const handleNewRequest = () => {
      loadRequests();
    };
    window.addEventListener('hotel_new_request', handleNewRequest);
    const interval = setInterval(loadRequests, 15000);
    return () => {
      window.removeEventListener('hotel_new_request', handleNewRequest);
      clearInterval(interval);
    };
  }, [typeFilter, search, statusFilter, priorityFilter]);

  const openAssignModal = (req: any) => {
    setSelectedRequest(req);
    setAssignModalOpen(true);
  };

  const openDetailsModal = async (req: any) => {
    try {
      const details = await api.get<any>(`/requests/${req.id}`);
      setSelectedRequest({
        ...details,
        ticketType: req.ticketType || (details.request?.service_type ? 'service' : 'maintenance')
      });
      setDetailsModalOpen(true);
    } catch (e: any) {
      alert(e.message || 'Failed to load details');
    }
  };

  const handleUpdateStatus = async (requestId: string, newStatus: string) => {
    try {
      await api.post(`/requests/${requestId}/status`, { status: newStatus });
      await loadRequests();
      if (detailsModalOpen && (selectedRequest?.request?.id === requestId || selectedRequest?.id === requestId)) {
        const updated = await api.get<any>(`/requests/${requestId}`);
        setSelectedRequest(updated);
      }
    } catch (e: any) {
      alert(e.message || 'Failed to update status');
    }
  };

  const handleDeleteRequest = async (req: any) => {
    const reqId = req.id || req.request?.id;
    const reqCode = req.request_code || req.request?.request_code || reqId;
    const isService = req.ticketType === 'service' || (!req.ticketType && req.service_type);

    if (!window.confirm(`Are you sure you want to permanently delete ticket #${reqCode}? This action cannot be undone and will remove all assignments and job tokens.`)) {
      return;
    }

    try {
      if (isService) {
        await api.delete(`/requests/services/${reqId}`);
      } else {
        await api.delete(`/requests/${reqId}`);
      }
      if (detailsModalOpen && (selectedRequest?.id === reqId || selectedRequest?.request?.id === reqId)) {
        setDetailsModalOpen(false);
        setSelectedRequest(null);
      }
      await loadRequests();
    } catch (e: any) {
      alert(e.message || 'Failed to delete request');
    }
  };

  const maintenanceCount = requests.filter((r) => r.ticketType === 'maintenance').length;
  const serviceCount = requests.filter((r) => r.ticketType === 'service').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-red-600 text-xs font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Operational Dispatch Hub</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Maintenance & Operations Dispatch Desk</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor, assign, and track guest room maintenance and amenity dispatches in real-time
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setRefreshing(true);
              loadRequests();
            }}
            className="p-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
            title="Refresh requests"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-red-600' : ''}`} />
            <span>Sync Live</span>
          </button>

          <span className="text-xs font-extrabold text-white bg-slate-900 px-3.5 py-2 rounded-xl shadow-xs">
            {requests.length} Active In-Room Dispatches
          </span>
        </div>
      </div>

      {/* Unified Category Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setTypeFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
            typeFilter === 'all'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ConciergeBell className="w-4 h-4" />
          <span>All Dispatches</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${typeFilter === 'all' ? 'bg-white/20' : 'bg-slate-100'}`}>
            {requests.length}
          </span>
        </button>

        <button
          onClick={() => setTypeFilter('maintenance')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
            typeFilter === 'maintenance'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Maintenance & Repairs</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${typeFilter === 'maintenance' ? 'bg-white/20' : 'bg-slate-100'}`}>
            {maintenanceCount}
          </span>
        </button>

        <button
          onClick={() => setTypeFilter('service')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
            typeFilter === 'service'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <BellRing className="w-4 h-4" />
          <span>Guest Supplies & Services</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${typeFilter === 'service' ? 'bg-white/20' : 'bg-slate-100'}`}>
            {serviceCount}
          </span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search request code (RM-1036), room 103, category..."
            className="w-full text-xs pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none bg-white"
          />
        </div>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="text-xs py-2.5 px-3 border border-slate-200 rounded-xl bg-white font-bold focus:ring-2 focus:ring-red-500 focus:outline-none"
        >
          <option value="">All Priorities</option>
          <option value="Emergency">Emergency</option>
          <option value="Urgent">Urgent</option>
          <option value="High">High</option>
          <option value="Normal">Normal</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs py-2.5 px-3 border border-slate-200 rounded-xl bg-white font-bold focus:ring-2 focus:ring-red-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="Submitted">Submitted (New)</option>
          <option value="Assigned">Assigned</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Request</th>
                <th className="py-3.5 px-4">Room</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Reported Issue / Item</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Submitted</th>
                <th className="py-3.5 px-4">Assigned Staff</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-red-600 mx-auto mb-2" />
                    <span>Loading in-room dispatches...</span>
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No requests matching current filters. All rooms operating smoothly.
                  </td>
                </tr>
              ) : (
                requests.map((req) => {
                  const isMaintenance = req.ticketType === 'maintenance';
                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-black text-slate-900">{req.request_code}</td>

                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-black text-xs shadow-xs">
                          {req.room_number}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">{req.building_name || 'Main Wing'}</p>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase inline-flex items-center gap-1 ${
                            isMaintenance ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {isMaintenance ? <Wrench className="w-2.5 h-2.5" /> : <BellRing className="w-2.5 h-2.5" />}
                          {isMaintenance ? 'Maintenance' : 'Service'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs truncate">
                        <p className="font-extrabold text-slate-900 truncate">
                          {req.reported_items_summary || req.category || 'In-Room Request'}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{req.description || 'No additional notes'}</p>
                      </td>

                      <td className="py-3.5 px-4">
                        <PriorityBadge priority={req.priority} />
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        <span className="font-semibold text-slate-700">
                          {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <p className="text-[10px] text-slate-400">{new Date(req.created_at).toLocaleDateString()}</p>
                      </td>

                      <td className="py-3.5 px-4">
                        {req.assigned_staff_name ? (
                          <div>
                            <div className="flex items-center gap-2">
                              <img
                                src={
                                  req.assigned_staff_avatar ||
                                  `https://ui-avatars.com/api/?name=${encodeURIComponent(req.assigned_staff_name)}&background=dc2626&color=fff&bold=true`
                                }
                                alt={req.assigned_staff_name}
                                className="w-7 h-7 rounded-lg object-cover border border-slate-200"
                              />
                              <div>
                                <p className="font-black text-slate-900 text-xs">{req.assigned_staff_name}</p>
                                <p className="text-[10px] text-slate-500">{req.assigned_staff_title || 'Assigned'}</p>
                              </div>
                            </div>
                            {req.latest_job_token && (
                              <div className="flex items-center gap-1 mt-1">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <Smartphone className="w-2.5 h-2.5 mr-0.5 text-emerald-600" />
                                  Mobile Link Active
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyJobUrl(req.latest_job_token!);
                                  }}
                                  className="p-0.5 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition-colors"
                                  title="Copy Mobile Portal Link"
                                >
                                  {copiedToken === req.latest_job_token ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => openAssignModal(req)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xs font-black shadow-md shadow-red-600/20 transition-all flex items-center gap-1.5"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Dispatch Staff</span>
                          </button>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <StatusBadge status={req.status} size="sm" />
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-1">
                        <button
                          onClick={() => openDetailsModal(req)}
                          className="p-1.5 text-slate-600 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors inline-flex"
                          title="View Full Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => openAssignModal(req)}
                          className="p-1.5 text-slate-600 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors inline-flex"
                          title="Dispatch Staff to Request"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleDeleteRequest(req)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors inline-flex"
                          title="Permanently Delete Ticket"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rich Visual Staff Dispatch Modal */}
      <StaffDispatchModal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        request={
          selectedRequest
            ? {
                id: selectedRequest.id || selectedRequest.request?.id,
                roomNumber: selectedRequest.room_number || selectedRequest.request?.room_number,
                category: selectedRequest.reported_items_summary || selectedRequest.category || selectedRequest.request?.category || 'Maintenance',
                description: selectedRequest.description || selectedRequest.request?.description,
                priority: selectedRequest.priority || selectedRequest.request?.priority,
                ticketType: selectedRequest.ticketType || (selectedRequest.request?.service_type ? 'service' : 'maintenance'),
                guestName: selectedRequest.guest_name || selectedRequest.request?.guest_name
              }
            : null
        }
        onDispatchSuccess={loadRequests}
      />

      {/* Details Modal */}
      {selectedRequest && selectedRequest.request && (
        <Modal
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          title={`Request Details - ${selectedRequest.request.request_code}`}
          subtitle={`Room ${selectedRequest.request.room_number} • ${selectedRequest.request.name || 'In-Room Request'}`}
          maxWidth="xl"
        >
          <div className="space-y-5">
            {/* Status & Priority Row */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Current Status</span>
                <StatusBadge status={selectedRequest.request.status} />
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Priority</span>
                <PriorityBadge priority={selectedRequest.request.priority} />
              </div>
            </div>

            {/* Reported Items */}
            {selectedRequest.items && selectedRequest.items.length > 0 && (
              <div>
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2">Reported Items & Diagnostics</h4>
                <div className="space-y-1.5">
                  {selectedRequest.items.map((it: any, i: number) => (
                    <div key={i} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-red-600" />
                        <span className="font-bold text-slate-900">{it.item_name}</span>
                        {it.serial_number && <span className="font-mono text-[10px] text-slate-400">({it.serial_number})</span>}
                      </div>
                      <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-bold text-[11px]">{it.problem_type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {selectedRequest.request.description && (
              <div>
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1">Guest Description / Instructions</h4>
                <p className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 leading-relaxed font-medium">
                  "{selectedRequest.request.description}"
                </p>
              </div>
            )}

            {/* Guest Uploaded Photos */}
            {selectedRequest.request.photos_json && selectedRequest.request.photos_json !== '[]' && (
              <div>
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-500" /> Attached Photos
                </h4>
                <div className="flex gap-2 overflow-x-auto">
                  {JSON.parse(selectedRequest.request.photos_json).map((pUrl: string, idx: number) => (
                    <a key={idx} href={pUrl} target="_blank" rel="noreferrer" className="shrink-0">
                      <img src={pUrl} alt="Inspection" className="w-24 h-24 rounded-xl object-cover border border-slate-200 hover:opacity-90" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Assigned Staff */}
            {selectedRequest.currentAssignment ? (
              <div className="p-3.5 bg-red-50/60 rounded-2xl border border-red-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={
                      selectedRequest.currentAssignment.avatar_url ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedRequest.currentAssignment.staff_name)}&background=dc2626&color=fff&bold=true`
                    }
                    alt={selectedRequest.currentAssignment.staff_name}
                    className="w-10 h-10 rounded-xl object-cover border border-white shadow-xs"
                  />
                  <div>
                    <span className="text-[10px] font-black text-red-700 uppercase">Assigned Staff</span>
                    <h5 className="text-xs font-black text-slate-900">{selectedRequest.currentAssignment.staff_name}</h5>
                    <p className="text-[11px] text-slate-500">{selectedRequest.currentAssignment.job_title}</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setDetailsModalOpen(false);
                    openAssignModal(selectedRequest);
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 text-xs font-bold transition-colors"
                >
                  Reassign
                </button>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-amber-800">Unassigned Request</span>
                  <p className="text-[11px] text-amber-700 mt-0.5">No staff member has been dispatched yet.</p>
                </div>
                <button
                  onClick={() => {
                    setDetailsModalOpen(false);
                    openAssignModal(selectedRequest);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-md shadow-red-600/20"
                >
                  Dispatch Staff Now
                </button>
              </div>
            )}

            {/* Quick Status Advance */}
            <div>
              <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2">Advance Request Status</h4>
              <div className="flex flex-wrap gap-2">
                {['Received', 'Assigned', 'In Progress', 'Completed'].map((st) => (
                  <button
                    key={st}
                    onClick={() => handleUpdateStatus(selectedRequest.request.id, st)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-red-600 hover:text-white text-slate-700 rounded-xl text-xs font-extrabold transition-colors"
                  >
                    Mark {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Permanent Deletion Bar */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">Administrative Record Controls</span>
              <button
                type="button"
                onClick={() => handleDeleteRequest(selectedRequest.request || selectedRequest)}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Ticket</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
