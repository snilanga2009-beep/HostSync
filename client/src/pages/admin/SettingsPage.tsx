import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useBranding } from '../../context/BrandingContext';
import {
  Settings,
  Building,
  CreditCard,
  Bell,
  CheckCircle2,
  Shield,
  Save,
  Loader2,
  Lock,
  Sparkles,
  MessageSquare,
  Database,
  Download,
  HardDrive,
  FileJson,
  Upload,
  RefreshCw
} from 'lucide-react';
import { NotificationGatewaySettings } from '../../components/admin/NotificationGatewaySettings';

interface BackupInfo {
  engine: string;
  filePath: string;
  sizeFormatted: string;
  lastModified: string | null;
  tablesCount: number;
  counts: {
    rooms: number;
    requests: number;
    users: number;
    staff: number;
    tips: number;
  };
}

export const SettingsPage: React.FC = () => {
  const branding = useBranding();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTabParam = searchParams.get('tab');

  const getInitialTab = (): 'branding' | 'payments' | 'gateways' | 'notifications' | 'backup' => {
    if (currentTabParam === 'gateways' || currentTabParam === 'sms-whatsapp' || currentTabParam === 'providers') return 'gateways';
    if (currentTabParam === 'payments') return 'payments';
    if (currentTabParam === 'notifications') return 'notifications';
    if (currentTabParam === 'backup') return 'backup';
    return 'branding';
  };

  const [activeTab, setActiveTab] = useState<'branding' | 'payments' | 'gateways' | 'notifications' | 'backup'>(getInitialTab);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Backup state
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null);
  const [loadingBackup, setLoadingBackup] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Sync tab with URL search params if user navigates via sidebar or browser buttons
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'gateways' || tabParam === 'sms-whatsapp' || tabParam === 'providers') {
      setActiveTab('gateways');
    } else if (tabParam === 'payments') {
      setActiveTab('payments');
    } else if (tabParam === 'notifications') {
      setActiveTab('notifications');
    } else if (tabParam === 'backup') {
      setActiveTab('backup');
      loadBackupInfo();
    } else if (tabParam === 'branding' || !tabParam) {
      setActiveTab('branding');
    }
  }, [searchParams]);

  // Branding State
  const [productName, setProductName] = useState('ResortCare');
  const [subtitle, setSubtitle] = useState('Smart Guest Service & Room Maintenance Platform');
  const [hotelName, setHotelName] = useState('Ocean Pearl Resort & Spa');
  const [resortName, setResortName] = useState('Ocean Pearl Resort');
  const [logoUrl, setLogoUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [guestServicePhone, setGuestServicePhone] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [timezone, setTimezone] = useState('America/New_York');

  // Payment Gateway State
  const [paymentProvider, setPaymentProvider] = useState('square');
  const [paymentEnv, setPaymentEnv] = useState('sandbox');
  const [squareAppId, setSquareAppId] = useState('sandbox-sq0idb-oceanpearl-demo');
  const [squareLocationId, setSquareLocationId] = useState('LOC_OCEAN_PEARL_MAIN');
  const [squareWebhookKey, setSquareWebhookKey] = useState('sandbox_secret_key');
  const [sandboxSimulatorEnabled, setSandboxSimulatorEnabled] = useState(true);

  // Notification Settings State
  const [inAppSound, setInAppSound] = useState(true);
  const [frontOfficeAlerts, setFrontOfficeAlerts] = useState(true);
  const [technicianAlerts, setTechnicianAlerts] = useState(true);

  useEffect(() => {
    api.get<{ settings: any }>('/settings')
      .then((res) => {
        const s = res.settings;
        if (s.branding?.identity) {
          const b = s.branding.identity;
          setProductName(b.productName || 'ResortCare');
          setSubtitle(b.subtitle || 'Smart Guest Service & Room Maintenance Platform');
          setHotelName(b.hotelName || 'Ocean Pearl Resort & Spa');
          setResortName(b.resortName || 'Ocean Pearl Resort');
          setLogoUrl(b.logoUrl || '');
          setPhone(b.contactPhone || '');
          setEmergencyPhone(b.emergencyPhone || '');
          setCurrency(b.currency || 'USD');
          setTimezone(b.timezone || 'America/New_York');
        }
        if (s.payments?.gateway) {
          const p = s.payments.gateway;
          setPaymentProvider(p.provider || 'square');
          setPaymentEnv(p.environment || 'sandbox');
          setSquareAppId(p.applicationId || '');
          setSquareLocationId(p.locationId || '');
          setSandboxSimulatorEnabled(p.sandboxSimulatorEnabled !== false);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const loadBackupInfo = async () => {
    setLoadingBackup(true);
    try {
      const res = await api.get<BackupInfo>('/settings/backup/info');
      setBackupInfo(res);
    } catch (err) {
      console.error('Failed to load backup info', err);
    } finally {
      setLoadingBackup(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const uploadRes = await api.uploadFile(file);
      if (uploadRes.success && uploadRes.url) {
        setLogoUrl(uploadRes.url);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to upload logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDownloadBackup = () => {
    const token = localStorage.getItem('resortcare_token') || '';
    const url = `/api/settings/backup/download${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `resortcare_backup_${new Date().toISOString().slice(0, 10)}.db`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJson = () => {
    const token = localStorage.getItem('resortcare_token') || '';
    const url = `/api/settings/backup/export-json${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `resortcare_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    try {
      if (activeTab === 'branding') {
        await api.put('/settings/branding/identity', {
          productName,
          subtitle,
          hotelName,
          resortName,
          logoUrl,
          contactPhone: phone,
          emergencyPhone,
          currency,
          timezone
        });
        branding.updateBranding({
          productName,
          subtitle,
          hotelName,
          resortName,
          logoUrl,
          currency,
          phone
        });
        await branding.refreshBranding();
      } else if (activeTab === 'payments') {
        await api.put('/settings/payments/gateway', {
          provider: paymentProvider,
          environment: paymentEnv,
          applicationId: squareAppId,
          locationId: squareLocationId,
          sandboxSimulatorEnabled
        });
      } else if (activeTab === 'notifications') {
        await api.put('/settings/notifications/channels', {
          inAppSound,
          frontOfficeAlerts,
          technicianAlerts
        });
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (e: any) {
      alert(e.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTabClick = (tab: 'branding' | 'payments' | 'gateways' | 'notifications' | 'backup') => {
    setActiveTab(tab);
    setSearchParams({ tab });
    if (tab === 'backup') {
      loadBackupInfo();
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-600" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${activeTab === 'gateways' ? 'max-w-5xl' : 'max-w-3xl'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">System & Hotel Settings</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure system branding, payment gateway integrations, SMS & WhatsApp notification gateways, and real-time alerts
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl flex-wrap">
          <button
            type="button"
            onClick={() => handleTabClick('branding')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'branding' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Branding & Resort
          </button>
          <button
            type="button"
            onClick={() => handleTabClick('payments')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'payments' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Square / Payments
          </button>
          <button
            type="button"
            onClick={() => handleTabClick('gateways')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'gateways' ? 'bg-white text-brand-700 shadow-xs ring-1 ring-brand-500/20' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-brand-600" />
            SMS & WhatsApp Gateway
          </button>
          <button
            type="button"
            onClick={() => handleTabClick('notifications')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'notifications' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Notifications
          </button>
          <button
            type="button"
            onClick={() => handleTabClick('backup')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'backup' ? 'bg-white text-brand-700 shadow-xs ring-1 ring-brand-500/20' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-brand-600" />
            Database Backup
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Configuration saved and applied successfully.</span>
        </div>
      )}

      {activeTab === 'gateways' ? (
        <NotificationGatewaySettings />
      ) : activeTab === 'backup' ? (
        <div className="space-y-6">
          {/* Main Download & Action Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shrink-0">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900">Database Snapshot & Backup Vault</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Live & Healthy
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    1-click point-in-time SQLite snapshot download. Safe WAL truncation ensures zero data loss and zero downtime.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={loadBackupInfo}
                disabled={loadingBackup}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingBackup ? 'animate-spin text-brand-600' : 'text-slate-500'}`} />
                <span>Refresh Status</span>
              </button>
            </div>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Database Size</div>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {backupInfo ? backupInfo.sizeFormatted : '...'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">SQLite 3 WAL Engine</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Rooms</div>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {backupInfo ? backupInfo.counts.rooms : '...'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Guest rooms configured</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Guest Requests</div>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {backupInfo ? backupInfo.counts.requests : '...'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Jobs & service tickets</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Users & Staff</div>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {backupInfo ? (backupInfo.counts.users + backupInfo.counts.staff) : '...'}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {backupInfo ? `${backupInfo.counts.users} users, ${backupInfo.counts.staff} staff` : 'Profiles registered'}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-brand-200 bg-brand-50/40 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-brand-600" />
                    <h4 className="text-xs font-bold text-slate-900">Download Complete Database (.db)</h4>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Full SQLite snapshot including all tables, user credentials, rooms, maintenance tickets, staff assignments, and guest gratuities.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-600/20 transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download SQLite File (.db)</span>
                </button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-slate-700" />
                    <h4 className="text-xs font-bold text-slate-900">Export as Human-Readable JSON (.json)</h4>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Formatted JSON export containing every database table as structured arrays. Ideal for spreadsheet imports, analytics, and external integrations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-slate-200"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  <span>Export Database JSON (.json)</span>
                </button>
              </div>
            </div>

            {/* Instruction / Recovery Notes */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Shield className="w-4 h-4 text-brand-600" />
                <span>How to Restore or Inspect Your Backup</span>
              </div>
              <ul className="text-[11px] text-slate-600 space-y-1.5 list-disc list-inside leading-relaxed">
                <li>
                  <strong>Inspection:</strong> Open the downloaded <code className="px-1 py-0.5 bg-slate-200/70 rounded text-[10px] font-mono">.db</code> file directly in any free tool like <a href="https://sqlitebrowser.org/" target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">DB Browser for SQLite</a> or DBeaver.
                </li>
                <li>
                  <strong>Server Recovery:</strong> To restore this database on your server, simply stop the server, copy the downloaded file to <code className="px-1 py-0.5 bg-slate-200/70 rounded text-[10px] font-mono">server/src/db/resortcare.db</code>, and restart.
                </li>
                <li>
                  <strong>Zero-Downtime:</strong> The SQLite backup API operates non-blockingly while hotel operations continue uninterrupted.
                </li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-soft p-6 space-y-5">
        {activeTab === 'branding' && (
          <>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Branding & Product Identity
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Product Name</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Product Subtitle</label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Hotel Full Name</label>
                <input
                  type="text"
                  value={hotelName}
                  onChange={(e) => setHotelName(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Resort Display Name</label>
                <input
                  type="text"
                  value={resortName}
                  onChange={(e) => setResortName(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Hotel & Brand Logo</label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 bg-white p-1.5 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <Building className="w-7 h-7 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 w-full space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://example.com/logo.png or upload a local file..."
                      className="flex-1 text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => setLogoUrl('')}
                        className="px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-colors">
                      {uploadingLogo ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      <span>{uploadingLogo ? 'Uploading image...' : 'Upload Image File'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        onChange={handleLogoUpload}
                        disabled={uploadingLogo}
                        className="hidden"
                      />
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Supports PNG, JPG, SVG, WebP (Displayed on sidebar, login & guest views)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">General Contact Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Emergency Security Hotline</label>
                <input
                  type="text"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Currency Code</label>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Timezone</label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </>
        )}

        {activeTab === 'payments' && (
          <>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Square Payments Architecture
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Server Secrets Guarded
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed">
              ResortCare integrates directly with the Square Checkout and Payments API for secure guest tipping.
              Secret API keys are stored only in server-side environment variables and never exposed to client browsers.
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Provider</label>
                <select
                  value={paymentProvider}
                  onChange={(e) => setPaymentProvider(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none font-bold"
                >
                  <option value="square">Square Official API</option>
                  <option value="stripe">Stripe (Extensible)</option>
                  <option value="custom">Custom Merchant Gateway</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Environment</label>
                <select
                  value={paymentEnv}
                  onChange={(e) => setPaymentEnv(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none font-bold"
                >
                  <option value="sandbox">Sandbox (Testing / Demo Mode)</option>
                  <option value="production">Production (Live Payments)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Square Application ID</label>
                <input
                  type="text"
                  value={squareAppId}
                  onChange={(e) => setSquareAppId(e.target.value)}
                  className="w-full text-xs font-mono p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Square Location ID</label>
                <input
                  type="text"
                  value={squareLocationId}
                  onChange={(e) => setSquareLocationId(e.target.value)}
                  className="w-full text-xs font-mono p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-amber-900">Enable Built-in Sandbox Simulator</h4>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Allows testers & guests to simulate card checkout and webhook confirmation without requiring live API keys.
                </p>
              </div>
              <input
                type="checkbox"
                checked={sandboxSimulatorEnabled}
                onChange={(e) => setSandboxSimulatorEnabled(e.target.checked)}
                className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 cursor-pointer"
              />
            </div>
          </>
        )}

        {activeTab === 'notifications' && (
          <>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Dispatch & Sound Alerts
            </h3>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Synthesized Alert Chime</span>
                  <span className="text-[11px] text-slate-500">Play web-audio tone when new guest requests arrive</span>
                </div>
                <input
                  type="checkbox"
                  checked={inAppSound}
                  onChange={(e) => setInAppSound(e.target.checked)}
                  className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Front Desk Real-Time Banner</span>
                  <span className="text-[11px] text-slate-500">Flash urgent banner for emergency and high priority issues</span>
                </div>
                <input
                  type="checkbox"
                  checked={frontOfficeAlerts}
                  onChange={(e) => setFrontOfficeAlerts(e.target.checked)}
                  className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Technician Task Dispatch Alerts</span>
                  <span className="text-[11px] text-slate-500">Notify assigned technicians instantaneously via SSE push</span>
                </div>
                <input
                  type="checkbox"
                  checked={technicianAlerts}
                  onChange={(e) => setTechnicianAlerts(e.target.checked)}
                  className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500 cursor-pointer"
                />
              </label>
            </div>
          </>
        )}

        <div className="pt-2 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-600/20 transition-colors flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Settings</span>
          </button>
        </div>
      </form>
      )}
    </div>
  );
};
