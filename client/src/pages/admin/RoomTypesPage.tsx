import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { RoomType } from '../../types';
import { Modal } from '../../components/common/Modal';
import { BedDouble, Plus, Edit2, Trash2, Users, DollarSign, Loader2 } from 'lucide-react';

export const RoomTypesPage: React.FC = () => {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<RoomType | null>(null);

  // Form
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [maxGuests, setMaxGuests] = useState(2);
  const [bedCount, setBedCount] = useState(1);
  const [bedType, setBedType] = useState('King');
  const [roomSize, setRoomSize] = useState(35);
  const [basePrice, setBasePrice] = useState(150);
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const loadRoomTypes = async () => {
    try {
      const res = await api.get<{ roomTypes: RoomType[] }>('/room-types');
      setRoomTypes(res.roomTypes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoomTypes();
  }, []);

  const handleOpenAdd = () => {
    setEditingType(null);
    setName('');
    setCode('');
    setDescription('');
    setMaxGuests(2);
    setBedCount(1);
    setBedType('King');
    setRoomSize(35);
    setBasePrice(150);
    setImageUrl('');
    setModalOpen(true);
  };

  const handleOpenEdit = (rt: RoomType) => {
    setEditingType(rt);
    setName(rt.name);
    setCode(rt.code);
    setDescription(rt.description || '');
    setMaxGuests(rt.max_guests);
    setBedCount(rt.bed_count);
    setBedType(rt.bed_type);
    setRoomSize(rt.room_size_sqm);
    setBasePrice(rt.base_price);
    setImageUrl(rt.image_url || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        code,
        description,
        max_guests: maxGuests,
        bed_count: bedCount,
        bed_type: bedType,
        room_size_sqm: roomSize,
        base_price: basePrice,
        image_url: imageUrl,
        status: 'active'
      };

      if (editingType) {
        await api.put(`/room-types/${editingType.id}`, payload);
      } else {
        await api.post('/room-types', payload);
      }

      setModalOpen(false);
      await loadRoomTypes();
    } catch (e: any) {
      alert(e.message || 'Failed to save room type');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this room type?')) return;
    try {
      await api.delete(`/room-types/${id}`);
      await loadRoomTypes();
    } catch (e: any) {
      alert(e.message || 'Cannot delete room type');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Room Categories & Types</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure hotel suites, villas, pricing, guest capacities, and bed specifications
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-600/20 transition-colors flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Add Room Type
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {roomTypes.map((rt) => (
          <div
            key={rt.id}
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-soft hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              {rt.image_url ? (
                <div className="h-40 w-full overflow-hidden relative">
                  <img src={rt.image_url} alt={rt.name} className="w-full h-full object-cover" />
                  <span className="absolute top-3 right-3 px-2.5 py-1 bg-slate-900/80 text-white text-xs font-black rounded-lg backdrop-blur-xs">
                    ${rt.base_price}/night
                  </span>
                </div>
              ) : null}

              <div className="p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-slate-900">{rt.name}</h3>
                  <span className="font-mono text-[10px] font-extrabold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {rt.code}
                  </span>
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mt-1">
                  {rt.description || 'Luxury accommodations with bespoke hospitality.'}
                </p>

                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-600 font-semibold text-center">
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="block text-[10px] text-slate-400">Capacity</span>
                    <span>{rt.max_guests} Guests</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="block text-[10px] text-slate-400">Bed</span>
                    <span className="truncate block">{rt.bed_count}x {rt.bed_type}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="block text-[10px] text-slate-400">Size</span>
                    <span>{rt.room_size_sqm} m²</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => handleOpenEdit(rt)}
                className="p-1.5 text-slate-600 hover:text-brand-600 rounded-lg hover:bg-slate-200/60 transition-colors"
                title="Edit Room Type"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(rt.id)}
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-200/60 transition-colors"
                title="Delete Room Type"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingType ? 'Edit Room Type' : 'Add New Room Type'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Deluxe Ocean Suite"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Code *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. DLX"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="e.g. Panoramic ocean views, king bed, jacuzzi tub..."
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Base Price ($/night)
              </label>
              <input
                type="number"
                value={basePrice}
                onChange={(e) => setBasePrice(Number(e.target.value))}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Max Guests
              </label>
              <input
                type="number"
                value={maxGuests}
                onChange={(e) => setMaxGuests(Number(e.target.value))}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Bed Count
              </label>
              <input
                type="number"
                value={bedCount}
                onChange={(e) => setBedCount(Number(e.target.value))}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Bed Type
              </label>
              <input
                type="text"
                value={bedType}
                onChange={(e) => setBedType(e.target.value)}
                placeholder="King / Queen"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Size (m²)
              </label>
              <input
                type="number"
                value={roomSize}
                onChange={(e) => setRoomSize(Number(e.target.value))}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Image URL
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
          >
            Save Room Type
          </button>
        </form>
      </Modal>
    </div>
  );
};
