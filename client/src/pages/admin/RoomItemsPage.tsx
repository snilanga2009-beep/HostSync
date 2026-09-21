import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { RoomItemCatalog, RoomItemAssignment, Room } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import {
  Layers,
  Wrench,
  Plus,
  Search,
  DoorClosed,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  Trash2,
  ShieldCheck,
  Calendar,
  Loader2
} from 'lucide-react';

export const RoomItemsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'room_assignment' | 'catalog'>('room_assignment');
  const [catalogItems, setCatalogItems] = useState<RoomItemCatalog[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [roomAssignments, setRoomAssignments] = useState<RoomItemAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [addCatalogModalOpen, setAddCatalogModalOpen] = useState(false);
  const [assignItemModalOpen, setAssignItemModalOpen] = useState(false);
  const [editConditionModalOpen, setEditConditionModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<RoomItemAssignment | null>(null);

  // Add catalog item state
  const [newCatName, setNewCatName] = useState('');
  const [newCatCategory, setNewCatCategory] = useState('Electronics');
  const [newCatIcon, setNewCatIcon] = useState('wrench');
  const [newCatDesc, setNewCatDesc] = useState('');

  // Assign to room state
  const [assignItemId, setAssignItemId] = useState('');
  const [assignSerial, setAssignSerial] = useState('');
  const [assignCondition, setAssignCondition] = useState<any>('Working');
  const [assignNotes, setAssignNotes] = useState('');

  // Edit condition state
  const [editStatus, setEditStatus] = useState<any>('Working');
  const [editSerial, setEditSerial] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const loadData = async () => {
    try {
      const [catRes, roomRes] = await Promise.all([
        api.get<{ items: RoomItemCatalog[] }>('/room-items'),
        api.get<{ rooms: Room[] }>('/rooms')
      ]);
      setCatalogItems(catRes.items);
      setRooms(roomRes.rooms);
      if (roomRes.rooms.length > 0 && !selectedRoomId) {
        setSelectedRoomId(roomRes.rooms[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadRoomAssignments = async (roomId: string) => {
    if (!roomId) return;
    try {
      const res = await api.get<{ room: Room; items: RoomItemAssignment[] }>(`/rooms/${roomId}`);
      setRoomAssignments(res.items);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedRoomId) {
      loadRoomAssignments(selectedRoomId);
    }
  }, [selectedRoomId]);

  const handleCreateCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/room-items', {
        name: newCatName,
        category: newCatCategory,
        icon: newCatIcon,
        default_description: newCatDesc
      });
      setAddCatalogModalOpen(false);
      setNewCatName('');
      setNewCatDesc('');
      loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to create item');
    }
  };

  const handleAssignItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignItemId || !selectedRoomId) return;

    try {
      await api.post('/room-items/assign', {
        room_id: selectedRoomId,
        room_item_id: assignItemId,
        condition_status: assignCondition,
        serial_number: assignSerial,
        notes: assignNotes
      });
      setAssignItemModalOpen(false);
      setAssignSerial('');
      setAssignNotes('');
      loadRoomAssignments(selectedRoomId);
    } catch (e: any) {
      alert(e.message || 'Failed to assign item to room');
    }
  };

  const handleUpdateCondition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;

    try {
      await api.put(`/room-items/assignments/${selectedAssignment.id}`, {
        condition_status: editStatus,
        serial_number: editSerial,
        notes: editNotes
      });
      setEditConditionModalOpen(false);
      loadRoomAssignments(selectedRoomId);
    } catch (e: any) {
      alert(e.message || 'Failed to update condition');
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm('Remove this equipment from the room?')) return;
    try {
      await api.delete(`/room-items/assignments/${assignmentId}`);
      loadRoomAssignments(selectedRoomId);
    } catch (e: any) {
      alert(e.message || 'Failed to remove');
    }
  };

  const handleDeleteCatalogItem = async (cat: RoomItemCatalog) => {
    if (!window.confirm(`Are you sure you want to permanently delete equipment "${cat.name}" from the master catalog? All room assignments and facility links will be removed. This cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/room-items/${cat.id}`);
      loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to delete catalog item');
    }
  };

  const activeRoom = rooms.find(r => r.id === selectedRoomId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Room Items & Equipment Condition</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Define equipment assigned to each room and record operational condition status
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('room_assignment')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'room_assignment'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Room Specific Items
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'catalog'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Master Catalog ({catalogItems.length})
          </button>
        </div>
      </div>

      {activeTab === 'room_assignment' ? (
        <div className="space-y-4">
          {/* Room Selector Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
                <DoorClosed className="w-5 h-5" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Select Room to Inspect</label>
                <select
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="text-sm font-extrabold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.room_number} • {r.name} ({r.room_status})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => setAssignItemModalOpen(true)}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-600/20 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Equip New Item in Room {activeRoom?.room_number}
            </button>
          </div>

          {/* Room Items Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-800">
                  Equipment Assigned to Room {activeRoom?.room_number}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-extrabold">
                  {roomAssignments.length} Items
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Equipment Item</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Condition Status</th>
                    <th className="py-3 px-4">Serial Number</th>
                    <th className="py-3 px-4">Inspection Notes</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roomAssignments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No items assigned to this room yet. Click "Equip New Item" to assign facilities.
                      </td>
                    </tr>
                  ) : (
                    roomAssignments.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 font-bold text-slate-900">
                            <Wrench className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                            {item.item_name}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {item.item_category}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={item.condition_status} size="sm" />
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                          {item.serial_number || '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                          {item.notes || 'Normal operating condition'}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1">
                          <button
                            onClick={() => {
                              setSelectedAssignment(item);
                              setEditStatus(item.condition_status);
                              setEditSerial(item.serial_number || '');
                              setEditNotes(item.notes || '');
                              setEditConditionModalOpen(true);
                            }}
                            className="p-1 text-slate-600 hover:text-brand-600 rounded hover:bg-slate-100"
                            title="Update Condition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveAssignment(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100"
                            title="Remove from Room"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Master Catalog View */
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setAddCatalogModalOpen(true)}
              className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Item to Master Catalog
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {catalogItems.map((cat) => (
              <div key={cat.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{cat.name}</h4>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {cat.category}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteCatalogItem(cat)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                    title="Delete Equipment from Master Catalog"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                  {cat.default_description || 'Standard hotel guest equipment'}
                </p>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>Assigned in: <strong className="text-slate-800">{cat.assigned_rooms_count || 0} rooms</strong></span>
                  {cat.maintenance_needed_count && cat.maintenance_needed_count > 0 ? (
                    <span className="text-rose-600 font-bold">{cat.maintenance_needed_count} issues</span>
                  ) : (
                    <span className="text-emerald-600 font-bold">All Working</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Equip Item in Room */}
      <Modal
        isOpen={assignItemModalOpen}
        onClose={() => setAssignItemModalOpen(false)}
        title="Equip Item in Room"
        subtitle={`Assign facility to Room ${activeRoom?.room_number}`}
      >
        <form onSubmit={handleAssignItem} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Select Equipment from Master Catalog *
            </label>
            <select
              required
              value={assignItemId}
              onChange={(e) => setAssignItemId(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
            >
              <option value="">Choose item...</option>
              {catalogItems.map(it => (
                <option key={it.id} value={it.id}>{it.name} ({it.category})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Initial Condition
              </label>
              <select
                value={assignCondition}
                onChange={(e) => setAssignCondition(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="Working">Working</option>
                <option value="Needs Inspection">Needs Inspection</option>
                <option value="Not Working">Not Working</option>
                <option value="Damaged">Damaged</option>
                <option value="Under Maintenance">Under Maintenance</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Serial Number
              </label>
              <input
                type="text"
                value={assignSerial}
                onChange={(e) => setAssignSerial(e.target.value)}
                placeholder="e.g. SN-AC-908"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Installation Notes
            </label>
            <textarea
              value={assignNotes}
              onChange={(e) => setAssignNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Installed new Samsung 55 4K TV"
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
          >
            Assign to Room
          </button>
        </form>
      </Modal>

      {/* Modal: Update Item Condition */}
      <Modal
        isOpen={editConditionModalOpen}
        onClose={() => setEditConditionModalOpen(false)}
        title="Update Equipment Condition"
        subtitle={`Room ${activeRoom?.room_number} • ${selectedAssignment?.item_name}`}
      >
        <form onSubmit={handleUpdateCondition} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Condition Status *
            </label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none font-bold"
            >
              <option value="Working">Working</option>
              <option value="Needs Inspection">Needs Inspection</option>
              <option value="Not Working">Not Working</option>
              <option value="Damaged">Damaged</option>
              <option value="Missing">Missing</option>
              <option value="Under Maintenance">Under Maintenance</option>
              <option value="Replaced">Replaced</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Serial Number
            </label>
            <input
              type="text"
              value={editSerial}
              onChange={(e) => setEditSerial(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Maintenance Notes
            </label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Cleaned air filters, refrigerant level checked."
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
          >
            Save Condition
          </button>
        </form>
      </Modal>

      {/* Modal: Add to Master Catalog */}
      <Modal
        isOpen={addCatalogModalOpen}
        onClose={() => setAddCatalogModalOpen(false)}
        title="Add Custom Item to Master Catalog"
        subtitle="Catalog items can be assigned to multiple rooms"
      >
        <form onSubmit={handleCreateCatalogItem} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Item Name *
              </label>
              <input
                type="text"
                required
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Espresso Machine"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={newCatCategory}
                onChange={(e) => setNewCatCategory(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="HVAC">HVAC</option>
                <option value="Electronics">Electronics</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Appliances">Appliances</option>
                <option value="Bathroom">Bathroom</option>
                <option value="Furniture">Furniture</option>
                <option value="Security">Security</option>
                <option value="Electrical">Electrical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              value={newCatDesc}
              onChange={(e) => setNewCatDesc(e.target.value)}
              rows={2}
              placeholder="e.g. Luxury capsule coffee brewer"
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
          >
            Add to Master Catalog
          </button>
        </form>
      </Modal>
    </div>
  );
};
