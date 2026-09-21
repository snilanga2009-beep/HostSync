import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import {
  Wrench,
  BellRing,
  Sparkles,
  PhoneCall,
  HeartHandshake,
  AlertTriangle,
  Loader2,
  ChevronRight,
  ShieldAlert,
  Globe,
  Compass
} from 'lucide-react';
import { GuestMaintenanceModal } from './GuestMaintenanceModal';
import { GuestServiceModal } from './GuestServiceModal';
import { GuestTipModal } from './GuestTipModal';

interface GuestRoomData {
  roomToken: string;
  hotel: {
    id: string;
    name: string;
    resortName: string;
    logoUrl?: string;
    phone?: string;
    emergencyContact?: string;
    guestServiceContact?: string;
    currency: string;
  };
  room: {
    id?: string;
    number: string;
    name?: string;
    type?: string;
    building?: string;
    floor?: string;
  };
  facilities: Array<{
    assignment_id: string;
    item_id: string;
    item_name: string;
    category: string;
    icon: string;
    condition_status: string;
  }>;
  serviceStaff: Array<{
    staff_id: string;
    staff_name: string;
    job_title: string;
    department: string;
    avatar_url?: string;
    rating?: number;
  }>;
}

export const GuestRoomHome: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();

  const [data, setData] = useState<GuestRoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);

    api.get<GuestRoomData>(`/guest/room/${token}`)
      .then(res => {
        setData(res);
      })
      .catch((err: any) => {
        setError(err.message || 'Unable to identify room. The QR code may be invalid or expired.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <Loader2 className="w-10 h-10 text-brand-400 animate-spin mb-4" />
        <h2 className="text-lg font-bold">Connecting to your room...</h2>
        <p className="text-xs text-slate-400 mt-1">Please hold on while we verify your in-room key</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4 shadow-lg shadow-rose-100">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900">QR Code Error</h2>
        <p className="text-sm text-slate-600 max-w-sm mt-2 leading-relaxed">{error}</p>
        <div className="mt-6 flex flex-col gap-2 w-full max-w-xs">
          <a
            href="/guest/r/ocean101token"
            className="py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-bold shadow-md transition-colors text-center"
          >
            Try Demo Room 101
          </a>
          <a
            href="/login"
            className="py-2.5 px-4 text-slate-600 hover:text-slate-900 text-xs font-semibold text-center"
          >
            Staff / Front Office Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 flex flex-col">
      {/* Top Luxury Banner */}
      <div className="relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 pt-8 pb-10 px-5 overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Row */}
        <div className="flex items-center justify-between relative z-10 max-w-md mx-auto">
          <div className="flex items-center gap-3">
            {data.hotel.logoUrl ? (
              <img
                src={data.hotel.logoUrl}
                alt={data.hotel.name}
                className="w-10 h-10 rounded-xl object-cover ring-2 ring-white/10"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center font-bold text-white">
                RC
              </div>
            )}
            <div>
              <span className="text-[10px] tracking-widest uppercase font-bold text-brand-400">Guest Portal</span>
              <h3 className="text-sm font-bold text-white truncate max-w-[200px]">{data.hotel.resortName || data.hotel.name}</h3>
            </div>
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700/60 rounded-full px-2.5 py-1 text-xs text-slate-300">
            <Globe className="w-3.5 h-3.5 text-brand-400" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="bg-transparent text-[11px] font-semibold text-white focus:outline-none cursor-pointer uppercase"
            >
              <option value="en" className="bg-slate-900 text-white">EN</option>
              <option value="si" className="bg-slate-900 text-white">සිංහල</option>
              <option value="es" className="bg-slate-900 text-white">ES</option>
              <option value="fr" className="bg-slate-900 text-white">FR</option>
              <option value="ar" className="bg-slate-900 text-white">AR</option>
            </select>
          </div>
        </div>

        {/* Welcome & Room Card */}
        <div className="mt-8 max-w-md mx-auto text-center relative z-10">
          <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
            {t('welcome', 'Welcome to')} {data.hotel.resortName || data.hotel.name}
          </p>
          <div className="mt-2 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/20 border border-brand-500/40 text-brand-300">
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-ping"></span>
            <span className="text-sm font-extrabold tracking-wide uppercase">
              {t('room', 'Room')} {data.room.number}
            </span>
            <span className="text-xs text-brand-400/80">• {data.room.type}</span>
          </div>

          <p className="text-xs text-slate-400 mt-2 font-medium">
            {data.room.building} {data.room.floor ? `• ${data.room.floor}` : ''}
          </p>
        </div>
      </div>

      {/* Main Action Service Cards */}
      <div className="flex-1 bg-slate-50 text-slate-900 rounded-t-[32px] px-5 py-7 shadow-2xl -mt-4 relative z-20">
        <div className="max-w-md mx-auto space-y-4">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-base font-extrabold text-slate-900">
              {t('howCanWeHelp', 'How can we assist you today?')}
            </h3>
            <span className="text-[11px] font-bold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full">
              24/7 Support
            </span>
          </div>

          {/* 1. Room Maintenance */}
          <button
            onClick={() => setMaintenanceOpen(true)}
            className="w-full text-left p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-brand-500 hover:shadow-lg transition-all flex items-center justify-between group shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <Wrench className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  {t('roomMaintenance', 'Room Maintenance')}
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">FAST DISPATCH</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">AC, TV, Hot Water, Lights, Door Lock, etc.</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-brand-600 transition-colors" />
          </button>

          {/* 2. Room Service & Supplies */}
          <button
            onClick={() => setServiceOpen(true)}
            className="w-full text-left p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-brand-500 hover:shadow-lg transition-all flex items-center justify-between group shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
                <BellRing className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {t('roomService', 'Room Supplies & Amenities')}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">Towels, Pillows, Water, Toiletries, Iron</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-brand-600 transition-colors" />
          </button>

          {/* 3. Housekeeping Service */}
          <button
            onClick={() => {
              setServiceOpen(true);
            }}
            className="w-full text-left p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-brand-500 hover:shadow-lg transition-all flex items-center justify-between group shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {t('housekeeping', 'Housekeeping & Cleaning')}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">Daily room makeup, fresh linen, trash pickup</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-brand-600 transition-colors" />
          </button>

          {/* 4. Tip Our Staff */}
          <button
            onClick={() => setTipOpen(true)}
            className="w-full text-left p-4 rounded-2xl bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200/60 hover:border-rose-400 hover:shadow-lg transition-all flex items-center justify-between group shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-500/20 group-hover:scale-105 transition-transform">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  {t('tipRoomStaff', 'Tip Our Staff')}
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">GRATUITY</span>
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">Show appreciation to room boy & technician</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-rose-600 transition-colors" />
          </button>

          {/* 5. Contact Front Office Modal Trigger */}
          <button
            onClick={() => setContactOpen(true)}
            className="w-full text-left p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-400 hover:shadow-md transition-all flex items-center justify-between group shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="w-13 h-13 rounded-2xl bg-slate-800 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <PhoneCall className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {t('contactFrontOffice', 'Contact Front Office')}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">Direct phone call, Concierge & Emergency lines</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-800 transition-colors" />
          </button>

          {/* In-Room Facilities Glance */}
          <div className="pt-4 border-t border-slate-200">
            <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              Equipped In Your Room
            </h5>
            <div className="grid grid-cols-2 gap-2">
              {data.facilities.slice(0, 6).map((fac) => (
                <div
                  key={fac.assignment_id}
                  className="p-2.5 rounded-xl bg-white border border-slate-200/70 flex items-center gap-2 text-xs"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    fac.condition_status === 'Working' ? 'bg-emerald-500' : 'bg-rose-500'
                  }`} />
                  <span className="font-semibold text-slate-800 truncate">{fac.item_name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Note */}
          <p className="text-[11px] text-center text-slate-400 pt-3">
            Need emergency assistance? Dial <strong className="text-slate-700">{data.hotel.emergencyContact || '911'}</strong>
          </p>
        </div>
      </div>

      {/* Maintenance Request Modal */}
      <GuestMaintenanceModal
        isOpen={maintenanceOpen}
        onClose={() => setMaintenanceOpen(false)}
        roomToken={data.roomToken}
        roomNumber={data.room.number}
        facilities={data.facilities}
        onSubmitted={(trackingUrl) => navigate(trackingUrl)}
      />

      {/* Guest Service Modal */}
      <GuestServiceModal
        isOpen={serviceOpen}
        onClose={() => setServiceOpen(false)}
        roomToken={data.roomToken}
        roomNumber={data.room.number}
        onSubmitted={(trackingUrl) => navigate(trackingUrl)}
      />

      {/* Tip Staff Modal */}
      <GuestTipModal
        isOpen={tipOpen}
        onClose={() => setTipOpen(false)}
        roomToken={data.roomToken}
        roomId={data.room.id}
        roomNumber={data.room.number}
        staffMembers={data.serviceStaff}
        currency={data.hotel.currency}
      />

      {/* Contact Modal */}
      {contactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-600 flex items-center justify-center mx-auto mb-3">
              <PhoneCall className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Front Office Contacts</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">Our hospitality team is available 24/7</p>

            <div className="space-y-2.5 mb-5 text-left">
              <a
                href={`tel:${data.hotel.phone || '+13055550100'}`}
                className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-bold text-slate-800 transition-colors"
              >
                <span>Front Desk (General)</span>
                <span className="text-brand-600">{data.hotel.phone || '+1 (305) 555-0100'}</span>
              </a>
              <a
                href={`tel:${data.hotel.guestServiceContact || '+13055550199'}`}
                className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between text-xs font-bold text-slate-800 transition-colors"
              >
                <span>Guest Services & Concierge</span>
                <span className="text-brand-600">{data.hotel.guestServiceContact || '+1 (305) 555-0199'}</span>
              </a>
              <a
                href={`tel:${data.hotel.emergencyContact || '911'}`}
                className="p-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl flex items-center justify-between text-xs font-bold text-rose-800 transition-colors"
              >
                <span>Security / Emergency</span>
                <span className="text-rose-600">{data.hotel.emergencyContact || '911'}</span>
              </a>
            </div>

            <button
              onClick={() => setContactOpen(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
