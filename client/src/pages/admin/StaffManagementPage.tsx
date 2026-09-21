import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { StaffProfile } from '../../types';
import { Modal } from '../../components/common/Modal';
import {
  Users,
  Plus,
  Search,
  Star,
  Phone,
  Mail,
  Clock,
  HeartHandshake,
  Loader2,
  Camera,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Briefcase,
  Layers,
  Wrench,
  DollarSign,
  Calendar,
  Check,
  Send,
  Smartphone,
  MessageSquare,
  Trash2
} from 'lucide-react';

interface StaffTask {
  id: string;
  request_code: string;
  room_number: string;
  room_name?: string;
  building_name?: string;
  priority: string;
  status: string;
  description: string;
  created_at: string;
  assigned_at: string;
  items_summary?: string;
}

interface StaffTipSummary {
  summary: {
    today: number;
    week: number;
    month: number;
    total: number;
  };
  transactions: Array<{
    id: string;
    room_number: string;
    request_code?: string;
    amount: number;
    staff_amount: number;
    status: string;
    guest_name?: string;
    created_at: string;
  }>;
}

export const StaffManagementPage: React.FC = () => {
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [tasksModalOpen, setTasksModalOpen] = useState(false);
  const [tipsModalOpen, setTipsModalOpen] = useState(false);

  // Selected staff for viewing/editing
  const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);

  // Avatar upload loading state per staff card
  const [uploadingAvatarId, setUploadingAvatarId] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Tasks & Tips modal state
  const [staffTasks, setStaffTasks] = useState<StaffTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [staffTips, setStaffTips] = useState<StaffTipSummary | null>(null);
  const [loadingTips, setLoadingTips] = useState(false);

  // Add / Edit Form State
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('password123');
  const [formDepartment, setFormDepartment] = useState('Maintenance');
  const [formRole, setFormRole] = useState('Technician');
  const [formJobTitle, setFormJobTitle] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCountryCode, setFormCountryCode] = useState('+1');
  const [formWhatsappNumber, setFormWhatsappNumber] = useState('');
  const [formPreferredChannel, setFormPreferredChannel] = useState<'whatsapp' | 'sms' | 'both'>('whatsapp');
  const [formSmsEnabled, setFormSmsEnabled] = useState(true);
  const [formWhatsappEnabled, setFormWhatsappEnabled] = useState(true);
  const [formFallbackEnabled, setFormFallbackEnabled] = useState(true);
  const [testingNotif, setTestingNotif] = useState(false);
  const [formWorkingHours, setFormWorkingHours] = useState('08:00 - 17:00');
  const [formStatus, setFormStatus] = useState<'available' | 'busy' | 'off_duty'>('available');
  const [formAvatarUrl, setFormAvatarUrl] = useState('');
  const [formAvatarFile, setFormAvatarFile] = useState<File | null>(null);
  const [formAvatarPreview, setFormAvatarPreview] = useState('');
  const [saving, setSaving] = useState(false);

  const handleTestNotification = async (channel: 'sms' | 'whatsapp') => {
    if (!selectedStaff) return;
    setTestingNotif(true);
    try {
      const res = await api.post<any>('/notifications/test', {
        staffId: selectedStaff.id,
        channel,
        phone: formPhone ? `${formCountryCode}${formPhone.replace(/[^0-9]/g, '')}` : undefined
      });
      alert(`Test ${channel.toUpperCase()} sent!\nStatus: ${res.result?.status}\nProvider: ${res.result?.provider}`);
    } catch (err: any) {
      alert(err.message || `Failed to send test ${channel}`);
    } finally {
      setTestingNotif(false);
    }
  };

  const loadStaff = async () => {
    try {
      const res = await api.get<{ staff: StaffProfile[] }>('/staff');
      setStaffList(res.staff);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  // Quick direct avatar upload from staff card
  const handleDirectAvatarUpload = async (staffId: string, file: File) => {
    setUploadingAvatarId(staffId);
    try {
      const formData = new FormData();
      formData.append('photo', file);

      const res = await api.post<{ success: boolean; avatar_url: string; staff: StaffProfile }>(
        `/staff/${staffId}/avatar`,
        formData
      );

      // Update state locally
      setStaffList(prev =>
        prev.map(s => (s.id === staffId ? { ...s, avatar_url: res.avatar_url } : s))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to upload profile image.');
    } finally {
      setUploadingAvatarId(null);
    }
  };

  // Quick toggle status on card
  const handleToggleStatus = async (staffId: string, currentStatus: string) => {
    const nextStatusMap: Record<string, 'available' | 'busy' | 'off_duty'> = {
      available: 'busy',
      busy: 'off_duty',
      off_duty: 'available'
    };
    const next = nextStatusMap[currentStatus] || 'available';

    try {
      await api.put(`/staff/${staffId}`, { status: next });
      setStaffList(prev => prev.map(s => (s.id === staffId ? { ...s, status: next } : s)));
    } catch (err: any) {
      console.error('Failed to change status', err);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (staff: StaffProfile) => {
    setSelectedStaff(staff);
    setFormFullName(staff.full_name || '');
    setFormEmail(staff.email || '');
    setFormDepartment(staff.department || 'Maintenance');
    setFormRole(staff.role || 'Technician');
    setFormJobTitle(staff.job_title || '');
    setFormPhone(staff.phone || '');
    setFormCountryCode(staff.country_code || '+1');
    setFormWhatsappNumber(staff.whatsapp_number || staff.phone || '');
    setFormPreferredChannel((staff.preferred_channel as any) || 'whatsapp');
    setFormSmsEnabled(staff.sms_enabled !== undefined ? Boolean(staff.sms_enabled) : true);
    setFormWhatsappEnabled(staff.whatsapp_enabled !== undefined ? Boolean(staff.whatsapp_enabled) : true);
    setFormFallbackEnabled(staff.fallback_enabled !== undefined ? Boolean(staff.fallback_enabled) : true);
    setFormWorkingHours(staff.working_hours || '08:00 - 17:00');
    setFormStatus(staff.status || 'available');
    setFormAvatarUrl(staff.avatar_url || '');
    setFormAvatarPreview(staff.avatar_url || '');
    setFormAvatarFile(null);
    setEditModalOpen(true);
  };

  // Save Edit Staff
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setSaving(true);
    try {
      let finalAvatarUrl = formAvatarUrl;

      // If a new avatar file was chosen in the modal, upload it first
      if (formAvatarFile) {
        const uploadRes = await api.uploadFile(formAvatarFile);
        if (uploadRes.success) {
          finalAvatarUrl = uploadRes.url;
        }
      }

      await api.put(`/staff/${selectedStaff.id}`, {
        full_name: formFullName,
        email: formEmail,
        department: formDepartment,
        role: formRole,
        job_title: formJobTitle,
        phone: formPhone,
        country_code: formCountryCode,
        whatsapp_number: formWhatsappNumber,
        preferred_channel: formPreferredChannel,
        sms_enabled: formSmsEnabled ? 1 : 0,
        whatsapp_enabled: formWhatsappEnabled ? 1 : 0,
        fallback_enabled: formFallbackEnabled ? 1 : 0,
        working_hours: formWorkingHours,
        status: formStatus,
        avatar_url: finalAvatarUrl
      });

      setEditModalOpen(false);
      await loadStaff();
    } catch (err: any) {
      alert(err.message || 'Failed to update staff profile.');
    } finally {
      setSaving(false);
    }
  };

  // Delete Staff Member
  const handleDeleteStaff = async (staff: StaffProfile) => {
    if (!window.confirm(`Are you sure you want to permanently delete staff profile "${staff.full_name}" (${staff.employee_id})? This will unassign all tasks, remove job links, and delete the staff record. This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/staff/${staff.id}`);
      if (editModalOpen && selectedStaff?.id === staff.id) {
        setEditModalOpen(false);
        setSelectedStaff(null);
      }
      await loadStaff();
    } catch (err: any) {
      alert(err.message || 'Failed to delete staff profile');
    }
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setFormFullName('');
    setFormEmail('');
    setFormPassword('password123');
    setFormDepartment('Maintenance');
    setFormRole('Technician');
    setFormJobTitle('');
    setFormPhone('');
    setFormCountryCode('+1');
    setFormWhatsappNumber('');
    setFormPreferredChannel('whatsapp');
    setFormSmsEnabled(true);
    setFormWhatsappEnabled(true);
    setFormFallbackEnabled(true);
    setFormWorkingHours('08:00 - 17:00');
    setFormStatus('available');
    setFormAvatarUrl('');
    setFormAvatarFile(null);
    setFormAvatarPreview('');
    setAddModalOpen(true);
  };

  // Create New Staff
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let finalAvatarUrl = formAvatarUrl;
      if (formAvatarFile) {
        const uploadRes = await api.uploadFile(formAvatarFile);
        if (uploadRes.success) {
          finalAvatarUrl = uploadRes.url;
        }
      }

      await api.post('/staff', {
        full_name: formFullName,
        email: formEmail,
        password: formPassword,
        role: formRole,
        department: formDepartment,
        job_title: formJobTitle || 'Staff Specialist',
        phone: formPhone,
        country_code: formCountryCode,
        whatsapp_number: formWhatsappNumber || formPhone,
        preferred_channel: formPreferredChannel,
        sms_enabled: formSmsEnabled ? 1 : 0,
        whatsapp_enabled: formWhatsappEnabled ? 1 : 0,
        fallback_enabled: formFallbackEnabled ? 1 : 0,
        working_hours: formWorkingHours,
        avatar_url: finalAvatarUrl
      });

      setAddModalOpen(false);
      await loadStaff();
    } catch (e: any) {
      alert(e.message || 'Failed to add staff');
    } finally {
      setSaving(false);
    }
  };

  // View Active Tasks Modal
  const handleViewTasks = async (staff: StaffProfile) => {
    setSelectedStaff(staff);
    setTasksModalOpen(true);
    setLoadingTasks(true);
    try {
      const res = await api.get<{ tasks: StaffTask[] }>(`/staff/${staff.id}/tasks`);
      setStaffTasks(res.tasks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTasks(false);
    }
  };

  // View Gratuity Records Modal
  const handleViewTips = async (staff: StaffProfile) => {
    setSelectedStaff(staff);
    setTipsModalOpen(true);
    setLoadingTips(true);
    try {
      const res = await api.get<StaffTipSummary>(`/staff/${staff.id}/tips`);
      setStaffTips(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTips(false);
    }
  };

  // Filter staff
  const departments = ['All', 'Maintenance', 'Room Service', 'Housekeeping', 'Front Desk'];

  const filteredStaff = staffList.filter((s) => {
    const matchesDept = selectedDept === 'All' || s.department === selectedDept;
    const matchesStatus = selectedStatus === 'All' || s.status === selectedStatus;
    const matchesQuery =
      !searchQuery ||
      s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.employee_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.job_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesStatus && matchesQuery;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-600" />
            Staff & Technician Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Profiles, departments, active assignments, and guest gratuity records
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-600/20 transition-all flex items-center gap-1.5 self-start sm:self-auto active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add Staff Member
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Department Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 ${
                selectedDept === dept
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>

        {/* Search & Status Filters */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff, ID, title..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs py-2 px-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-semibold focus:outline-none"
          >
            <option value="All">All Status</option>
            <option value="available">Available</option>
            <option value="busy">Busy</option>
            <option value="off_duty">Off Duty</option>
          </select>
        </div>
      </div>

      {/* Staff Grid Cards */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500 mb-2" />
          <p className="text-xs font-medium">Loading staff profiles...</p>
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-700">No staff members found</h4>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your department or search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map((st) => (
            <div
              key={st.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-soft hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                {/* Header: Photo, Name, Rating */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3.5">
                    {/* Interactive Profile Photo with Upload Trigger */}
                    <div className="relative group/avatar shrink-0">
                      <img
                        src={
                          st.avatar_url ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            st.full_name || 'Staff'
                          )}&background=0284c7&color=fff`
                        }
                        alt={st.full_name}
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-white shadow-md group-hover:scale-[1.02] transition-transform"
                      />

                      {/* Loading spinner during avatar upload */}
                      {uploadingAvatarId === st.id ? (
                        <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center text-white">
                          <Loader2 className="w-5 h-5 animate-spin" />
                        </div>
                      ) : (
                        /* Camera upload overlay badge */
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[st.id]?.click()}
                          title="Click to change profile picture"
                          className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-sm hover:scale-110 transition-all"
                        >
                          <Camera className="w-3 h-3" />
                        </button>
                      )}

                      {/* Hidden file input for this staff member */}
                      <input
                        type="file"
                        accept="image/*"
                        ref={(el) => (fileInputRefs.current[st.id] = el)}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleDirectAvatarUpload(st.id, file);
                          }
                        }}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-bold text-slate-900 truncate">{st.full_name}</h4>
                        <button
                          onClick={() => handleOpenEdit(st)}
                          title="Edit staff profile"
                          className="text-slate-400 hover:text-brand-600 p-0.5 rounded transition-colors"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteStaff(st)}
                          title="Delete staff profile"
                          className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 truncate font-medium">{st.job_title}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {st.employee_id}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-50 text-brand-700">
                          {st.department}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Rating & Status Quick Toggle */}
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 text-amber-800 text-xs font-bold shadow-xs">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{st.rating?.toFixed(1) || '5.0'}</span>
                    </div>

                    <button
                      onClick={() => handleToggleStatus(st.id, st.status || 'available')}
                      title="Click to toggle status (Available -> Busy -> Off Duty)"
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider transition-all border ${
                        st.status === 'available'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : st.status === 'busy'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      ● {st.status || 'available'}
                    </button>
                  </div>
                </div>

                {/* Contact & Shift Info */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{st.email}</span>
                  </div>
                  {st.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{st.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{st.working_hours || '08:00 - 17:00'}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Assignments & Gratuity */}
              <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() => handleViewTasks(st)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-brand-50 hover:text-brand-700 text-slate-700 font-bold border border-slate-200/80 transition-colors flex items-center justify-between group/btn"
                >
                  <span className="flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-brand-600" />
                    Tasks ({st.active_tasks_count || 0})
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover/btn:translate-x-0.5 transition-transform" />
                </button>

                <button
                  onClick={() => handleViewTips(st)}
                  className="px-2.5 py-1.5 rounded-xl bg-rose-50/50 hover:bg-rose-100/70 text-rose-700 font-bold border border-rose-200/60 transition-colors flex items-center justify-between group/btn"
                >
                  <span className="flex items-center gap-1.5">
                    <HeartHandshake className="w-3.5 h-3.5 text-rose-600" />
                    ${(st.total_tips_earned || 0).toFixed(2)}
                  </span>
                  <ChevronRight className="w-3 h-3 text-rose-400 group-hover/btn:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ================= EDIT STAFF MODAL ================= */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit Profile: ${selectedStaff?.full_name || 'Staff'}`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {/* Avatar Photo Section */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Profile Photo
            </label>
            <div className="flex items-center gap-4">
              <img
                src={
                  formAvatarPreview ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    formFullName || 'Staff'
                  )}&background=0284c7&color=fff`
                }
                alt="Preview"
                className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md bg-white"
              />
              <div className="flex-1 space-y-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 cursor-pointer transition-colors shadow-xs">
                  <Camera className="w-3.5 h-3.5 text-brand-600" />
                  <span>Choose Photo File</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setFormAvatarFile(file);
                        setFormAvatarPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                </label>
                <div className="text-[11px] text-slate-500">Or enter image URL below:</div>
                <input
                  type="text"
                  value={formAvatarUrl}
                  onChange={(e) => {
                    setFormAvatarUrl(e.target.value);
                    if (!formAvatarFile) setFormAvatarPreview(e.target.value);
                  }}
                  placeholder="https://images.unsplash.com/... or /uploads/..."
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Department
              </label>
              <select
                value={formDepartment}
                onChange={(e) => setFormDepartment(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none font-semibold text-slate-800"
              >
                <option value="Maintenance">Maintenance</option>
                <option value="Room Service">Room Service</option>
                <option value="Housekeeping">Housekeeping</option>
                <option value="Front Desk">Front Desk</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Role
              </label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none font-semibold text-slate-800"
              >
                <option value="Technician">Technician</option>
                <option value="Room Service Boy">Room Service Boy</option>
                <option value="Housekeeping Staff">Housekeeping Staff</option>
                <option value="Front Office Staff">Front Office Staff</option>
                <option value="Maintenance Manager">Maintenance Manager</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Job Title
              </label>
              <input
                type="text"
                value={formJobTitle}
                onChange={(e) => setFormJobTitle(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Duty Status
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as any)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none font-semibold text-slate-800"
              >
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="off_duty">Off Duty</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Working Shift / Hours
            </label>
            <input
              type="text"
              value={formWorkingHours}
              onChange={(e) => setFormWorkingHours(e.target.value)}
              placeholder="08:00 - 17:00"
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          {/* Mobile Job Notification Preferences */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-brand-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Mobile Job Notification Settings
                </h4>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleTestNotification('sms')}
                  disabled={testingNotif || !formPhone}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[11px] font-bold shadow-xs transition-colors disabled:opacity-40 flex items-center gap-1"
                >
                  <Send className="w-3 h-3 text-sky-600" /> Ping SMS
                </button>
                <button
                  type="button"
                  onClick={() => handleTestNotification('whatsapp')}
                  disabled={testingNotif || (!formWhatsappNumber && !formPhone)}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-[11px] font-bold shadow-xs transition-colors disabled:opacity-40 flex items-center gap-1"
                >
                  <MessageSquare className="w-3 h-3 text-emerald-600" /> Ping WhatsApp
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Mobile Phone Number
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={formCountryCode}
                    onChange={(e) => setFormCountryCode(e.target.value)}
                    className="w-20 text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none font-bold text-slate-700"
                  >
                    <option value="+1">+1 (US)</option>
                    <option value="+94">+94 (LK)</option>
                    <option value="+44">+44 (UK)</option>
                    <option value="+971">+971 (AE)</option>
                    <option value="+61">+61 (AU)</option>
                    <option value="+91">+91 (IN)</option>
                    <option value="+49">+49 (DE)</option>
                    <option value="+33">+33 (FR)</option>
                  </select>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="305-555-0199"
                    className="flex-1 text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    WhatsApp Number
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormWhatsappNumber(formPhone)}
                    className="text-[10px] font-bold text-brand-600 hover:underline"
                  >
                    Same as Phone
                  </button>
                </div>
                <input
                  type="tel"
                  value={formWhatsappNumber}
                  onChange={(e) => setFormWhatsappNumber(e.target.value)}
                  placeholder="e.g. +13055550199"
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Preferred Channel & Toggles */}
            <div className="pt-2 border-t border-slate-200/70 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Preferred Dispatch Channel
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                    { id: 'sms', label: 'SMS', icon: Smartphone },
                    { id: 'both', label: 'Both', icon: Send }
                  ].map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setFormPreferredChannel(ch.id as any)}
                      className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                        formPreferredChannel === ch.id
                          ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <ch.icon className="w-3 h-3" /> {ch.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 pt-2 sm:pt-0">
                <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formFallbackEnabled}
                    onChange={(e) => setFormFallbackEnabled(e.target.checked)}
                    className="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Auto SMS Fallback if WhatsApp fails</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formWhatsappEnabled}
                    onChange={(e) => setFormWhatsappEnabled(e.target.checked)}
                    className="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Allow WhatsApp job alerts</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formSmsEnabled}
                    onChange={(e) => setFormSmsEnabled(e.target.checked)}
                    className="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Allow SMS job alerts</span>
                </label>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => selectedStaff && handleDeleteStaff(selectedStaff)}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Staff Profile</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save Profile Changes
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* ================= ADD STAFF MODAL ================= */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Staff Member">
        <form onSubmit={handleCreateStaff} className="space-y-4">
          {/* Avatar Photo Section */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Profile Photo (Optional)
            </label>
            <div className="flex items-center gap-4">
              <img
                src={
                  formAvatarPreview ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    formFullName || 'Staff'
                  )}&background=0284c7&color=fff`
                }
                alt="Preview"
                className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md bg-white"
              />
              <div className="flex-1 space-y-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 cursor-pointer transition-colors shadow-xs">
                  <Camera className="w-3.5 h-3.5 text-brand-600" />
                  <span>Choose Photo File</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setFormAvatarFile(file);
                        setFormAvatarPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                </label>
                <div className="text-[11px] text-slate-500">Or enter image URL:</div>
                <input
                  type="text"
                  value={formAvatarUrl}
                  onChange={(e) => {
                    setFormAvatarUrl(e.target.value);
                    if (!formAvatarFile) setFormAvatarPreview(e.target.value);
                  }}
                  placeholder="https://images.unsplash.com/... or /uploads/..."
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
                placeholder="e.g. David Fernando"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="david@oceanpearl.com"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Temporary Password *
              </label>
              <input
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Working Shift
              </label>
              <input
                type="text"
                value={formWorkingHours}
                onChange={(e) => setFormWorkingHours(e.target.value)}
                placeholder="08:00 - 17:00"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Mobile Job Notification Preferences */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-brand-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Mobile Job Notification Settings
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Mobile Phone Number
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={formCountryCode}
                    onChange={(e) => setFormCountryCode(e.target.value)}
                    className="w-20 text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none font-bold text-slate-700"
                  >
                    <option value="+1">+1 (US)</option>
                    <option value="+94">+94 (LK)</option>
                    <option value="+44">+44 (UK)</option>
                    <option value="+971">+971 (AE)</option>
                    <option value="+61">+61 (AU)</option>
                    <option value="+91">+91 (IN)</option>
                    <option value="+49">+49 (DE)</option>
                    <option value="+33">+33 (FR)</option>
                  </select>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="305-555-0199"
                    className="flex-1 text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    WhatsApp Number
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormWhatsappNumber(formPhone)}
                    className="text-[10px] font-bold text-brand-600 hover:underline"
                  >
                    Same as Phone
                  </button>
                </div>
                <input
                  type="tel"
                  value={formWhatsappNumber}
                  onChange={(e) => setFormWhatsappNumber(e.target.value)}
                  placeholder="e.g. +13055550199"
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Preferred Channel & Toggles */}
            <div className="pt-2 border-t border-slate-200/70 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Preferred Dispatch Channel
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                    { id: 'sms', label: 'SMS', icon: Smartphone },
                    { id: 'both', label: 'Both', icon: Send }
                  ].map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setFormPreferredChannel(ch.id as any)}
                      className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                        formPreferredChannel === ch.id
                          ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <ch.icon className="w-3 h-3" /> {ch.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 pt-2 sm:pt-0">
                <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formFallbackEnabled}
                    onChange={(e) => setFormFallbackEnabled(e.target.checked)}
                    className="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Auto SMS Fallback if WhatsApp fails</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formWhatsappEnabled}
                    onChange={(e) => setFormWhatsappEnabled(e.target.checked)}
                    className="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Allow WhatsApp job alerts</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formSmsEnabled}
                    onChange={(e) => setFormSmsEnabled(e.target.checked)}
                    className="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Allow SMS job alerts</span>
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Department
              </label>
              <select
                value={formDepartment}
                onChange={(e) => setFormDepartment(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none font-semibold text-slate-800"
              >
                <option value="Maintenance">Maintenance</option>
                <option value="Room Service">Room Service</option>
                <option value="Housekeeping">Housekeeping</option>
                <option value="Front Desk">Front Desk</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Role
              </label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none font-semibold text-slate-800"
              >
                <option value="Technician">Technician</option>
                <option value="Room Service Boy">Room Service Boy</option>
                <option value="Housekeeping Staff">Housekeeping Staff</option>
                <option value="Front Office Staff">Front Office Staff</option>
                <option value="Maintenance Manager">Maintenance Manager</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Job Title
              </label>
              <input
                type="text"
                value={formJobTitle}
                onChange={(e) => setFormJobTitle(e.target.value)}
                placeholder="e.g. Senior HVAC Technician"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Working Shift
              </label>
              <input
                type="text"
                value={formWorkingHours}
                onChange={(e) => setFormWorkingHours(e.target.value)}
                placeholder="08:00 - 17:00"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-1.5"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Staff Profile
          </button>
        </form>
      </Modal>

      {/* ================= ACTIVE TASKS MODAL ================= */}
      <Modal
        isOpen={tasksModalOpen}
        onClose={() => setTasksModalOpen(false)}
        title={`Active Assignments: ${selectedStaff?.full_name || 'Staff'}`}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div>
              <span className="font-bold text-slate-800">{selectedStaff?.job_title}</span>
              <span className="text-slate-400 mx-1.5">•</span>
              <span className="text-brand-600 font-semibold">{selectedStaff?.department}</span>
            </div>
            <span className="font-bold px-2 py-0.5 rounded bg-brand-100 text-brand-800 text-[11px]">
              {staffTasks.length} Assigned Task{staffTasks.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loadingTasks ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-brand-500 mx-auto mb-2" />
              <p className="text-xs">Loading assignments...</p>
            </div>
          ) : staffTasks.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No tasks currently assigned to this staff member.
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-2.5 pr-1">
              {staffTasks.map((t) => (
                <div
                  key={t.id}
                  className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-brand-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-lg border border-brand-200">
                        Room {t.room_number}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{t.request_code}</span>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        t.priority === 'Emergency'
                          ? 'bg-rose-100 text-rose-700'
                          : t.priority === 'High'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {t.priority}
                    </span>
                  </div>

                  {t.items_summary && (
                    <p className="text-xs font-semibold text-slate-700 mt-2">
                      {t.items_summary}
                    </p>
                  )}

                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-normal">
                    {t.description}
                  </p>

                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Status: <strong className="text-slate-700">{t.status}</strong></span>
                    <span>Assigned: {new Date(t.assigned_at || t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ================= GUEST GRATUITY MODAL ================= */}
      <Modal
        isOpen={tipsModalOpen}
        onClose={() => setTipsModalOpen(false)}
        title={`Guest Gratuity Records: ${selectedStaff?.full_name || 'Staff'}`}
      >
        <div className="space-y-4">
          {/* Summary Cards */}
          {staffTips && (
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Today</span>
                <span className="text-sm font-extrabold text-slate-800">
                  ${staffTips.summary.today.toFixed(2)}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">7 Days</span>
                <span className="text-sm font-extrabold text-slate-800">
                  ${staffTips.summary.week.toFixed(2)}
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Month</span>
                <span className="text-sm font-extrabold text-slate-800">
                  ${staffTips.summary.month.toFixed(2)}
                </span>
              </div>
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl">
                <span className="block text-[10px] font-bold text-rose-500 uppercase">All-Time</span>
                <span className="text-sm font-extrabold text-rose-700">
                  ${staffTips.summary.total.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {loadingTips ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-rose-500 mx-auto mb-2" />
              <p className="text-xs">Loading gratuity records...</p>
            </div>
          ) : !staffTips || staffTips.transactions.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No tip records found for this staff member yet.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {staffTips.transactions.map((t) => (
                <div
                  key={t.id}
                  className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-900">
                        Room {t.room_number}
                      </span>
                      {t.guest_name && (
                        <span className="text-xs text-slate-500 font-medium">({t.guest_name})</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {new Date(t.created_at).toLocaleDateString()} at{' '}
                      {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                      +${t.staff_amount.toFixed(2)}
                    </span>
                    <span className="block text-[10px] font-bold text-slate-400 mt-0.5">
                      {t.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
