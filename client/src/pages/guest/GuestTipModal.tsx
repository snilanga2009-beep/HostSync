import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/common/Modal';
import { api } from '../../services/api';
import { HeartHandshake, Loader2, DollarSign, Check, AlertCircle, Search, Star, Sparkles } from 'lucide-react';

export interface StaffMember {
  staff_id: string;
  staff_name: string;
  job_title: string;
  department: string;
  avatar_url?: string;
  rating?: number;
  worked_in_room?: boolean | number;
  service_reason?: string;
}

interface GuestTipModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomToken?: string;
  roomId?: string;
  requestId?: string;
  roomNumber: string;
  staffMembers: StaffMember[];
  currency?: string;
  initialStaffId?: string;
}

const PRESET_AMOUNTS = [5, 10, 20, 50];

export const GuestTipModal: React.FC<GuestTipModalProps> = ({
  isOpen,
  onClose,
  roomToken,
  roomId,
  requestId,
  roomNumber,
  staffMembers,
  currency = 'USD',
  initialStaffId
}) => {
  const navigate = useNavigate();
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedAmount, setSelectedAmount] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [guestName, setGuestName] = useState('');
  const [guestMessage, setGuestMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeAmount = customAmount ? parseFloat(customAmount) || 0 : selectedAmount;

  // Auto-select staff member: initialStaffId -> first who worked in room -> first available
  useEffect(() => {
    if (!staffMembers || staffMembers.length === 0) return;

    if (initialStaffId && staffMembers.some(s => s.staff_id === initialStaffId)) {
      setSelectedStaffId(initialStaffId);
      return;
    }

    if (!selectedStaffId || !staffMembers.some(s => s.staff_id === selectedStaffId)) {
      const roomWorker = staffMembers.find(s => Boolean(s.worked_in_room));
      setSelectedStaffId(roomWorker ? roomWorker.staff_id : staffMembers[0].staff_id);
    }
  }, [staffMembers, initialStaffId]);

  // Unique departments for filter chips
  const categories = useMemo(() => {
    const list = ['All'];
    const hasWorked = staffMembers.some(s => Boolean(s.worked_in_room));
    if (hasWorked) {
      list.push('Attended Room');
    }
    const depts = Array.from(new Set(staffMembers.map(s => s.department).filter(Boolean)));
    return [...list, ...depts];
  }, [staffMembers]);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffMembers.filter(staff => {
      const matchesSearch = 
        staff.staff_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.job_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.department.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (selectedCategory === 'All') return true;
      if (selectedCategory === 'Attended Room') return Boolean(staff.worked_in_room);
      return staff.department === selectedCategory;
    });
  }, [staffMembers, searchQuery, selectedCategory]);

  const handleContinueToPayment = async () => {
    if (!selectedStaffId) {
      setError('Please select a staff member to tip.');
      return;
    }
    if (activeAmount <= 0) {
      setError('Please select or enter a valid tip amount.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.post<{
        success: boolean;
        transactionId: string;
        checkoutUrl: string;
      }>('/guest/tip', {
        roomToken,
        roomId,
        roomNumber,
        requestId,
        staffId: selectedStaffId,
        amount: activeAmount,
        customAmount: !!customAmount,
        guestName,
        guestMessage
      });

      onClose();
      if (res.transactionId) {
        navigate(`/guest/checkout/${res.transactionId}`);
      } else if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize tip payment session.');
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tip Our Staff" subtitle={`Room ${roomNumber} Gratuity`}>
      <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Select Staff Member */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider">
              Select Staff Member ({staffMembers.length} available)
            </label>
          </div>

          {/* Search bar & Filter Chips */}
          <div className="space-y-2 mb-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, role, or department..."
                className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:bg-white focus:outline-none"
              />
            </div>

            {/* Department chips */}
            {categories.length > 2 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {categories.map((cat) => {
                  const isActive = selectedCategory === cat;
                  return (
                    <button
                      type="button"
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`text-[10px] px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition-all ${
                        isActive
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat === 'Attended Room' && '⭐ '}
                      {cat}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Staff Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-0.5">
            {filteredStaff.length === 0 ? (
              <div className="col-span-full py-6 text-center text-xs text-slate-400">
                No staff member found matching "{searchQuery}"
              </div>
            ) : (
              filteredStaff.map((staff) => {
                const isSelected = selectedStaffId === staff.staff_id;
                const attended = Boolean(staff.worked_in_room);
                return (
                  <div
                    key={staff.staff_id}
                    onClick={() => setSelectedStaffId(staff.staff_id)}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 relative ${
                      isSelected
                        ? 'border-rose-500 bg-rose-50/80 ring-2 ring-rose-500/30 shadow-sm'
                        : attended
                        ? 'border-amber-300 bg-amber-50/40 hover:bg-amber-50/70'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <img
                        src={staff.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.staff_name)}&background=e11d48&color=fff`}
                        alt={staff.staff_name}
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-xs"
                      />
                      {attended && (
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-sm">
                          <Sparkles className="w-3 h-3 fill-white" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {attended && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300 mb-0.5">
                          ⭐ {staff.service_reason || 'Worked on Your Room'}
                        </span>
                      )}
                      <h5 className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                        {staff.staff_name}
                      </h5>
                      <p className="text-[11px] text-slate-600 truncate font-medium">{staff.job_title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-rose-600 font-bold">{staff.department}</span>
                        {staff.rating && (
                          <span className="text-[10px] text-amber-600 font-bold flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                            {staff.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0 self-center shadow-xs">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 2. Tip Presets */}
        <div>
          <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
            Select Tip Amount ({currency})
          </label>
          <div className="grid grid-cols-4 gap-2 mb-2.5">
            {PRESET_AMOUNTS.map((amt) => {
              const isSelected = !customAmount && selectedAmount === amt;
              return (
                <button
                  type="button"
                  key={amt}
                  onClick={() => {
                    setSelectedAmount(amt);
                    setCustomAmount('');
                  }}
                  className={`py-3 rounded-xl text-sm font-black border transition-all ${
                    isSelected
                      ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/25 scale-[1.02]'
                      : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  ${amt}
                </button>
              );
            })}
          </div>

          {/* Custom Amount Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <DollarSign className="w-4 h-4" />
            </div>
            <input
              type="number"
              min="1"
              step="1"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="Or enter custom amount..."
              className="w-full text-xs font-semibold pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
          </div>
        </div>

        {/* 3. Appreciation Note */}
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
            Thank you note (Optional)
          </label>
          <textarea
            value={guestMessage}
            onChange={(e) => setGuestMessage(e.target.value)}
            rows={2}
            placeholder="e.g. Thank you for fixing the AC so quickly!"
            className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
          />
        </div>

        {/* 4. Guest Name */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Your Name (Optional)</label>
          <input
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="e.g. Dr. Sterling"
            className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
          />
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleContinueToPayment}
          disabled={loading || activeAmount <= 0}
          className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white rounded-2xl text-xs font-bold shadow-lg shadow-rose-600/25 transition-all flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <HeartHandshake className="w-4 h-4" />}
          <span>Continue to Payment (${activeAmount.toFixed(2)})</span>
        </button>

        <p className="text-[10px] text-center text-slate-400">
          🔒 Secure 256-bit encrypted payment • Direct gratuity to hotel team
        </p>
      </div>
    </Modal>
  );
};
