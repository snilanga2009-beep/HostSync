import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Modal } from './Modal';
import { Room } from '../../types';
import { api } from '../../services/api';
import { Download, Printer, RefreshCw, Eye, EyeOff, Check, ExternalLink, Wifi, Laptop, Globe, Info } from 'lucide-react';

interface QRPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  hotelLogo?: string;
  hotelName?: string;
  onRoomUpdated?: () => void;
}

export const QRPreviewModal: React.FC<QRPreviewModalProps> = ({
  isOpen,
  onClose,
  room,
  hotelLogo = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&auto=format&fit=crop&q=80',
  hotelName = 'Ocean Pearl Resort',
  onRoomUpdated
}) => {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<{ lanIp: string; lanBaseUrl: string } | null>(null);
  const [selectedHost, setSelectedHost] = useState<string>('');
  const [hostMode, setHostMode] = useState<'lan' | 'localhost' | 'custom'>('lan');
  const [customHost, setCustomHost] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Fetch host machine LAN IP for phone camera accessibility
  useEffect(() => {
    api.get<{ lanIp: string; lanBaseUrl: string }>('/hotel/network-info')
      .then(info => {
        setNetworkInfo(info);
        // If accessed from localhost or 127.0.0.1, auto-select LAN IP so phones can scan immediately
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocal && info.lanBaseUrl) {
          setSelectedHost(info.lanBaseUrl);
          setHostMode('lan');
        } else {
          setSelectedHost(window.location.origin);
          setHostMode(isLocal ? 'localhost' : 'custom');
        }
      })
      .catch(() => {
        setSelectedHost(window.location.origin);
      });
  }, []);

  // Compute active guest link for current room and host
  const activeBaseUrl = selectedHost || window.location.origin;
  const guestUrl = room ? `${activeBaseUrl.replace(/\/$/, '')}/guest/r/${room.qr_token}` : '';

  // Generate crisp QR code client-side whenever token or host changes
  useEffect(() => {
    if (!room || !guestUrl) return;

    QRCode.toDataURL(guestUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 440,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    }).then(url => {
      setQrDataUrl(url);
    }).catch(err => {
      console.error('Failed to generate QR client-side', err);
      if (room.qr_data_url) setQrDataUrl(room.qr_data_url);
    });
  }, [room, guestUrl]);

  if (!room) return null;

  const handleDownload = () => {
    const src = qrDataUrl || room.qr_data_url;
    if (!src) return;
    const link = document.createElement('a');
    link.href = src;
    link.download = `QR-Room-${room.room_number}.png`;
    link.click();
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const printQrSrc = qrDataUrl || room.qr_data_url || `${window.location.origin}/api/rooms/${room.id}/qr.png`;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Room ${room.room_number} QR Code</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #fff; }
            .card { width: 340px; border: 2px solid #e2e8f0; border-radius: 24px; padding: 32px 24px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
            .logo { max-height: 50px; margin-bottom: 12px; border-radius: 8px; }
            .hotel-name { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
            .room-badge { display: inline-block; background: #0284c7; color: #fff; padding: 6px 16px; border-radius: 9999px; font-size: 16px; font-weight: 800; letter-spacing: 0.05em; margin-bottom: 20px; }
            .qr-image { width: 220px; height: 220px; margin: 0 auto; display: block; border-radius: 12px; }
            .scan-title { font-size: 15px; font-weight: 700; color: #1e293b; margin-top: 16px; margin-bottom: 4px; }
            .scan-subtitle { font-size: 12px; color: #64748b; line-height: 1.4; }
          </style>
        </head>
        <body>
          <div class="card">
            ${hotelLogo ? `<img src="${hotelLogo}" class="logo" />` : ''}
            <div class="hotel-name">${hotelName}</div>
            <div class="room-badge">ROOM ${room.room_number}</div>
            <img src="${printQrSrc}" class="qr-image" />
            <div class="scan-title">Scan for Guest Services</div>
            <div class="scan-subtitle">Need assistance, maintenance, or room supplies?<br/>Scan with your camera.</div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleRegenerate = async () => {
    if (!confirm('Are you sure you want to regenerate this QR code? The previous token will immediately stop working.')) return;
    setLoading(true);
    try {
      const res = await api.post<any>(`/rooms/${room.id}/regenerate-qr`);
      if (res.qrDataUrl) {
        setQrDataUrl(res.qrDataUrl);
      }
      if (onRoomUpdated) onRoomUpdated();
      onClose();
    } catch (e: any) {
      alert(e.message || 'Failed to regenerate QR');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async () => {
    setLoading(true);
    try {
      await api.post(`/rooms/${room.id}/toggle-qr`);
      if (onRoomUpdated) onRoomUpdated();
    } catch (e: any) {
      alert(e.message || 'Failed to toggle QR');
    } finally {
      setLoading(false);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(guestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayQr = qrDataUrl || room.qr_data_url;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Room ${room.room_number} QR Code`} subtitle={room.name || 'In-Room Access Card'}>
      <div className="flex flex-col items-center">
        {/* Network & Host Selector for Mobile Phone Scanning */}
        <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 mb-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Wifi className="w-4 h-4 text-emerald-600" />
              Target Host (For Mobile Camera Scanning)
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {networkInfo?.lanIp || 'Wi-Fi Ready'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/70 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setHostMode('lan');
                if (networkInfo?.lanBaseUrl) setSelectedHost(networkInfo.lanBaseUrl);
              }}
              className={`py-1.5 px-2 rounded-lg text-center transition-all truncate flex items-center justify-center gap-1 ${
                hostMode === 'lan' ? 'bg-white text-slate-900 shadow-xs font-extrabold text-brand-700' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Recommended: Allows physical phones on your Wi-Fi to scan and open instantly"
            >
              <Wifi className="w-3 h-3 text-emerald-600 shrink-0" />
              <span className="truncate">Mobile Wi-Fi</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setHostMode('localhost');
                setSelectedHost(window.location.origin);
              }}
              className={`py-1.5 px-2 rounded-lg text-center transition-all truncate flex items-center justify-center gap-1 ${
                hostMode === 'localhost' ? 'bg-white text-slate-900 shadow-xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="PC only: Phones cannot connect to localhost"
            >
              <Laptop className="w-3 h-3 text-slate-500 shrink-0" />
              <span className="truncate">Localhost</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setHostMode('custom');
                if (customHost) setSelectedHost(customHost);
              }}
              className={`py-1.5 px-2 rounded-lg text-center transition-all truncate flex items-center justify-center gap-1 ${
                hostMode === 'custom' ? 'bg-white text-slate-900 shadow-xs font-extrabold text-indigo-700' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Custom domain, ngrok, or production URL"
            >
              <Globe className="w-3 h-3 text-indigo-500 shrink-0" />
              <span className="truncate">Custom</span>
            </button>
          </div>

          {hostMode === 'custom' && (
            <div className="flex gap-2">
              <input
                type="text"
                value={customHost}
                onChange={(e) => {
                  setCustomHost(e.target.value);
                  setSelectedHost(e.target.value);
                }}
                placeholder="e.g. https://hotelapp.com or http://192.168.x.x:5173"
                className="w-full text-xs p-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none font-mono"
              />
            </div>
          )}

          {hostMode === 'lan' && (
            <div className="flex items-start gap-1.5 text-[11px] text-emerald-800 bg-emerald-50/80 p-2 rounded-xl border border-emerald-200/60">
              <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Phone Camera Ready:</strong> Encoded for your Wi-Fi network at <code className="font-mono bg-white px-1 py-0.5 rounded text-emerald-900 font-bold">{networkInfo?.lanIp || '192.168.1.12'}:5173</code>. Phones on the same Wi-Fi will open the portal instantly.
              </span>
            </div>
          )}

          {hostMode === 'localhost' && (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 p-2 rounded-xl border border-amber-200">
              <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Notice:</strong> <code className="font-mono">localhost</code> only opens on this computer. Phones scanning this code will fail because they search their own device for localhost. Use <strong>Mobile Wi-Fi</strong> for phone scanning.
              </span>
            </div>
          )}
        </div>

        {/* Printable Card Preview */}
        <div className="w-full max-w-xs bg-gradient-to-b from-slate-50 to-white rounded-2xl p-6 border border-slate-200 shadow-soft text-center mb-6">
          <div className="flex justify-center mb-2">
            <span className="px-3 py-1 bg-brand-500 text-white rounded-full text-xs font-extrabold tracking-wider uppercase">
              Room {room.room_number}
            </span>
          </div>

          <h4 className="text-sm font-bold text-slate-900 mb-4">{hotelName}</h4>

          <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-inner inline-block mx-auto min-w-[190px] min-h-[190px] flex items-center justify-center">
            {displayQr ? (
              <img
                src={displayQr}
                alt={`QR Room ${room.room_number}`}
                className="w-44 h-44 object-contain mx-auto"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `/api/rooms/${room.id}/qr.png`;
                }}
              />
            ) : (
              <img
                src={`/api/rooms/${room.id}/qr.png`}
                alt={`QR Room ${room.room_number}`}
                className="w-44 h-44 object-contain mx-auto"
              />
            )}
          </div>

          <p className="text-xs font-bold text-slate-800 mt-3">Scan for Guest Services</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Point smartphone camera to request maintenance or supplies</p>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Total Scans: <strong className="text-slate-800">{room.qr_scans || 0}</strong></span>
            <span>Status: <strong className={room.qr_active === 1 ? 'text-emerald-600' : 'text-rose-600'}>{room.qr_active === 1 ? 'Active' : 'Disabled'}</strong></span>
          </div>
        </div>

        {/* Public URL & Copy */}
        <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mb-5 flex items-center justify-between gap-2">
          <div className="truncate text-xs font-mono text-slate-600 select-all">{guestUrl}</div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={copyUrl}
              className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors flex items-center gap-1"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : null}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <a
              href={guestUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1 text-slate-500 hover:text-brand-600 rounded-lg hover:bg-slate-100"
              title="Open Guest View"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 w-full">
          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" /> Download PNG
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" /> Print Card
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full mt-3">
          <button
            onClick={handleToggleActive}
            disabled={loading}
            className={`flex items-center justify-center gap-2 py-2 px-3 border rounded-xl text-xs font-semibold transition-colors ${
              room.qr_active === 1
                ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            {room.qr_active === 1 ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {room.qr_active === 1 ? 'Disable QR' : 'Enable QR'}
          </button>

          <button
            onClick={handleRegenerate}
            disabled={loading}
            className="flex items-center justify-center gap-2 py-2 px-3 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Regenerate
          </button>
        </div>
      </div>
    </Modal>
  );
};
