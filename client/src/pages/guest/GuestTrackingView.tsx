import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge } from '../../components/common/PriorityBadge';
import { GuestTipModal } from './GuestTipModal';
import {
  CheckCircle2,
  Clock,
  Wrench,
  Sparkles,
  PhoneCall,
  HeartHandshake,
  Star,
  ChevronLeft,
  Loader2,
  UserCheck,
  RefreshCw,
  Bell,
  MessageSquare,
  Smartphone
} from 'lucide-react';

interface TrackingData {
  type: 'maintenance' | 'service';
  requestId?: string;
  roomId?: string;
  roomToken?: string;
  requestCode: string;
  status: string;
  roomNumber: string;
  hotelName: string;
  hotelLogo?: string;
  hotelPhone?: string;
  priority?: string;
  description?: string;
  serviceType?: string;
  quantity?: number;
  notes?: string;
  items?: Array<{ item_name: string; problem_type: string; notes?: string }>;
  timeline?: Array<{ status: string; notes?: string; created_at: string }>;
  assignedStaff?: {
    staff_id: string;
    staff_name: string;
    job_title: string;
    department: string;
    avatar_url?: string;
    rating?: number;
  };
  createdAt: string;
  resolvedAt?: string;
}

const STEPS = [
  'Submitted',
  'Received',
  'Assigned',
  'Technician On The Way',
  'In Progress',
  'Completed'
];

export const GuestTrackingView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(5);
  const [rated, setRated] = useState(false);
  const [tipModalOpen, setTipModalOpen] = useState(false);
  const [notifyPhone, setNotifyPhone] = useState('');
  const [notifyChannel, setNotifyChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [notifySaved, setNotifySaved] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);

  const handleSaveConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifyPhone || !token) return;
    setSavingConsent(true);
    try {
      await api.post('/notifications/guest-consent', {
        trackingToken: token,
        roomId: data?.roomNumber,
        phone: notifyPhone,
        whatsappNumber: notifyPhone,
        preferredChannel: notifyChannel,
        smsEnabled: notifyChannel === 'sms',
        whatsappEnabled: notifyChannel === 'whatsapp'
      });
      setNotifySaved(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingConsent(false);
    }
  };

  const fetchStatus = async () => {
    if (!token) return;
    try {
      const res = await api.get<TrackingData>(`/guest/track/${token}`);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Tracking information not found.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    const apiBase = (import.meta.env.VITE_API_BASE as string || '/api').replace(/\/api\/?$/, '');
    const sse = new EventSource(`${apiBase}/api/sse/stream?trackingToken=${encodeURIComponent(token || '')}`);
    sse.addEventListener('STATUS_UPDATED', (e: MessageEvent) => {
      fetchStatus();
    });

    // Polling fallback every 10s
    const timer = setInterval(fetchStatus, 10000);

    return () => {
      sse.close();
      clearInterval(timer);
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 text-brand-400 animate-spin mb-4" />
        <h3 className="text-base font-bold">Checking request status...</h3>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <h3 className="text-lg font-bold text-slate-900">Request Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Calculate current step index
  let currentStepIdx = 0;
  if (data.status === 'Received') currentStepIdx = 1;
  else if (data.status === 'Assigned') currentStepIdx = 2;
  else if (data.status === 'Technician On The Way' || data.status === 'On The Way') currentStepIdx = 3;
  else if (data.status === 'In Progress' || data.status === 'Arrived' || data.status === 'Working') currentStepIdx = 4;
  else if (data.status === 'Completed' || data.status === 'Delivered') currentStepIdx = 5;

  const isCompleted = data.status === 'Completed' || data.status === 'Delivered';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-slate-950 px-5 pt-6 pb-6 border-b border-slate-800">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <div className="text-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-400">Live Request Tracker</span>
            <h2 className="text-sm font-bold text-white">{data.requestCode}</h2>
          </div>
          <button
            onClick={fetchStatus}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            title="Refresh status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content Container */}
      <div className="flex-1 bg-slate-50 text-slate-900 rounded-t-[28px] px-5 py-6 shadow-2xl -mt-2">
        <div className="max-w-md mx-auto space-y-5">
          {/* Status Header Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm text-center">
            <div className="flex justify-center mb-3">
              <StatusBadge status={data.status} />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900">
              {isCompleted ? 'Request Completed!' : `Status: ${data.status}`}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Room <strong className="text-slate-800">{data.roomNumber}</strong> • {data.hotelName}
            </p>

            {data.priority && (
              <div className="mt-2.5">
                <PriorityBadge priority={data.priority} />
              </div>
            )}
          </div>

          {/* Guest Live Notification Preference Banner */}
          {!isCompleted && (
            <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-2 mb-2">
                <Bell className="w-4 h-4 text-brand-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Stay Updated on Progress
                </h4>
              </div>
              {notifySaved ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Updates enabled! We'll send you alerts when your specialist is on the way.</span>
                </div>
              ) : (
                <form onSubmit={handleSaveConsent} className="space-y-2.5">
                  <p className="text-xs text-slate-500">
                    Get an instant SMS or WhatsApp notification when our technician is on the way.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      required
                      value={notifyPhone}
                      onChange={(e) => setNotifyPhone(e.target.value)}
                      placeholder="e.g. +1 305-555-0199"
                      className="flex-1 text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={savingConsent || !notifyPhone}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1 shadow-xs"
                    >
                      {savingConsent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
                      Notify Me
                    </button>
                  </div>
                  <div className="flex items-center gap-4 pt-0.5">
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-medium">
                      <input
                        type="radio"
                        name="guestChannel"
                        checked={notifyChannel === 'whatsapp'}
                        onChange={() => setNotifyChannel('whatsapp')}
                        className="text-brand-600 focus:ring-brand-500"
                      />
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-medium">
                      <input
                        type="radio"
                        name="guestChannel"
                        checked={notifyChannel === 'sms'}
                        onChange={() => setNotifyChannel('sms')}
                        className="text-brand-600 focus:ring-brand-500"
                      />
                      <Smartphone className="w-3.5 h-3.5 text-sky-600" /> SMS
                    </label>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Assigned Technician Profile (if assigned) */}
          {data.assignedStaff && (
            <div className="bg-gradient-to-r from-sky-50 to-brand-50 rounded-2xl p-4 border border-brand-200/70 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3.5">
                <img
                  src={data.assignedStaff.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.assignedStaff.staff_name)}&background=0284c7&color=fff`}
                  alt={data.assignedStaff.staff_name}
                  className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-sm"
                />
                <div>
                  <span className="text-[10px] font-bold text-brand-700 uppercase tracking-wide">Assigned Specialist</span>
                  <h4 className="text-xs font-bold text-slate-900">{data.assignedStaff.staff_name}</h4>
                  <p className="text-[11px] text-slate-600">{data.assignedStaff.job_title}</p>
                </div>
              </div>
              <button
                onClick={() => setTipModalOpen(true)}
                className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1 shrink-0"
              >
                <HeartHandshake className="w-3.5 h-3.5" /> Tip
              </button>
            </div>
          )}

          {/* Live Visual Timeline */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-brand-600" />
              Service Progress Timeline
            </h4>

            <div className="space-y-4 relative pl-3">
              {/* Vertical timeline connector */}
              <div className="absolute top-2 bottom-2 left-5 w-0.5 bg-slate-200" />

              {STEPS.map((step, idx) => {
                const isPassed = idx <= currentStepIdx;
                const isCurrent = idx === currentStepIdx;

                return (
                  <div key={step} className="relative flex items-center gap-3.5 z-10">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                        isPassed
                          ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                          : 'bg-white border-2 border-slate-300 text-slate-400'
                      }`}
                    >
                      {isPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                    </div>
                    <div className="flex-1">
                      <p
                        className={`text-xs ${
                          isCurrent
                            ? 'font-extrabold text-brand-700'
                            : isPassed
                            ? 'font-bold text-slate-800'
                            : 'font-medium text-slate-400'
                        }`}
                      >
                        {step}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Details Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Request Details
            </h4>
            {data.items && data.items.length > 0 && (
              <div className="space-y-1.5">
                {data.items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="font-bold text-slate-800">{it.item_name}</span>
                    <span className="text-rose-600 font-semibold">{it.problem_type}</span>
                  </div>
                ))}
              </div>
            )}
            {data.serviceType && (
              <div className="text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="font-bold text-slate-900">{data.quantity}x {data.serviceType}</span>
                {data.notes && <p className="text-slate-600 mt-1 text-[11px]">{data.notes}</p>}
              </div>
            )}
            {data.description && (
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                "{data.description}"
              </p>
            )}
          </div>

          {/* If Completed: Service Feedback & Tipping Callout */}
          {isCompleted && (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-200 text-center shadow-sm">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-2">
                <Sparkles className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">How was our service?</h4>
              <p className="text-xs text-slate-600 mt-0.5">Please rate your experience with our technician</p>

              {/* 5-Star Rating Buttons */}
              <div className="flex justify-center gap-2 my-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => {
                      setRating(star);
                      setRated(true);
                    }}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= rating
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-200'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {rated && (
                <p className="text-xs font-semibold text-emerald-700 mb-3 animate-fadeIn">
                  Thank you for your 5-star feedback!
                </p>
              )}

              {/* Tip Staff Button */}
              <button
                onClick={() => setTipModalOpen(true)}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-2"
              >
                <HeartHandshake className="w-4 h-4" /> Tip Our Staff Member
              </button>
            </div>
          )}

          {/* Need Immediate Assistance */}
          <div className="text-center pt-2">
            <a
              href={`tel:${data.hotelPhone || '+13055550100'}`}
              className="inline-flex items-center gap-2 text-xs font-bold text-brand-600 hover:text-brand-800"
            >
              <PhoneCall className="w-3.5 h-3.5" /> Call Front Office Directly
            </a>
          </div>
        </div>
      </div>

      {/* Tip Modal */}
      <GuestTipModal
        isOpen={tipModalOpen}
        onClose={() => setTipModalOpen(false)}
        roomToken={data.roomToken || token || ''}
        roomId={data.roomId}
        requestId={data.requestId}
        roomNumber={data.roomNumber}
        staffMembers={data.assignedStaff ? [data.assignedStaff] : [{
          staff_id: 'staff-emp-101',
          staff_name: 'Hotel Service Staff',
          job_title: 'Specialist',
          department: data.type === 'maintenance' ? 'Maintenance' : 'Guest Services'
        }]}
        currency="USD"
      />
    </div>
  );
};
