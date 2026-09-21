import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/common/Modal';
import { api } from '../../services/api';
import { HeartHandshake, Loader2, DollarSign, Check, AlertCircle } from 'lucide-react';

interface StaffMember {
  staff_id: string;
  staff_name: string;
  job_title: string;
  department: string;
  avatar_url?: string;
  rating?: number;
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
  currency = 'USD'
}) => {
  const navigate = useNavigate();
  const [selectedStaffId, setSelectedStaffId] = useState<string>(staffMembers[0]?.staff_id || '');
  const [selectedAmount, setSelectedAmount] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [guestName, setGuestName] = useState('');
  const [guestMessage, setGuestMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeAmount = customAmount ? parseFloat(customAmount) || 0 : selectedAmount;

  React.useEffect(() => {
    if (staffMembers && staffMembers.length > 0 && (!selectedStaffId || !staffMembers.some(s => s.staff_id === selectedStaffId))) {
      setSelectedStaffId(staffMembers[0].staff_id);
    }
  }, [staffMembers]);

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
      // Navigate to checkout seamlessly without hardcoded host issues
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
      <div className="space-y-5">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Select Staff Member */}
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            Select Staff Member
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {staffMembers.map((staff) => {
              const isSelected = selectedStaffId === staff.staff_id;
              return (
                <div
                  key={staff.staff_id}
                  onClick={() => setSelectedStaffId(staff.staff_id)}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                    isSelected
                      ? 'border-rose-500 bg-rose-50/70 ring-1 ring-rose-500/30'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <img
                    src={staff.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.staff_name)}&background=e11d48&color=fff`}
                    alt={staff.staff_name}
                    className="w-11 h-11 rounded-xl object-cover border border-slate-200"
                  />
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-bold text-slate-900 truncate">{staff.staff_name}</h5>
                    <p className="text-[11px] text-slate-500 truncate">{staff.job_title}</p>
                    <span className="text-[10px] text-rose-600 font-semibold">{staff.department}</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-rose-600 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Tip Presets */}
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            Select Tip Amount ({currency})
          </label>
          <div className="grid grid-cols-4 gap-2 mb-3">
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
                  className={`py-3 rounded-xl text-sm font-extrabold border transition-all ${
                    isSelected
                      ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/25'
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
            placeholder="e.g. Great job with the quick AC repair!"
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
          className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-rose-600/25 transition-all flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <HeartHandshake className="w-4 h-4" />}
          <span>Continue to Payment (${activeAmount.toFixed(2)})</span>
        </button>

        <p className="text-[10px] text-center text-slate-400">
          🔒 Secure 256-bit encrypted payment • Official Square & Card processing
        </p>
      </div>
    </Modal>
  );
};
