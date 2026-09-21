import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Modal } from './Modal';
import {
  Send,
  Loader2,
  Search,
  CheckCircle2,
  User,
  Wrench,
  Sparkles,
  Phone,
  Briefcase,
  AlertTriangle,
  Clock,
  ShieldAlert,
  BellRing
} from 'lucide-react';

export interface DispatchableRequest {
  id: string;
  roomNumber: string;
  category?: string;
  description?: string;
  priority?: string;
  ticketType?: 'maintenance' | 'service';
  guestName?: string;
}

interface StaffProfileItem {
  id: string;
  full_name: string;
  name?: string;
  department: string;
  job_title: string;
  avatar_url?: string;
  phone?: string;
  status: string;
  active_tasks_count?: number;
}

interface StaffDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: DispatchableRequest | null;
  onDispatchSuccess: () => void;
}

export const StaffDispatchModal: React.FC<StaffDispatchModalProps> = ({
  isOpen,
  onClose,
  request,
  onDispatchSuccess
}) => {
  const [staffList, setStaffList] = useState<StaffProfileItem[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [dispatchNotes, setDispatchNotes] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [loadingStaff, setLoadingStaff] = useState<boolean>(false);
  const [dispatching, setDispatching] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadStaff();
      setSelectedStaffId('');
      setDispatchNotes('');
      setSearchQuery('');
      setDepartmentFilter('all');
      setErrorMessage(null);
    }
  }, [isOpen, request?.id]);

  const loadStaff = async () => {
    setLoadingStaff(true);
    try {
      const res = await api.get<{ staff: any[] }>('/staff');
      const formatted = (res.staff || []).map((s: any) => ({
        id: s.id,
        full_name: s.full_name || s.name || 'Hotel Staff',
        department: s.department || 'Operations',
        job_title: s.job_title || 'Staff',
        avatar_url: s.avatar_url || '',
        phone: s.phone || '',
        status: s.status || 'available',
        active_tasks_count: s.active_tasks_count || 0
      }));
      setStaffList(formatted);
    } catch (e: any) {
      console.error('Failed to load staff for dispatch', e);
    } finally {
      setLoadingStaff(false);
    }
  };

  if (!isOpen || !request) return null;

  const isEmergency =
    request.priority?.toLowerCase() === 'emergency' ||
    request.priority?.toLowerCase() === 'urgent' ||
    request.priority?.toLowerCase() === 'high';

  // Filter staff by search and department
  const filteredStaff = staffList.filter((s) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.job_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.department.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDept =
      departmentFilter === 'all' ||
      s.department.toLowerCase() === departmentFilter.toLowerCase();

    return matchesSearch && matchesDept;
  });

  const selectedStaff = staffList.find((s) => s.id === selectedStaffId);

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!request || !selectedStaffId) return;

    setDispatching(true);
    setErrorMessage(null);
    try {
      // Unified backend handles both /requests/:id/assign and /requests/services/:id/assign
      const endpoint =
        request.ticketType === 'service'
          ? `/requests/services/${request.id}/assign`
          : `/requests/${request.id}/assign`;

      await api.post(endpoint, {
        staffId: selectedStaffId,
        staff_id: selectedStaffId,
        notes: dispatchNotes,
        sendNotification: true
      });

      onDispatchSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch staff member.');
    } finally {
      setDispatching(false);
    }
  };

  // Helper to determine if a staff member matches the request category
  const isRecommended = (staff: StaffProfileItem) => {
    const reqType = (request.ticketType || '').toLowerCase();
    const cat = (request.category || '').toLowerCase();
    const dept = staff.department.toLowerCase();

    if (reqType === 'maintenance' || cat.includes('ac') || cat.includes('plumb') || cat.includes('electric') || cat.includes('fix')) {
      return dept.includes('maintenance') || dept.includes('engineering');
    }
    if (cat.includes('towel') || cat.includes('clean') || cat.includes('linen') || cat.includes('housekeep')) {
      return dept.includes('housekeeping');
    }
    if (cat.includes('water') || cat.includes('food') || cat.includes('amenit') || cat.includes('room service')) {
      return dept.includes('room service') || dept.includes('hospitality');
    }
    return false;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Dispatch Staff to Room Request"
      subtitle={`Assign staff & send automated 1-click mobile job link for Room ${request.roomNumber}`}
      maxWidth="2xl"
    >
      <form onSubmit={handleDispatch} className="space-y-4">
        {/* Room & Issue Summary Card */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center shrink-0 shadow-sm">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">ROOM</span>
              <span className="text-lg font-black leading-none">{request.roomNumber}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900">{request.category || 'General Request'}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    isEmergency ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {request.priority || 'Normal'} Priority
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 max-w-md line-clamp-2">
                {request.description || 'Guest in-room request'}
              </p>
            </div>
          </div>

          {request.guestName && (
            <div className="text-right sm:border-l border-slate-200 sm:pl-3 shrink-0">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Guest</span>
              <span className="text-xs font-bold text-slate-800 flex items-center justify-end gap-1">
                <User className="w-3 h-3 text-slate-400" />
                {request.guestName}
              </span>
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Staff Selection Section */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span>Select Staff Member</span>
              <span className="text-red-500">*</span>
              <span className="text-[11px] font-normal text-slate-500">
                ({filteredStaff.length} available)
              </span>
            </label>

            {/* Department Filter Chips */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'All' },
                { id: 'maintenance', label: 'Maintenance' },
                { id: 'housekeeping', label: 'Housekeeping' },
                { id: 'room service', label: 'Room Service' }
              ].map((dept) => (
                <button
                  type="button"
                  key={dept.id}
                  onClick={() => setDepartmentFilter(dept.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                    departmentFilter === dept.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {dept.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Box */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff by name or job title..."
              className="w-full text-xs pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none bg-white"
            />
          </div>

          {/* Scrollable Staff Grid */}
          {loadingStaff ? (
            <div className="py-12 flex items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-red-600" />
              <span className="text-xs font-bold">Loading staff directory...</span>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs rounded-2xl border border-dashed border-slate-200">
              No staff members found matching "{searchQuery}".
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto p-1 pr-1.5 custom-scrollbar">
              {filteredStaff.map((staff) => {
                const isSelected = selectedStaffId === staff.id;
                const recommended = isRecommended(staff);
                const isAvailable = staff.status === 'available';
                const avatarSrc =
                  staff.avatar_url && staff.avatar_url.trim() !== ''
                    ? staff.avatar_url
                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.full_name)}&background=dc2626&color=fff&bold=true`;

                return (
                  <div
                    key={staff.id}
                    onClick={() => setSelectedStaffId(staff.id)}
                    className={`relative p-3 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-3.5 select-none ${
                      isSelected
                        ? 'border-red-600 bg-red-50/70 ring-4 ring-red-600/15 shadow-md'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 shadow-xs'
                    }`}
                  >
                    {/* Staff Image / Avatar */}
                    <div className="relative shrink-0">
                      <img
                        src={avatarSrc}
                        alt={staff.full_name}
                        className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-sm bg-slate-100"
                        onError={(e) => {
                          // Fallback to avatar generator if local image fails
                          (e.target as HTMLElement).setAttribute(
                            'src',
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.full_name)}&background=dc2626&color=fff&bold=true`
                          );
                        }}
                      />
                      {/* Availability status dot */}
                      <span
                        className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                          isAvailable ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        title={isAvailable ? 'Available' : 'Busy'}
                      />
                    </div>

                    {/* Staff Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-black text-slate-900 truncate leading-snug">
                          {staff.full_name}
                        </h4>
                        {recommended && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 font-extrabold whitespace-nowrap shrink-0">
                            ★ Match
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                        {staff.job_title}
                      </p>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-slate-600 px-2 py-0.5 rounded-md bg-slate-100 truncate">
                          {staff.department}
                        </span>
                        <span
                          className={`text-[10px] font-bold ${
                            isAvailable ? 'text-emerald-600' : 'text-amber-600'
                          }`}
                        >
                          {isAvailable ? 'Ready' : `Busy (${staff.active_tasks_count || 1})`}
                        </span>
                      </div>
                    </div>

                    {/* Checkmark indicator when selected */}
                    {isSelected && (
                      <div className="shrink-0 text-red-600">
                        <CheckCircle2 className="w-5 h-5 fill-red-600 text-white" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Staff Pill Bar */}
        {selectedStaff && (
          <div className="p-3 bg-red-50/60 border border-red-200 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={
                  selectedStaff.avatar_url ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedStaff.full_name)}&background=dc2626&color=fff`
                }
                alt={selectedStaff.full_name}
                className="w-8 h-8 rounded-lg object-cover border border-red-200 shrink-0"
              />
              <div className="truncate">
                <span className="text-[10px] font-bold uppercase text-red-600 block">Selected for dispatch:</span>
                <span className="font-black text-slate-900">{selectedStaff.full_name}</span>
                <span className="text-slate-500 text-[11px] ml-1">({selectedStaff.job_title})</span>
              </div>
            </div>

            <span className="text-[10px] font-extrabold px-2 py-1 rounded-md bg-white border border-red-200 text-red-700 shrink-0">
              1-Click Token Link
            </span>
          </div>
        )}

        {/* Instructions / Notes textarea */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Dispatch Instructions / Notes (Optional)
          </label>
          <textarea
            value={dispatchNotes}
            onChange={(e) => setDispatchNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Please bring replacement towels immediately, guest is waiting..."
            className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none bg-white"
          />
        </div>

        {/* Automated Mobile Dispatch Explanation */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-start gap-2">
          <Send className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-900 block">Instant SMS & WhatsApp Notification:</span>
            <span>
              The staff member receives a direct, secure mobile job link on their personal phone with zero app installation required.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={dispatching || !selectedStaffId}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-md shadow-red-600/30 transition-all flex items-center gap-2"
          >
            {dispatching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>
              {selectedStaff
                ? `Send Mobile Dispatch to ${selectedStaff.full_name.split(' ')[0]}`
                : 'Send Mobile Job Dispatch'}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
