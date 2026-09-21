import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { api } from '../../services/api';
import { Plus, Minus, Loader2, AlertCircle } from 'lucide-react';

interface GuestServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomToken: string;
  roomNumber: string;
  onSubmitted: (trackingUrl: string) => void;
}

const SERVICE_OPTIONS = [
  { id: 'Extra towels', label: 'Extra Bath Towels' },
  { id: 'Extra pillows', label: 'Extra Pillows' },
  { id: 'Drinking water', label: 'Bottled Drinking Water' },
  { id: 'Toiletries', label: 'Shampoo & Luxury Toiletries' },
  { id: 'Room cleaning', label: 'Full Room Makeup & Cleaning' },
  { id: 'Laundry', label: 'Laundry & Dry Cleaning Pickup' },
  { id: 'Iron', label: 'Iron & Ironing Board' },
  { id: 'Baby items', label: 'Baby Crib / Cot' },
  { id: 'Other', label: 'Custom Supply / Request' }
];

export const GuestServiceModal: React.FC<GuestServiceModalProps> = ({
  isOpen,
  onClose,
  roomToken,
  roomNumber,
  onSubmitted
}) => {
  const [serviceType, setServiceType] = useState('Extra towels');
  const [quantity, setQuantity] = useState(2);
  const [notes, setNotes] = useState('');
  const [guestName, setGuestName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.post<{ success: boolean; trackingUrl: string; requestCode: string }>('/guest/service-request', {
        roomToken,
        serviceType,
        quantity,
        notes,
        guestName
      });

      onClose();
      onSubmitted(res.trackingUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to submit service request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Room Supplies & Service" subtitle={`Room ${roomNumber} Guest Requests`}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Item Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            Select Service / Amenity
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SERVICE_OPTIONS.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setServiceType(item.id)}
                className={`p-3 rounded-xl border text-left text-xs font-semibold transition-all ${
                  serviceType === item.id
                    ? 'border-brand-500 bg-brand-50/70 text-brand-950 ring-1 ring-brand-500/30'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity Counter */}
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            Quantity
          </label>
          <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 p-2.5 rounded-xl w-max">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors shadow-xs"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 text-center text-sm font-extrabold text-slate-900">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity(Math.min(10, quantity + 1))}
              className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Special Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
            Special Instructions / Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Please leave them on the luggage stand..."
            className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none placeholder:text-slate-400"
          />
        </div>

        {/* Guest Name */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Your Name (Optional)</label>
          <input
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="e.g. Marcus"
            className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          <span>Send Request</span>
        </button>
      </form>
    </Modal>
  );
};
