import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Room, RoomType, Building } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { QRPreviewModal } from '../../components/common/QRPreviewModal';
import { Modal } from '../../components/common/Modal';
import {
  DoorClosed,
  Plus,
  QrCode,
  Search,
  Filter,
  Layers,
  Wrench,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Sparkles,
  Building as BuildingIcon,
  Trash2
} from 'lucide-react';

export const RoomsPage: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');

  // Modals
  const [selectedQRRoom, setSelectedQRRoom] = useState<Room | null>(null);
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  // Add/Edit room form state
  const [roomNumber, setRoomNumber] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomTypeId, setRoomTypeId] = useState('');
  const [buildingInput, setBuildingInput] = useState('');
  const [floorInput, setFloorInput] = useState('');
  const [roomStatus, setRoomStatus] = useState<any>('Available');
  const [occupancyStatus, setOccupancyStatus] = useState<any>('Vacant');
  const [notes, setNotes] = useState('');
  const [isFloorAutoSuggested, setIsFloorAutoSuggested] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadRooms = async () => {
    try {
      const res = await api.get<{ rooms: Room[] }>(`/rooms?search=${search}&room_status=${statusFilter}&building_id=${buildingFilter}`);
      setRooms(res.rooms);
    } catch (e) {
      console.error(e);
    }
  };

  const loadMetadata = async () => {
    try {
      const [rtRes, bldgRes] = await Promise.all([
        api.get<{ roomTypes: RoomType[] }>('/room-types'),
        api.get<{ buildings: Building[] }>('/hotel/structure')
      ]);
      setRoomTypes(rtRes.roomTypes || []);
      setBuildings(bldgRes.buildings || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadRooms(), loadMetadata()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadRooms();
  }, [search, statusFilter, buildingFilter]);

  const handleDeleteRoom = async (room: Room) => {
    if (!window.confirm(`Are you sure you want to permanently delete Room ${room.room_number}? All room records, active QR codes, maintenance history, and equipment assignments will be deleted. This cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/rooms/${room.id}`);
      if (addRoomOpen && editingRoom?.id === room.id) {
        setAddRoomOpen(false);
        setEditingRoom(null);
      }
      await loadRooms();
    } catch (err: any) {
      alert(err.message || 'Failed to delete room');
    }
  };

  const handleOpenAddModal = () => {
    setEditingRoom(null);
    setRoomNumber('');
    setRoomName('');
    setRoomTypeId(roomTypes[0]?.id || '');
    setBuildingInput(buildings[0]?.name || '');
    setFloorInput('');
    setIsFloorAutoSuggested(false);
    setRoomStatus('Available');
    setOccupancyStatus('Vacant');
    setNotes('');
    setFormError(null);
    setAddRoomOpen(true);
  };

  const handleOpenEditModal = (room: Room) => {
    setEditingRoom(room);
    setRoomNumber(room.room_number);
    setRoomName(room.name || '');
    setRoomTypeId(room.room_type_id || '');
    setBuildingInput(room.building_name || '');
    setFloorInput(room.floor_name || '');
    setIsFloorAutoSuggested(false);
    setRoomStatus(room.room_status || 'Available');
    setOccupancyStatus(room.occupancy_status || 'Vacant');
    setNotes(room.notes || '');
    setFormError(null);
    setAddRoomOpen(true);
  };

  const handleRoomNumberChange = (val: string) => {
    setRoomNumber(val);
    if (!roomName || (editingRoom ? roomName === `Room ${editingRoom.room_number}` : roomName === `Room ${roomNumber}`)) {
      setRoomName(val ? `Room ${val}` : '');
    }

    // Auto-detect floor from room number if floor is blank or was auto-suggested
    if (!floorInput || isFloorAutoSuggested) {
      const trimmed = val.trim();
      if (/^\d{3,4}$/.test(trimmed)) {
        const floorNum = trimmed.length === 3 ? trimmed[0] : trimmed.slice(0, 2);
        setFloorInput(`Floor ${floorNum}`);
        setIsFloorAutoSuggested(true);
      } else if (/^[Gg]/i.test(trimmed)) {
        setFloorInput('Ground Floor');
        setIsFloorAutoSuggested(true);
      } else if (/^[Pp][Hh]/i.test(trimmed)) {
        setFloorInput('Penthouse');
        setIsFloorAutoSuggested(true);
      } else if (/^[Bb]/i.test(trimmed)) {
        setFloorInput('Basement');
        setIsFloorAutoSuggested(true);
      }
    }
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumber.trim()) {
      setFormError('Room number is required.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const payload = {
        room_number: roomNumber.trim(),
        name: roomName.trim() || `Room ${roomNumber.trim()}`,
        room_type_id: roomTypeId || null,
        building_name: buildingInput.trim() || null,
        floor_name: floorInput.trim() || null,
        room_status: roomStatus,
        occupancy_status: occupancyStatus,
        notes: notes.trim()
      };

      if (editingRoom) {
        await api.put(`/rooms/${editingRoom.id}`, payload);
      } else {
        await api.post('/rooms', payload);
      }

      setAddRoomOpen(false);
      setEditingRoom(null);
      setRoomNumber('');
      setRoomName('');
      setNotes('');
      await Promise.all([loadRooms(), loadMetadata()]);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save room.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatusChange = async (roomId: string, newStatus: string) => {
    try {
      const room = rooms.find(r => r.id === roomId);
      if (!room) return;
      await api.put(`/rooms/${roomId}`, {
        ...room,
        room_status: newStatus
      });
      await loadRooms();
    } catch (e: any) {
      alert(e.message || 'Failed to update status');
    }
  };

  // Find floors belonging to the currently typed/selected building
  const matchedBuilding = buildings.find(b => b.name.toLowerCase() === buildingInput.trim().toLowerCase());
  const existingBuildingFloors = matchedBuilding?.floors?.map(f => f.name) || [];

  // Standard hotel floor names
  const standardFloors = [
    'Ground Floor',
    'Floor 1',
    'Floor 2',
    'Floor 3',
    'Floor 4',
    'Floor 5',
    'Floor 6',
    'Penthouse',
    'Basement',
    'Mezzanine'
  ];

  // Combined unique floor options for datalist & suggestions
  const floorDatalistOptions = Array.from(new Set([...existingBuildingFloors, ...standardFloors]));

  // Suggested floor chips to display
  const displayFloorSuggestions = Array.from(new Set([
    ...(existingBuildingFloors.length > 0 ? existingBuildingFloors : ['Ground Floor', 'Floor 1', 'Floor 2', 'Floor 3', 'Penthouse'])
  ])).slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Room Inventory & QR Keys</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
              {rooms.length} Rooms
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Manage hotel rooms, buildings, floors, and unique room QR tokens</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all flex items-center gap-1.5 self-start sm:self-auto active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add Room
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search room number or room name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs py-2 px-3 border border-slate-200 rounded-xl bg-white font-medium focus:ring-2 focus:ring-red-500 focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="Available">Available</option>
          <option value="Occupied">Occupied</option>
          <option value="Cleaning">Cleaning</option>
          <option value="Maintenance">Maintenance</option>
          <option value="Out of Service">Out of Service</option>
        </select>

        <select
          value={buildingFilter}
          onChange={(e) => setBuildingFilter(e.target.value)}
          className="text-xs py-2 px-3 border border-slate-200 rounded-xl bg-white font-medium focus:ring-2 focus:ring-red-500 focus:outline-none"
        >
          <option value="">All Buildings</option>
          {buildings.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Rooms Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Room</th>
                <th className="py-3.5 px-4">Room Type</th>
                <th className="py-3.5 px-4">Location (Building / Floor)</th>
                <th className="py-3.5 px-4">Room Status</th>
                <th className="py-3.5 px-4">Occupancy</th>
                <th className="py-3.5 px-4">Equipped Items</th>
                <th className="py-3.5 px-4 text-center">In-Room QR & Edit</th>
                <th className="py-3.5 px-4 text-right">Quick Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rooms.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No rooms found matching filters.
                  </td>
                </tr>
              ) : (
                rooms.map((room) => (
                  <tr key={room.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-slate-900 text-white font-black text-xs flex items-center justify-center shadow-xs">
                          {room.room_number}
                        </span>
                        <div>
                          <p className="font-bold text-slate-900">{room.name}</p>
                          <p className="text-[10px] text-slate-400">{room.guest_status || 'Checked-in'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800">{room.room_type_name || 'Standard'}</span>
                      {room.base_price && (
                        <p className="text-[10px] text-slate-400">${room.base_price}/night</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <BuildingIcon className="w-3 h-3 text-slate-400" />
                        <span>{room.building_name || 'Main Wing'}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 ml-4 font-normal">{room.floor_name || 'Floor 1'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={room.room_status} size="sm" />
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        room.occupancy_status === 'Occupied'
                          ? 'bg-sky-50 text-sky-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {room.occupancy_status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-800">{room.total_items || 0} items</span>
                      {room.damaged_items && room.damaged_items > 0 ? (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                          {room.damaged_items} damaged
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedQRRoom(room)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:border-red-500 hover:bg-red-50 text-slate-700 transition-colors inline-flex items-center gap-1 font-semibold text-[11px]"
                          title="View / Download / Print QR Code"
                        >
                          <QrCode className="w-3.5 h-3.5 text-red-600" />
                          <span>QR Code</span>
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(room)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-100 text-slate-600 transition-colors inline-flex items-center gap-1 font-semibold text-[11px]"
                          title="Edit Room Details"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteRoom(room)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:border-rose-300 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors inline-flex items-center gap-1 font-semibold text-[11px]"
                          title="Delete Room"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <select
                        value={room.room_status}
                        onChange={(e) => handleQuickStatusChange(room.id, e.target.value)}
                        className="text-[11px] py-1 px-2 border border-slate-200 rounded-lg bg-white font-medium focus:ring-1 focus:ring-red-500 focus:outline-none"
                      >
                        <option value="Available">Available</option>
                        <option value="Occupied">Occupied</option>
                        <option value="Cleaning">Cleaning</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Out of Service">Out of Service</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Preview & Download Modal */}
      <QRPreviewModal
        isOpen={!!selectedQRRoom}
        onClose={() => setSelectedQRRoom(null)}
        room={selectedQRRoom}
        onRoomUpdated={loadRooms}
      />

      {/* Add / Edit Room Modal */}
      <Modal
        isOpen={addRoomOpen}
        onClose={() => {
          setAddRoomOpen(false);
          setEditingRoom(null);
        }}
        title={editingRoom ? `Edit Room ${editingRoom.room_number}` : "Add New Room"}
        subtitle={editingRoom ? "Update room configuration, building, and floor" : "Create room with auto-generated secure QR token"}
      >
        <form onSubmit={handleSaveRoom} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Room Number *
              </label>
              <input
                type="text"
                required
                value={roomNumber}
                onChange={(e) => handleRoomNumberChange(e.target.value)}
                placeholder="e.g. 105"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Room Display Name
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g. Coral Suite 105"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Room Type
            </label>
            <select
              value={roomTypeId}
              onChange={(e) => setRoomTypeId(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
            >
              <option value="">Select Room Type</option>
              {roomTypes.map(rt => (
                <option key={rt.id} value={rt.id}>{rt.name} (${rt.base_price})</option>
              ))}
            </select>
          </div>

          {/* BUILDING: Type or Auto-list */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Building
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Type custom or select from list</span>
            </div>
            <div className="relative">
              <input
                type="text"
                list="building-options-list"
                value={buildingInput}
                onChange={(e) => setBuildingInput(e.target.value)}
                placeholder="Type or pick building (e.g. Oceanfront Villas, Main Coral Wing)..."
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
              <datalist id="building-options-list">
                {buildings.map(b => (
                  <option key={b.id} value={b.name} />
                ))}
              </datalist>
            </div>

            {/* Quick Building Suggestion Chips */}
            {buildings.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] font-bold text-slate-400">Quick list:</span>
                {buildings.map(b => (
                  <button
                    type="button"
                    key={b.id}
                    onClick={() => setBuildingInput(b.name)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border transition-colors ${
                      buildingInput.trim().toLowerCase() === b.name.toLowerCase()
                        ? 'bg-red-50 border-red-300 text-red-700 font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            )}

            {buildingInput.trim() && !buildings.some(b => b.name.toLowerCase() === buildingInput.trim().toLowerCase()) && (
              <p className="text-[11px] text-red-600 font-medium flex items-center gap-1 pt-0.5">
                <Sparkles className="w-3 h-3 text-red-500 shrink-0" />
                <span>New building <strong>"{buildingInput.trim()}"</strong> will be added automatically</span>
              </p>
            )}
          </div>

          {/* FLOOR: Type or Auto-list */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Floor
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Type custom or select from list</span>
            </div>
            <div className="relative">
              <input
                type="text"
                list="floor-options-list"
                value={floorInput}
                onChange={(e) => {
                  setFloorInput(e.target.value);
                  setIsFloorAutoSuggested(false);
                }}
                placeholder="Type or pick floor (e.g. Floor 1, Ground Floor, Penthouse)..."
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
              <datalist id="floor-options-list">
                {floorDatalistOptions.map(f => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>

            {/* Quick Floor Suggestion Chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[10px] font-bold text-slate-400">Quick list:</span>
              {displayFloorSuggestions.map(f => (
                <button
                  type="button"
                  key={f}
                  onClick={() => {
                    setFloorInput(f);
                    setIsFloorAutoSuggested(false);
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-medium border transition-colors ${
                    floorInput.trim().toLowerCase() === f.toLowerCase()
                      ? 'bg-red-50 border-red-300 text-red-700 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {isFloorAutoSuggested && (
              <p className="text-[11px] text-slate-500 font-medium pt-0.5">
                💡 Auto-suggested from Room {roomNumber} (you can edit or type anything)
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Room Status
              </label>
              <select
                value={roomStatus}
                onChange={(e) => setRoomStatus(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
              >
                <option value="Available">Available</option>
                <option value="Occupied">Occupied</option>
                <option value="Cleaning">Cleaning</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Out of Service">Out of Service</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Occupancy Status
              </label>
              <select
                value={occupancyStatus}
                onChange={(e) => setOccupancyStatus(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
              >
                <option value="Vacant">Vacant</option>
                <option value="Occupied">Occupied</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Internal Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Adjoining room to 106, ocean facing balcony..."
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>{editingRoom ? "Save Room Changes" : "Create Room & Generate QR"}</span>
          </button>

          {editingRoom && (
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400">Danger Zone</span>
              <button
                type="button"
                onClick={() => handleDeleteRoom(editingRoom)}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Room</span>
              </button>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
};
