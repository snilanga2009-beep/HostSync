import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { ImageUploader } from '../../components/common/ImageUploader';
import { api } from '../../services/api';
import { Wrench, CheckSquare, Square, AlertCircle, Loader2 } from 'lucide-react';

interface FacilityItem {
  assignment_id: string;
  item_id: string;
  item_name: string;
  category: string;
  icon: string;
  condition_status: string;
}

interface GuestMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomToken: string;
  roomNumber: string;
  facilities: FacilityItem[];
  onSubmitted: (trackingUrl: string) => void;
}

const PROBLEM_TYPES = [
  'Not working',
  'Broken',
  'Damaged',
  'Missing',
  'Making noise',
  'Not cooling',
  'Not heating',
  'Other'
];

export const GuestMaintenanceModal: React.FC<GuestMaintenanceModalProps> = ({
  isOpen,
  onClose,
  roomToken,
  roomNumber,
  facilities,
  onSubmitted
}) => {
  const [selectedItems, setSelectedItems] = useState<{ [assignmentId: string]: string }>({});
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<'Normal' | 'High' | 'Emergency'>('Normal');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleItem = (assignmentId: string) => {
    setSelectedItems(prev => {
      const next = { ...prev };
      if (next[assignmentId]) {
        delete next[assignmentId];
      } else {
        next[assignmentId] = 'Not working';
      }
      return next;
    });
  };

  const setProblemType = (assignmentId: string, problem: string) => {
    setSelectedItems(prev => ({
      ...prev,
      [assignmentId]: problem
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const assignmentIds = Object.keys(selectedItems);

    if (assignmentIds.length === 0 && !description.trim()) {
      setError('Please select at least one item or describe what needs repair.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const itemsPayload = assignmentIds.map(aId => {
        const fac = facilities.find(f => f.assignment_id === aId);
        return {
          assignmentId: aId,
          itemName: fac?.item_name || 'Room Equipment',
          problemType: selectedItems[aId],
          notes: ''
        };
      });

      const res = await api.post<{ success: boolean; trackingUrl: string; requestCode: string }>('/guest/maintenance-request', {
        roomToken,
        items: itemsPayload,
        description,
        urgency,
        guestName,
        guestPhone,
        photos
      });

      onClose();
      onSubmitted(res.trackingUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to submit maintenance request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Report Maintenance Issue" subtitle={`Room ${roomNumber} Equipment Inspection`}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Equipment Checklist for this specific room */}
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            What is not working in your room?
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
            {facilities.map((fac) => {
              const isSelected = !!selectedItems[fac.assignment_id];
              return (
                <div
                  key={fac.assignment_id}
                  className={`p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50/60 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div
                    onClick={() => toggleItem(fac.assignment_id)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Wrench className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-xs font-bold text-slate-800 truncate">{fac.item_name}</span>
                    </div>
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-brand-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 shrink-0" />
                    )}
                  </div>

                  {/* Problem Dropdown when selected */}
                  {isSelected && (
                    <div className="mt-2.5 pt-2 border-t border-brand-200/80">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-slate-700">Specific Issue:</span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-brand-100 text-brand-800">
                          {selectedItems[fac.assignment_id]}
                        </span>
                      </div>
                      <select
                        value={selectedItems[fac.assignment_id]}
                        onChange={(e) => setProblemType(fac.assignment_id, e.target.value)}
                        className="w-full text-xs font-bold text-slate-900 bg-white border-2 border-brand-400 rounded-xl py-2 px-2.5 shadow-xs focus:ring-2 focus:ring-brand-500 focus:outline-none cursor-pointer"
                      >
                        {PROBLEM_TYPES.map((pt) => (
                          <option key={pt} value={pt} className="text-slate-900 font-semibold bg-white py-1">
                            {pt}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 2: Description */}
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
            Describe the problem (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="e.g. AC fan is blowing but air is not cooling down..."
            className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none placeholder:text-slate-400"
          />
        </div>

        {/* Step 3: Photo Upload */}
        <div>
          <ImageUploader
            label="Upload photo of damaged item (Optional)"
            onImageUploaded={(url) => setPhotos([url])}
            onImageRemoved={() => setPhotos([])}
          />
        </div>

        {/* Step 4: Urgency Level */}
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            Urgency Level
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['Normal', 'High', 'Emergency'] as const).map((lvl) => (
              <button
                type="button"
                key={lvl}
                onClick={() => setUrgency(lvl)}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                  urgency === lvl
                    ? (lvl === 'Emergency'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20'
                        : (lvl === 'High'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                            : 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-600/20'))
                    : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Step 5: Guest Name & Phone */}
        <div className="grid grid-cols-2 gap-3">
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
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Phone / WhatsApp (Optional)</label>
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="+1..."
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          <span>Send Maintenance Request</span>
        </button>
      </form>
    </Modal>
  );
};
