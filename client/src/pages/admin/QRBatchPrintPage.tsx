import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Printer, Download, QrCode, Sparkles, Loader2 } from 'lucide-react';

interface BatchQRResponse {
  hotel: {
    name: string;
    resort_name?: string;
    logo_url?: string;
  };
  rooms: Array<{
    id: string;
    room_number: string;
    room_name?: string;
    room_type_name?: string;
    building_name?: string;
    floor_name?: string;
    qr_token: string;
    qr_data_url: string;
  }>;
  instructions: string;
  subInstructions: string;
}

export const QRBatchPrintPage: React.FC = () => {
  const [data, setData] = useState<BatchQRResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<BatchQRResponse>('/rooms/qr/printable-sheet')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Controls Bar (Hidden during print) */}
      <div className="no-print bg-white p-6 rounded-2xl border border-slate-200 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand-600 font-bold text-xs uppercase tracking-wider mb-1">
            <QrCode className="w-4 h-4" /> In-Room Amenity QR System
          </div>
          <h2 className="text-lg font-extrabold text-slate-900">Printable Room QR Key Sheet</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Display cards ready for printing on cardstock, acrylic stands, or in-room tent cards ({data.rooms.length} Rooms)
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2"
        >
          <Printer className="w-4 h-4" />
          <span>Print Complete Sheet</span>
        </button>
      </div>

      {/* Cards Grid (Formatted for both screen preview and print layout) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4">
        {data.rooms.map((room) => (
          <div
            key={room.id}
            className="bg-white rounded-3xl p-6 border-2 border-slate-200 shadow-soft text-center flex flex-col items-center justify-between transition-all break-inside-avoid print:border-slate-300 print:shadow-none"
            style={{ pageBreakInside: 'avoid' }}
          >
            {/* Card Header */}
            <div className="w-full mb-3">
              {data.hotel.logo_url ? (
                <img
                  src={data.hotel.logo_url}
                  alt={data.hotel.name}
                  className="h-10 mx-auto object-contain rounded-lg mb-2"
                />
              ) : null}
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                {data.hotel.resort_name || data.hotel.name}
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">
                {room.building_name || 'Main Wing'} • {room.floor_name || 'Floor 1'}
              </p>
            </div>

            {/* Room Badge */}
            <div className="my-2 inline-flex items-center px-4 py-1.5 rounded-full bg-brand-600 text-white shadow-xs">
              <span className="text-sm font-black tracking-wider uppercase">
                ROOM {room.room_number}
              </span>
            </div>

            {/* High-Resolution QR Code */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 my-3">
              <img
                src={room.qr_data_url}
                alt={`Room ${room.room_number} QR`}
                className="w-44 h-44 object-contain mx-auto"
              />
            </div>

            {/* Footer Instructions */}
            <div className="w-full pt-2">
              <h4 className="text-xs font-bold text-slate-900">{data.instructions}</h4>
              <p className="text-[10px] text-slate-500 mt-1 max-w-[240px] mx-auto leading-tight">
                {data.subInstructions}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
