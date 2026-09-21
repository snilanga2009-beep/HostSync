import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { GuestServiceRequest } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { BellRing, Check, Clock, Loader2, Sparkles, Trash2 } from 'lucide-react';

export const GuestRequestsPage: React.FC = () => {
  const [services, setServices] = useState<GuestServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadServices = async () => {
    try {
      const res = await api.get<{ services: GuestServiceRequest[] }>('/requests/services/list');
      setServices(res.services);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await api.put(`/requests/services/${id}/status`, { status: newStatus });
      await loadServices();
    } catch (e: any) {
      alert(e.message || 'Failed to update service request');
    }
  };

  const handleDeleteService = async (req: GuestServiceRequest) => {
    if (!window.confirm(`Are you sure you want to permanently delete request ${req.request_code} (${req.service_type} for Room ${req.room_number})? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/requests/services/${req.id}`);
      await loadServices();
    } catch (e: any) {
      alert(e.message || 'Failed to delete service request');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Guest Supplies & Service Requests</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Deliver guest amenities, toiletries, extra towels, and housekeeping services
          </p>
        </div>
        <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-xs">
          {services.length} Orders
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Request Code</th>
                <th className="py-3.5 px-4">Room</th>
                <th className="py-3.5 px-4">Amenity / Item</th>
                <th className="py-3.5 px-4">Qty</th>
                <th className="py-3.5 px-4">Guest Instructions</th>
                <th className="py-3.5 px-4">Time</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Quick Dispatch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {services.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No guest supply requests pending.
                  </td>
                </tr>
              ) : (
                services.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{req.request_code}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-extrabold text-[11px]">
                        Room {req.room_number}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-brand-900">
                      {req.service_type}
                    </td>
                    <td className="py-3 px-4 font-extrabold text-slate-900">
                      {req.quantity}x
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {req.notes || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={req.status} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      {req.status !== 'Delivered' && (
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'Delivered')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Mark Delivered
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteService(req)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors inline-flex"
                        title="Delete Request"
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
  );
};
