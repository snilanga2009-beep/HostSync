import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Modal } from '../../components/common/Modal';
import { StaffDispatchModal } from '../../components/common/StaffDispatchModal';
import {
  Bell,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  UserCheck,
  Search,
  PlusCircle,
  PhoneCall,
  Loader2,
  BedDouble,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  DoorClosed,
  ChevronRight,
  Filter,
  User,
  Trash2
} from 'lucide-react';

interface Room {
  id: string;
  room_number: string;
  floor: number;
  room_type: string;
  status: 'vacant' | 'occupied' | 'cleaning' | 'maintenance';
}

interface FrontOfficeRequest {
  id: string;
  ticketType: 'maintenance' | 'service';
  roomNumber: string;
  guestName?: string;
  category: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
  createdAt: string;
  assignedStaffName?: string;
  assignedStaffId?: string;
  assignedStaffDepartment?: string;
}

interface StaffOption {
  id: string;
  name: string;
  department: string;
  job_title: string;
  status: string;
}

export const FrontOfficePage: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [requests, setRequests] = useState<FrontOfficeRequest[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [requestFilter, setRequestFilter] = useState<'all' | 'pending' | 'in_progress' | 'urgent'>('all');
  const [roomFilter, setRoomFilter] = useState<'all' | 'vacant' | 'occupied' | 'cleaning' | 'maintenance'>('all');
  const [searchRoom, setSearchRoom] = useState('');

  // Modals
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<FrontOfficeRequest | null>(null);

  // Quick Ticket Modal
  const [quickModalOpen, setQuickModalOpen] = useState(false);
  const [ticketType, setTicketType] = useState<'service' | 'maintenance'>('service');
  const [selectedRoomNumber, setSelectedRoomNumber] = useState('');
  const [guestName, setGuestName] = useState('');
  const [category, setCategory] = useState('Amenities');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [description, setDescription] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);

  const loadData = async () => {
    try {
      const [roomsRes, maintRes, serviceRes, staffRes] = await Promise.all([
        api.get<{ rooms: Room[] }>('/rooms'),
        api.get<{ requests: any[] }>('/requests'),
        api.get<{ services?: any[]; requests?: any[] }>('/requests/services/list'),
        api.get<{ staff: StaffOption[] }>('/staff')
      ]);

      setRooms(roomsRes.rooms || []);
      setStaffList(staffRes.staff || []);

      const combined: FrontOfficeRequest[] = [];

      (maintRes.requests || []).forEach((m: any) => {
        combined.push({
          id: m.id,
          ticketType: 'maintenance',
          roomNumber: m.room_number || m.roomNumber || 'Unknown',
          guestName: m.guest_name || 'Guest',
          category: m.category || 'Maintenance',
          description: m.description || m.reported_items_summary || m.issue || '',
          priority: (m.priority?.toLowerCase() || 'medium') as any,
          status: m.status || 'Submitted',
          createdAt: m.created_at || new Date().toISOString(),
          assignedStaffName: m.assigned_staff_name || m.staff_name,
          assignedStaffId: m.staff_profile_id || m.assigned_to_staff_id,
          assignedStaffDepartment: m.assigned_staff_title || 'Maintenance'
        });
      });

      const serviceList = serviceRes.services || serviceRes.requests || [];
      serviceList.forEach((s: any) => {
        combined.push({
          id: s.id,
          ticketType: 'service',
          roomNumber: s.room_number || s.roomNumber || 'Unknown',
          guestName: s.guest_name || 'Guest',
          category: s.service_type || s.category || 'Guest Service',
          description: s.notes || s.special_instructions || s.description || '',
          priority: (s.priority?.toLowerCase() || 'medium') as any,
          status: s.status || 'Submitted',
          createdAt: s.created_at || new Date().toISOString(),
          assignedStaffName: s.assigned_staff_name,
          assignedStaffId: s.assigned_to_staff_id,
          assignedStaffDepartment: 'Guest Services'
        });
      });

      // Sort newest first
      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRequests(combined);
    } catch (err) {
      console.error('Error loading front office data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
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

  const handleOpenDispatch = (req: FrontOfficeRequest) => {
    setSelectedRequest(req);
    setDispatchModalOpen(true);
  };

  const handleDeleteFrontOfficeRequest = async (req: FrontOfficeRequest) => {
    if (!window.confirm(`Are you sure you want to delete this ${req.ticketType} ticket for Room ${req.roomNumber}? This cannot be undone.`)) {
      return;
    }

    try {
      if (req.ticketType === 'service') {
        await api.delete(`/requests/services/${req.id}`);
      } else {
        await api.delete(`/requests/${req.id}`);
      }
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete ticket');
    }
  };

  const handleCreateQuickTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomNumber) {
      alert('Please select a room.');
      return;
    }

    setSubmittingTicket(true);
    try {
      const room = rooms.find(r => r.room_number === selectedRoomNumber);
      if (ticketType === 'maintenance') {
        await api.post('/requests', {
          room_id: room ? room.id : undefined,
          room_number: selectedRoomNumber,
          category,
          priority,
          description,
          guest_name: guestName || 'Walk-in / Phone'
        });
      } else {
        await api.post('/requests/services', {
          room_id: room ? room.id : undefined,
          room_number: selectedRoomNumber,
          service_type: category,
          priority,
          special_instructions: description,
          guest_name: guestName || 'Walk-in / Phone'
        });
      }

      setQuickModalOpen(false);
      setSelectedRoomNumber('');
      setGuestName('');
      setDescription('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to log request.');
    } finally {
      setSubmittingTicket(false);
    }
  };

  const filteredRequests = requests.filter(r => {
    const s = (r.status || '').toLowerCase();
    const p = (r.priority || '').toLowerCase();
    if (requestFilter === 'pending') return s === 'pending' || s === 'submitted';
    if (requestFilter === 'in_progress') return s === 'in_progress' || s === 'in progress' || s === 'assigned';
    if (requestFilter === 'urgent') return p === 'urgent' || p === 'high' || p === 'emergency';
    return true;
  });

  const filteredRooms = rooms.filter(r => {
    const matchesFilter = roomFilter === 'all' || r.status === roomFilter;
    const matchesSearch = !searchRoom || r.room_number.includes(searchRoom);
    return matchesFilter && matchesSearch;
  });

  // Room status counts
  const roomCounts = {
    total: rooms.length,
    vacant: rooms.filter(r => r.status === 'vacant').length,
    occupied: rooms.filter(r => r.status === 'occupied').length,
    cleaning: rooms.filter(r => r.status === 'cleaning').length,
    maintenance: rooms.filter(r => r.status === 'maintenance').length
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const urgentCount = requests.filter(r => (r.priority === 'urgent' || r.priority === 'high') && r.status !== 'completed').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Top Console Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Front Office Operations Console</h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
              Live Desk
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time incoming guest requests, rapid staff dispatch, and room readiness glance
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setRefreshing(true);
              loadData();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-red-600' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => {
              setTicketType('service');
              setQuickModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all active:scale-95"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Log Guest Call / Walk-In</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">Total Rooms</span>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{roomCounts.total}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <BedDouble className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-emerald-600">Clean / Vacant</span>
            <p className="text-2xl font-black text-emerald-600 mt-0.5">{roomCounts.vacant}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-blue-600">Occupied</span>
            <p className="text-2xl font-black text-blue-600 mt-0.5">{roomCounts.occupied}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-amber-600">Cleaning In-Prog</span>
            <p className="text-2xl font-black text-amber-600 mt-0.5">{roomCounts.cleaning}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <span className="text-[10px] font-bold uppercase text-rose-600">Urgent Attention</span>
            <p className="text-2xl font-black text-rose-600 mt-0.5">{urgentCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Operations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Request Queue (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Incoming Guest Request Queue</h3>
                  <p className="text-[11px] text-slate-500">Live feed from room QR codes & guest web app</p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {pendingCount} Pending
              </span>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 pt-3 pb-2 overflow-x-auto">
              <button
                onClick={() => setRequestFilter('all')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                  requestFilter === 'all' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Requests ({requests.length})
              </button>
              <button
                onClick={() => setRequestFilter('urgent')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                  requestFilter === 'urgent' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Urgent & High ({urgentCount})
              </button>
              <button
                onClick={() => setRequestFilter('pending')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                  requestFilter === 'pending' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Pending ({pendingCount})
              </button>
              <button
                onClick={() => setRequestFilter('in_progress')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                  requestFilter === 'in_progress' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                In Progress
              </button>
            </div>

            {/* Requests List */}
            {filteredRequests.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
                <p className="text-xs font-bold text-slate-600">All caught up!</p>
                <p className="text-[11px] mt-0.5">No active requests matching this filter</p>
              </div>
            ) : (
              <div className="space-y-3 mt-3 max-h-[520px] overflow-y-auto pr-1">
                {filteredRequests.map((req) => (
                  <div
                    key={`${req.ticketType}-${req.id}`}
                    className="p-3.5 rounded-2xl border border-slate-200 hover:border-red-200 hover:bg-red-50/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs bg-white"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-900 text-white font-mono font-black text-xs">
                          Room {req.roomNumber}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          req.priority === 'urgent'
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : req.priority === 'high'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {req.priority}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400">
                          {req.ticketType === 'maintenance' ? 'Maintenance' : 'Service'}
                        </span>
                      </div>

                      <p className="text-xs font-bold text-slate-800 truncate">
                        {req.category}: {req.description}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span>Guest: {req.guestName || 'In-Room Guest'}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {req.assignedStaffName && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <UserCheck className="w-3 h-3" />
                              {req.assignedStaffName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleOpenDispatch(req)}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[11px] font-bold shadow-xs transition-all flex items-center gap-1.5"
                      >
                        <Send className="w-3 h-3" />
                        {req.assignedStaffName ? 'Reassign' : 'Dispatch'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteFrontOfficeRequest(req)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors"
                        title="Delete Ticket"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Room Readiness Matrix (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
                  <DoorClosed className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Room Status Matrix</h3>
                  <p className="text-[11px] text-slate-500">Live inventory glance for front desk reception</p>
                </div>
              </div>
              <button
                onClick={() => setRoomFilter('all')}
                className="text-[10px] font-bold text-red-600 hover:underline px-2 py-1 rounded-lg"
              >
                Show All ({rooms.length})
              </button>
            </div>

            {/* Room Search */}
            <div className="relative mt-3">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Find room number (e.g. 101, 103)..."
                value={searchRoom}
                onChange={(e) => setSearchRoom(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            {/* Room Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-3.5 max-h-[440px] overflow-y-auto pr-1">
              {filteredRooms.map((r) => {
                let badgeBg = 'bg-emerald-50 border-emerald-200 text-emerald-800';
                let statusDot = 'bg-emerald-500';
                if (r.status === 'occupied') {
                  badgeBg = 'bg-blue-50 border-blue-200 text-blue-800';
                  statusDot = 'bg-blue-500';
                } else if (r.status === 'maintenance') {
                  badgeBg = 'bg-rose-50 border-rose-200 text-rose-800';
                  statusDot = 'bg-rose-500';
                } else if (r.status === 'cleaning') {
                  badgeBg = 'bg-amber-50 border-amber-200 text-amber-800';
                  statusDot = 'bg-amber-500';
                }

                return (
                  <div
                    key={r.id}
                    onClick={() => {
                      setSelectedRoomNumber(r.room_number);
                      setQuickModalOpen(true);
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer hover:shadow-md ${badgeBg}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-black tracking-tight">{r.room_number}</span>
                      <span className={`w-2 h-2 rounded-full ${statusDot}`} />
                    </div>
                    <p className="text-[10px] font-semibold truncate mt-0.5 opacity-90">{r.room_type}</p>
                    <span className="text-[9px] font-extrabold uppercase mt-1 inline-block">
                      {r.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Log Modal */}
      <Modal
        isOpen={quickModalOpen}
        onClose={() => setQuickModalOpen(false)}
        title="Log Guest Call or Walk-In Request"
        subtitle="Quickly dispatch guest issues or amenities straight from front desk"
      >
        <form onSubmit={handleCreateQuickTicket} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Room Number *</label>
              <select
                required
                value={selectedRoomNumber}
                onChange={(e) => setSelectedRoomNumber(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white font-bold focus:ring-2 focus:ring-red-500 focus:outline-none"
              >
                <option value="">Select Room...</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.room_number}>
                    Room {r.room_number} ({r.room_type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Guest Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Mr. Robert Smith"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Department / Request Type</label>
              <select
                value={ticketType}
                onChange={(e) => setTicketType(e.target.value as any)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white font-bold focus:ring-2 focus:ring-red-500 focus:outline-none"
              >
                <option value="service">Guest Service & Amenities</option>
                <option value="maintenance">Maintenance & Engineering</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white font-bold focus:ring-2 focus:ring-red-500 focus:outline-none"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Standard / Medium</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent Attention</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Issue Category *</label>
            <input
              type="text"
              required
              placeholder={ticketType === 'maintenance' ? 'e.g. AC Not Cooling, Plumbing Leak' : 'e.g. Extra Towels, Pillows, Luggage Assistance'}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Details & Special Instructions</label>
            <textarea
              rows={3}
              placeholder="Provide exact details or guest instructions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none resize-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setQuickModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingTicket}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all flex items-center gap-2"
            >
              {submittingTicket ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              Dispatch Request
            </button>
          </div>
        </form>
      </Modal>

      {/* Rich Visual Dispatch Staff Modal */}
      <StaffDispatchModal
        isOpen={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        request={selectedRequest ? {
          id: selectedRequest.id,
          roomNumber: selectedRequest.roomNumber,
          category: selectedRequest.category,
          description: selectedRequest.description,
          priority: selectedRequest.priority,
          ticketType: selectedRequest.ticketType,
          guestName: selectedRequest.guestName
        } : null}
        onDispatchSuccess={loadData}
      />
    </div>
  );
};
