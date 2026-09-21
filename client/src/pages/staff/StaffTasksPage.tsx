import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge } from '../../components/common/PriorityBadge';
import { Modal } from '../../components/common/Modal';
import { ImageUploader } from '../../components/common/ImageUploader';
import {
  Wrench,
  CheckCircle2,
  Clock,
  Phone,
  AlertTriangle,
  Play,
  Check,
  DollarSign,
  ArrowRight,
  Loader2,
  Calendar,
  Layers,
  HeartHandshake
} from 'lucide-react';

interface Task {
  id: string;
  request_code: string;
  room_number: string;
  room_name?: string;
  building_name?: string;
  floor_name?: string;
  priority: string;
  status: string;
  description: string;
  created_at: string;
  assigned_at: string;
  assigned_by_name?: string;
  items_summary?: string;
}

export const StaffTasksPage: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<'all' | 'urgent' | 'pending' | 'completed'>('all');
  const [loading, setLoading] = useState(true);

  // Complete maintenance modal
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [workNotes, setWorkNotes] = useState('');
  const [partsUsed, setPartsUsed] = useState('');
  const [repairCost, setRepairCost] = useState('');
  const [repairPhotos, setRepairPhotos] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const loadTasks = async () => {
    if (!user?.staff_id) return;
    try {
      const res = await api.get<{ tasks: Task[] }>(`/staff/${user.staff_id}/tasks`);
      setTasks(res.tasks);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const handleAdvanceStatus = async (taskId: string, nextStatus: string) => {
    if (nextStatus === 'Completed') {
      setActiveTaskId(taskId);
      setWorkNotes('');
      setPartsUsed('');
      setRepairCost('');
      setRepairPhotos([]);
      setCompleteModalOpen(true);
      return;
    }

    try {
      await api.post(`/requests/${taskId}/status`, { status: nextStatus });
      await loadTasks();
    } catch (e: any) {
      alert(e.message || 'Status update failed');
    }
  };

  const handleCompleteMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTaskId) return;

    setActionLoading(true);
    try {
      await api.post(`/requests/${activeTaskId}/status`, {
        status: 'Completed',
        notes: workNotes,
        parts_used: partsUsed,
        cost: repairCost ? parseFloat(repairCost) : 0,
        photos: repairPhotos
      });
      setCompleteModalOpen(false);
      await loadTasks();
    } catch (e: any) {
      alert(e.message || 'Failed to complete task');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'urgent') return t.priority === 'High' || t.priority === 'Emergency';
    if (filter === 'pending') return t.status !== 'Completed' && t.status !== 'Cancelled';
    if (filter === 'completed') return t.status === 'Completed';
    return true;
  });

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-brand-950 p-5 rounded-2xl text-white shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider">Technician Portal</span>
            <h2 className="text-base font-extrabold">{user?.full_name}</h2>
            <p className="text-xs text-slate-300">{user?.job_title} • {user?.department}</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center font-black text-sm">
            {tasks.filter(t => t.status !== 'Completed').length}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-slate-800 overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filter === 'all' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Tasks ({tasks.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filter === 'pending' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Active ({tasks.filter(t => t.status !== 'Completed').length})
          </button>
          <button
            onClick={() => setFilter('urgent')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filter === 'urgent' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Urgent ({tasks.filter(t => t.priority === 'High' || t.priority === 'Emergency').length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filter === 'completed' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Task Cards */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-600" />
            <p className="text-xs">Loading assigned tasks...</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-10 bg-white rounded-2xl border border-slate-200 text-center shadow-soft">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-800">All Caught Up!</h4>
            <p className="text-xs text-slate-500 mt-0.5">No tasks currently assigned matching this view.</p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-soft hover:shadow-md transition-all space-y-3.5"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-black">
                      ROOM {task.room_number}
                    </span>
                    <span className="text-xs font-bold text-slate-700">{task.request_code}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {task.building_name || 'Main Wing'} • {task.floor_name || 'Floor 1'}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <PriorityBadge priority={task.priority} />
                  <StatusBadge status={task.status} size="sm" />
                </div>
              </div>

              {/* Reported Problem */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs font-bold text-slate-900">
                  {task.items_summary || 'Room Equipment Issue'}
                </p>
                {task.description && (
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    "{task.description}"
                  </p>
                )}
              </div>

              {/* Assigned info */}
              <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                <span>Assigned by: <strong>{task.assigned_by_name || 'Front Office'}</strong></span>
                <span>{new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              {/* State Machine Action Buttons */}
              <div className="pt-2 border-t border-slate-100">
                {task.status === 'Assigned' && (
                  <button
                    onClick={() => handleAdvanceStatus(task.id, 'Accepted')}
                    className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" /> Accept Task
                  </button>
                )}

                {task.status === 'Accepted' && (
                  <button
                    onClick={() => handleAdvanceStatus(task.id, 'On The Way')}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ArrowRight className="w-4 h-4" /> I'm On The Way
                  </button>
                )}

                {task.status === 'On The Way' && (
                  <button
                    onClick={() => handleAdvanceStatus(task.id, 'In Progress')}
                    className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-4 h-4" /> Arrived & Start Work
                  </button>
                )}

                {task.status === 'In Progress' && (
                  <button
                    onClick={() => handleAdvanceStatus(task.id, 'Completed')}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Complete Maintenance
                  </button>
                )}

                {task.status === 'Completed' && (
                  <div className="w-full py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold text-center border border-emerald-200">
                    ✓ Maintenance Completed
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Complete Maintenance Details Modal */}
      <Modal
        isOpen={completeModalOpen}
        onClose={() => setCompleteModalOpen(false)}
        title="Complete Maintenance Job"
        subtitle="Record work summary, parts used, and repair cost"
      >
        <form onSubmit={handleCompleteMaintenance} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Work Completed Notes *
            </label>
            <textarea
              required
              value={workNotes}
              onChange={(e) => setWorkNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Replaced AC thermostat and cleaned intake filters. Tested blowing 65F cold air."
              className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Parts Replaced / Used
              </label>
              <input
                type="text"
                value={partsUsed}
                onChange={(e) => setPartsUsed(e.target.value)}
                placeholder="e.g. Capacitor 45uF"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Repair Cost ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={repairCost}
                onChange={(e) => setRepairCost(e.target.value)}
                placeholder="0.00"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <ImageUploader
              label="Completion / After Photo (Optional)"
              onImageUploaded={(url) => setRepairPhotos([url])}
              onImageRemoved={() => setRepairPhotos([])}
            />
          </div>

          <button
            type="submit"
            disabled={actionLoading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>Mark Task Completed</span>
          </button>
        </form>
      </Modal>
    </div>
  );
};
