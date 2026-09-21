import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Wrench,
  AlertTriangle,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  Play,
  Camera,
  Check,
  Send,
  Loader2,
  DollarSign,
  PenTool,
  RotateCcw,
  Sparkles,
  Phone,
  ShieldAlert,
  Layers,
  ArrowRight
} from 'lucide-react';
import { api } from '../../services/api';

interface JobDetails {
  id: string;
  requestCode: string;
  roomNumber: string;
  roomName?: string;
  buildingName?: string;
  floorName?: string;
  priority: string;
  status: string;
  description?: string;
  itemsSummary?: string;
  photosJson?: string;
  createdAt: string;
  assignedAt: string;
  assignedByName?: string;
  hotelName: string;
  hotelLogo?: string;
  hotelPhone?: string;
}

interface StaffDetails {
  id: string;
  fullName: string;
  jobTitle: string;
  department: string;
  avatarUrl?: string;
  employeeId: string;
}

export const StaffJobMobilePage: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<JobDetails | null>(null);
  const [staff, setStaff] = useState<StaffDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canRequestNewLink, setCanRequestNewLink] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Complete Job Form State
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [partsUsed, setPartsUsed] = useState('');
  const [repairCost, setRepairCost] = useState('');
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  const [completedSuccess, setCompletedSuccess] = useState(false);
  const [completedTime, setCompletedTime] = useState('');

  // Canvas Signature State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const cleanToken = (token || '').trim().replace(/[.,;:/?#]+$/, '');

  const loadJob = async () => {
    if (!cleanToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(cleanToken)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to access job details.');
        setCanRequestNewLink(!!data.canRequestNewLink);
        return;
      }
      setJob(data.job);
      setStaff(data.staff);
    } catch (err: any) {
      setError(err.message || 'Network error loading job.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJob();
  }, [cleanToken]);

  // Status transition handlers
  const handleAction = async (action: 'accept' | 'decline' | 'on-the-way' | 'arrived' | 'start') => {
    if (!cleanToken) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(cleanToken)}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Action failed.');
        return;
      }
      // Refresh state
      await loadJob();
    } catch (err: any) {
      alert(err.message || 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Complete job submission
  const handleCompleteJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanToken) return;
    setActionLoading(true);

    try {
      let signatureDataUrl = '';
      if (canvasRef.current && hasSignature) {
        signatureDataUrl = canvasRef.current.toDataURL('image/png');
      }

      const res = await fetch(`/api/jobs/${encodeURIComponent(cleanToken)}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completion_notes: completionNotes,
          before_photos: beforePhotos,
          after_photos: afterPhotos,
          parts_used: partsUsed,
          repair_cost: repairCost,
          guest_signature_url: signatureDataUrl
        })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to complete job.');
        return;
      }

      setCompletedSuccess(true);
      setCompletedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setShowCompleteForm(false);
      await loadJob();
    } catch (err: any) {
      alert(err.message || 'Error submitting job completion.');
    } finally {
      setActionLoading(false);
    }
  };

  // Request new link if expired
  const handleRequestNewLink = async () => {
    if (!cleanToken) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/jobs/${encodeURIComponent(cleanToken)}/request-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'New job link dispatched to your phone!');
      } else {
        alert(data.error || 'Failed to request new link.');
      }
    } catch (e: any) {
      alert(e.message || 'Request failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle photo upload
  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const data = await api.uploadFile(file);
      if (data && data.url) {
        if (type === 'before') {
          setBeforePhotos(prev => [...prev, data.url]);
        } else {
          setAfterPhotos(prev => [...prev, data.url]);
        }
      } else {
        alert('Photo upload failed');
      }
    } catch (err: any) {
      alert(err.message || 'Photo upload error');
    }
  };

  // HTML5 Canvas Drawing Helpers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-brand-400 mb-4" />
        <h2 className="text-lg font-bold">Verifying Job Token...</h2>
        <p className="text-xs text-slate-400 mt-1">Connecting to hotel dispatch system</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black">Job Link Inactive</h2>
        <p className="text-sm text-slate-300 mt-2 max-w-sm leading-relaxed">{error}</p>

        {canRequestNewLink && (
          <button
            onClick={handleRequestNewLink}
            disabled={actionLoading}
            className="mt-6 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            Request New Job Link
          </button>
        )}
      </div>
    );
  }

  const isEmergency = job.priority === 'Emergency';
  const isHigh = job.priority === 'High';

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between font-sans selection:bg-brand-500 selection:text-white">
      {/* Top Mobile Bar */}
      <div className="p-4 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2.5">
          {job.hotelLogo ? (
            <img src={job.hotelLogo} alt="Hotel Logo" className="w-8 h-8 rounded-lg object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-xs font-black">
              OP
            </div>
          )}
          <div>
            <h1 className="text-xs font-black tracking-wide uppercase text-slate-200">{job.hotelName}</h1>
            <p className="text-[10px] text-brand-400 font-bold uppercase tracking-wider">Mobile Job Portal</p>
          </div>
        </div>

        {staff && (
          <div className="flex items-center gap-2">
            <div className="text-right">
              <span className="block text-xs font-bold text-slate-100">{staff.fullName}</span>
              <span className="block text-[10px] text-slate-400">{staff.jobTitle}</span>
            </div>
            <img
              src={staff.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.fullName)}&background=0284c7&color=fff`}
              alt={staff.fullName}
              className="w-8 h-8 rounded-full object-cover border border-brand-400"
            />
          </div>
        )}
      </div>

      {/* Main Job Body */}
      <div className="flex-1 p-4 max-w-md mx-auto w-full space-y-4">
        {/* Emergency Alert Banner */}
        {isEmergency && (
          <div className="bg-rose-600 text-white p-3.5 rounded-2xl flex items-center gap-3 shadow-lg shadow-rose-900/40 animate-pulse">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider">🚨 EMERGENCY JOB</h3>
              <p className="text-[11px] leading-tight text-rose-100 mt-0.5">
                Immediate response required! High priority guest alert.
              </p>
            </div>
          </div>
        )}

        {/* Job Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
          {/* Room & Priority */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {job.buildingName || 'Main Resort'} • {job.floorName || 'Guest Room'}
              </span>
              <h2 className="text-3xl font-black text-white tracking-tight mt-0.5">
                ROOM {job.roomNumber}
              </h2>
            </div>

            <span
              className={`text-xs font-black px-3 py-1.5 rounded-xl uppercase tracking-wider border ${
                isEmergency
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : isHigh
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-brand-500/20 text-brand-400 border-brand-500/30'
              }`}
            >
              {job.priority} Priority
            </span>
          </div>

          {/* Current Status Pill */}
          <div className="p-3 bg-slate-800/80 rounded-2xl flex items-center justify-between border border-slate-700/60">
            <span className="text-xs text-slate-400 font-semibold">Current Job Status:</span>
            <span className="text-xs font-black uppercase tracking-wider text-brand-400">
              ● {job.status}
            </span>
          </div>

          {/* Issue Summary */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Problem</span>
              <p className="text-base font-extrabold text-slate-100 mt-0.5">
                {job.itemsSummary || 'Room Maintenance Requested'}
              </p>
            </div>

            {job.description && (
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Guest Description</span>
                "{job.description}"
              </div>
            )}
          </div>

          {/* Meta: Created & Dispatcher */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
            <div>
              <span className="block text-[10px] font-semibold text-slate-500">Assigned By</span>
              <span className="text-slate-300 font-bold">{job.assignedByName}</span>
            </div>
            <div>
              <span className="block text-[10px] font-semibold text-slate-500">Request Code</span>
              <span className="text-slate-300 font-bold">{job.requestCode}</span>
            </div>
          </div>
        </div>

        {/* Completion Success Card */}
        {completedSuccess && (
          <div className="bg-emerald-950/80 border-2 border-emerald-500/60 p-5 rounded-3xl text-center space-y-2 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto mb-1">
              <Check className="w-7 h-7" />
            </div>
            <h3 className="text-base font-black text-white">Job Completed Successfully!</h3>
            <p className="text-xs text-emerald-200">
              Finished at {completedTime} by {staff?.fullName}.
            </p>
            <p className="text-[11px] text-slate-400">Front Office and guest have been notified in real time.</p>
          </div>
        )}

        {/* ================= COMPLETE JOB FORM ================= */}
        {showCompleteForm && (
          <form onSubmit={handleCompleteJob} className="bg-slate-900 border-2 border-brand-500/60 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Complete Job Report
              </h3>
              <button
                type="button"
                onClick={() => setShowCompleteForm(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            {/* Completion Notes */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Work Performed / Notes *
              </label>
              <textarea
                required
                rows={3}
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="e.g. Cleared condensate drain line and recharged refrigerant. Tested cooling down to 68F."
                className="w-full text-xs p-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            {/* Before & After Photo Uploads */}
            <div className="grid grid-cols-2 gap-3">
              {/* Before Photo */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Before Photo</span>
                {beforePhotos.length > 0 ? (
                  <img src={beforePhotos[0]} alt="Before" className="w-full h-20 object-cover rounded-lg" />
                ) : (
                  <label className="flex flex-col items-center justify-center p-3 border border-dashed border-slate-700 rounded-lg cursor-pointer hover:bg-slate-900 transition-colors">
                    <Camera className="w-5 h-5 text-slate-400 mb-1" />
                    <span className="text-[10px] text-brand-400 font-bold">Snap / Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleUploadPhoto(e, 'before')}
                    />
                  </label>
                )}
              </div>

              {/* After Photo */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">After Photo</span>
                {afterPhotos.length > 0 ? (
                  <img src={afterPhotos[0]} alt="After" className="w-full h-20 object-cover rounded-lg" />
                ) : (
                  <label className="flex flex-col items-center justify-center p-3 border border-dashed border-slate-700 rounded-lg cursor-pointer hover:bg-slate-900 transition-colors">
                    <Camera className="w-5 h-5 text-emerald-400 mb-1" />
                    <span className="text-[10px] text-emerald-400 font-bold">Snap / Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleUploadPhoto(e, 'after')}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Parts Used & Cost */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Parts Used
                </label>
                <input
                  type="text"
                  value={partsUsed}
                  onChange={(e) => setPartsUsed(e.target.value)}
                  placeholder="e.g. Capacitor, Filter"
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Cost ($ Optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={repairCost}
                  onChange={(e) => setRepairCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Guest Signature Pad (Touch HTML5 Canvas) */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <PenTool className="w-3 h-3 text-brand-400" />
                  Guest Signature (Optional)
                </label>
                {hasSignature && (
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="text-[10px] text-rose-400 font-bold hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="border border-slate-800 bg-white rounded-xl overflow-hidden touch-none">
                <canvas
                  ref={canvasRef}
                  width={340}
                  height={110}
                  className="w-full h-28 cursor-crosshair block"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              <p className="text-[10px] text-slate-500 text-center">Guest signs with fingertip on phone screen</p>
            </div>

            {/* Final Complete Button */}
            <button
              type="submit"
              disabled={actionLoading}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-2xl text-sm font-extrabold shadow-xl shadow-emerald-900/50 transition-all flex items-center justify-center gap-2"
            >
              {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              CONFIRM & COMPLETE JOB
            </button>
          </form>
        )}
      </div>

      {/* ================= BOTTOM LARGE WORKFLOW BUTTONS ================= */}
      {!completedSuccess && !showCompleteForm && (
        <div className="p-4 bg-slate-900 border-t border-slate-800 sticky bottom-0 z-20 space-y-2">
          {/* STEP 1: If Assigned or Submitted -> ACCEPT / DECLINE */}
          {(job.status === 'Assigned' || job.status === 'Submitted') && (
            <div className="space-y-2">
              <button
                onClick={() => handleAction('accept')}
                disabled={actionLoading}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-2xl text-base font-black shadow-lg shadow-emerald-900/40 transition-all flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                ACCEPT JOB
              </button>

              <button
                onClick={() => handleAction('decline')}
                disabled={actionLoading}
                className="w-full py-3 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 active:scale-95 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                Decline Job
              </button>
            </div>
          )}

          {/* STEP 2: If Accepted -> I'M ON THE WAY */}
          {job.status === 'Accepted' && (
            <div className="space-y-2">
              <div className="text-center text-xs font-bold text-emerald-400 py-1">
                ✓ ACCEPTED
              </div>
              <button
                onClick={() => handleAction('on-the-way')}
                disabled={actionLoading}
                className="w-full py-4 bg-brand-600 hover:bg-brand-500 active:scale-95 text-white rounded-2xl text-base font-black shadow-lg shadow-brand-900/50 transition-all flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
                I'M ON THE WAY
              </button>
            </div>
          )}

          {/* STEP 3: If On The Way -> ARRIVED */}
          {job.status === 'Technician On The Way' && (
            <div className="space-y-2">
              <div className="text-center text-xs font-bold text-brand-400 py-1">
                📍 ON THE WAY
              </div>
              <button
                onClick={() => handleAction('arrived')}
                disabled={actionLoading}
                className="w-full py-4 bg-amber-600 hover:bg-amber-500 active:scale-95 text-white rounded-2xl text-base font-black shadow-lg shadow-amber-900/50 transition-all flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                ARRIVED AT ROOM
              </button>
            </div>
          )}

          {/* STEP 4: If Arrived -> START WORK */}
          {job.status === 'Arrived' && (
            <div className="space-y-2">
              <div className="text-center text-xs font-bold text-amber-400 py-1">
                ✓ ARRIVED
              </div>
              <button
                onClick={() => handleAction('start')}
                disabled={actionLoading}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-2xl text-base font-black shadow-lg shadow-indigo-900/50 transition-all flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                START WORK
              </button>
            </div>
          )}

          {/* STEP 5: If In Progress -> COMPLETE JOB */}
          {job.status === 'In Progress' && (
            <div className="space-y-2">
              <div className="text-center text-xs font-bold text-indigo-400 py-1">
                🔧 IN PROGRESS
              </div>
              <button
                onClick={() => setShowCompleteForm(true)}
                disabled={actionLoading}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-2xl text-base font-black shadow-lg shadow-emerald-900/50 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                COMPLETE JOB
              </button>
            </div>
          )}

          {/* If already Completed */}
          {job.status === 'Completed' && (
            <div className="p-3 text-center text-xs font-black text-emerald-400 bg-emerald-950/60 rounded-xl border border-emerald-500/30">
              ✓ THIS JOB IS COMPLETED
            </div>
          )}
        </div>
      )}
    </div>
  );
};
