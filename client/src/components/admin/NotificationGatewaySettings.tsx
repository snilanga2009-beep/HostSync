import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  Smartphone,
  MessageSquare,
  Send,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Loader2,
  ExternalLink,
  Sliders,
  AlertTriangle,
  Zap,
  PhoneCall,
  Save,
  Info
} from 'lucide-react';

export const NotificationGatewaySettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState<string | null>(null);

  // Mode: 'live' | 'simulator'
  const [mode, setMode] = useState<'live' | 'simulator'>('simulator');

  // Twilio SMS
  const [twilioEnabled, setTwilioEnabled] = useState(false);
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioPhone, setTwilioPhone] = useState('');
  const [hasStoredTwilioAuth, setHasStoredTwilioAuth] = useState(false);
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [verifyingTwilio, setVerifyingTwilio] = useState(false);
  const [twilioVerifyResult, setTwilioVerifyResult] = useState<{ success: boolean; message: string } | null>(null);

  // WhatsApp Provider Selection: 'direct_meta' | 'twilio' | 'simulator'
  const [whatsappProvider, setWhatsappProvider] = useState<'direct_meta' | 'twilio' | 'simulator'>('direct_meta');
  const [autoFallbackToSms, setAutoFallbackToSms] = useState(true);

  // Direct WhatsApp (Meta Cloud API)
  const [metaEnabled, setMetaEnabled] = useState(true);
  const [metaPhoneId, setMetaPhoneId] = useState('');
  const [metaWabaId, setMetaWabaId] = useState('');
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [hasStoredMetaToken, setHasStoredMetaToken] = useState(false);
  const [showMetaToken, setShowMetaToken] = useState(false);
  const [metaDisplayPhone, setMetaDisplayPhone] = useState('');
  const [metaTemplateName, setMetaTemplateName] = useState('resortcare_job_dispatch');
  const [metaTemplateLang, setMetaTemplateLang] = useState('en_US');
  const [metaVerifyToken, setMetaVerifyToken] = useState('resortcare_webhook_secret_2026');
  const [verifyingMeta, setVerifyingMeta] = useState(false);
  const [metaVerifyResult, setMetaVerifyResult] = useState<{ success: boolean; message: string } | null>(null);

  // Twilio WhatsApp
  const [twilioWaSender, setTwilioWaSender] = useState('whatsapp:+14155238886');
  const [twilioWaContentSid, setTwilioWaContentSid] = useState('');

  // Live Test Dispatcher
  const [testPhone, setTestPhone] = useState('');
  const [testChannel, setTestChannel] = useState<'sms' | 'whatsapp'>('whatsapp');
  const [testMessage, setTestMessage] = useState('');
  const [testingSend, setTestingSend] = useState(false);
  const [testSendResult, setTestSendResult] = useState<{ success: boolean; message: string } | null>(null);

  // Webhooks
  const [webhooks, setWebhooks] = useState({
    twilioStatusUrl: '',
    whatsappWebhookUrl: ''
  });

  const loadSettings = async () => {
    try {
      const res = await api.get<any>('/settings/notifications/providers');
      setMode(res.mode || 'simulator');

      if (res.twilioSms) {
        setTwilioEnabled(Boolean(res.twilioSms.enabled));
        setTwilioAccountSid(res.twilioSms.accountSid || '');
        setTwilioPhone(res.twilioSms.phoneNumber || '');
        setHasStoredTwilioAuth(Boolean(res.twilioSms.hasAuthToken));
        if (res.twilioSms.hasAuthToken) {
          setTwilioAuthToken('••••••••••••');
        }
      }

      if (res.whatsapp) {
        setWhatsappProvider(res.whatsapp.provider || 'direct_meta');
        setAutoFallbackToSms(res.whatsapp.autoFallbackToSms !== false);

        if (res.whatsapp.meta) {
          setMetaEnabled(Boolean(res.whatsapp.meta.enabled));
          setMetaPhoneId(res.whatsapp.meta.phoneNumberId || '');
          setMetaWabaId(res.whatsapp.meta.wabaId || '');
          setMetaDisplayPhone(res.whatsapp.meta.displayPhoneNumber || '');
          setMetaTemplateName(res.whatsapp.meta.templateName || 'resortcare_job_dispatch');
          setMetaTemplateLang(res.whatsapp.meta.templateLanguage || 'en_US');
          setMetaVerifyToken(res.whatsapp.meta.verifyToken || 'resortcare_webhook_secret_2026');
          setHasStoredMetaToken(Boolean(res.whatsapp.meta.hasAccessToken));
          if (res.whatsapp.meta.hasAccessToken) {
            setMetaAccessToken('••••••••••••');
          }
        }

        if (res.whatsapp.twilio) {
          setTwilioWaSender(res.whatsapp.twilio.whatsappSender || 'whatsapp:+14155238886');
          setTwilioWaContentSid(res.whatsapp.twilio.contentTemplateSid || '');
        }
      }

      const currentOrigin = window.location.origin;
      const apiOrigin = currentOrigin.includes(':5173') ? currentOrigin.replace(':5173', ':5000') : currentOrigin;
      setWebhooks({
        twilioStatusUrl: res.webhooks?.twilioStatusUrl || `${apiOrigin}/api/webhooks/twilio/status`,
        whatsappWebhookUrl: res.webhooks?.whatsappWebhookUrl || `${apiOrigin}/api/webhooks/whatsapp`
      });
    } catch (e) {
      console.error('Failed to load notification provider settings', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedWebhook(id);
    setTimeout(() => setCopiedWebhook(null), 2500);
  };

  const handleVerifyTwilio = async () => {
    setVerifyingTwilio(true);
    setTwilioVerifyResult(null);
    try {
      const res = await api.post<any>('/settings/notifications/verify-twilio', {
        accountSid: twilioAccountSid,
        authToken: twilioAuthToken.startsWith('••••') ? '' : twilioAuthToken
      });
      setTwilioVerifyResult({
        success: true,
        message: `Connected successfully to "${res.friendlyName}" (Status: ${res.status}, Type: ${res.type})`
      });
    } catch (err: any) {
      setTwilioVerifyResult({
        success: false,
        message: err.message || 'Twilio verification failed. Check Account SID and Auth Token.'
      });
    } finally {
      setVerifyingTwilio(false);
    }
  };

  const handleVerifyMeta = async () => {
    setVerifyingMeta(true);
    setMetaVerifyResult(null);
    try {
      const res = await api.post<any>('/settings/notifications/verify-whatsapp', {
        phoneNumberId: metaPhoneId,
        accessToken: metaAccessToken.startsWith('••••') ? '' : metaAccessToken
      });
      setMetaVerifyResult({
        success: true,
        message: `Verified: "${res.verifiedName}" (Number: ${res.displayPhoneNumber}, Quality: ${res.qualityRating})`
      });
    } catch (err: any) {
      setMetaVerifyResult({
        success: false,
        message: err.message || 'Meta WhatsApp verification failed. Check Phone Number ID and Access Token.'
      });
    } finally {
      setVerifyingMeta(false);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone) return;
    setTestingSend(true);
    setTestSendResult(null);
    try {
      const res = await api.post<any>('/settings/notifications/send-test', {
        channel: testChannel,
        recipientPhone: testPhone,
        message: testMessage || undefined
      });
      if (res.success) {
        setTestSendResult({
          success: true,
          message: `Test ${testChannel.toUpperCase()} successfully dispatched! Provider: ${res.result?.provider}, Status: ${res.result?.status}`
        });
      } else {
        setTestSendResult({
          success: false,
          message: res.result?.errorMessage || 'Delivery test failed.'
        });
      }
    } catch (err: any) {
      setTestSendResult({
        success: false,
        message: err.message || `Failed to send test ${testChannel}`
      });
    } finally {
      setTestingSend(false);
    }
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      await api.put('/settings/notifications/providers', {
        mode,
        twilioSms: {
          enabled: twilioEnabled,
          accountSid: twilioAccountSid,
          authToken: twilioAuthToken.startsWith('••••') ? '' : twilioAuthToken,
          phoneNumber: twilioPhone
        },
        whatsapp: {
          provider: whatsappProvider,
          autoFallbackToSms,
          meta: {
            enabled: metaEnabled,
            phoneNumberId: metaPhoneId,
            wabaId: metaWabaId,
            accessToken: metaAccessToken.startsWith('••••') ? '' : metaAccessToken,
            displayPhoneNumber: metaDisplayPhone,
            templateName: metaTemplateName,
            templateLanguage: metaTemplateLang,
            verifyToken: metaVerifyToken
          },
          twilio: {
            whatsappSender: twilioWaSender,
            contentTemplateSid: twilioWaContentSid
          }
        }
      });

      setSaveSuccess(true);
      await loadSettings();
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to save notification provider configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-400 flex flex-col items-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600 mb-2" />
        <p className="text-xs font-semibold">Loading SMS & WhatsApp gateway configurations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold flex items-center gap-2 animate-fadeIn shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Gateway configuration successfully saved. New jobs will use the active provider settings immediately.</span>
        </div>
      )}

      {/* Mode Switcher Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-brand-600" />
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              Gateway Operating Mode
            </h3>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
            mode === 'live' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
          }`}>
            {mode === 'live' ? 'Live Production Mode' : 'Sandbox Simulator Mode'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div
            onClick={() => setMode('live')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
              mode === 'live'
                ? 'border-brand-600 bg-brand-50/50 shadow-xs'
                : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <Zap className={`w-5 h-5 shrink-0 mt-0.5 ${mode === 'live' ? 'text-brand-600' : 'text-slate-400'}`} />
            <div>
              <h4 className="text-xs font-bold text-slate-900">Live Production Gateway</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Connects directly to Twilio REST API and Meta WhatsApp Cloud API to deliver real messages to staff mobile phones.
              </p>
            </div>
          </div>

          <div
            onClick={() => setMode('simulator')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
              mode === 'simulator'
                ? 'border-amber-500 bg-amber-50/50 shadow-xs'
                : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <ShieldCheck className={`w-5 h-5 shrink-0 mt-0.5 ${mode === 'simulator' ? 'text-amber-600' : 'text-slate-400'}`} />
            <div>
              <h4 className="text-xs font-bold text-slate-900">ResortCare Sandbox Simulator</h4>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Simulates real-world delivery, status callbacks, and automatic fallback with zero cost and no API keys required.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Configuration Form */}
      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* ================= 1. TWILIO SMS GATEWAY ================= */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-black text-xs shadow-xs">
                SMS
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Twilio SMS Provider Setup</h3>
                <p className="text-xs text-slate-500">Official Twilio Programmable SMS API integration for staff task alerts</p>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer select-none self-start sm:self-auto">
              <input
                type="checkbox"
                checked={twilioEnabled}
                onChange={(e) => setTwilioEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
              />
              <span>Enable Twilio SMS</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Twilio Account SID *
              </label>
              <input
                type="text"
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={twilioAccountSid}
                onChange={(e) => setTwilioAccountSid(e.target.value.trim())}
                className="w-full text-xs font-mono p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Starts with 'AC' from Twilio Console</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Twilio Auth Token *
                </label>
                {hasStoredTwilioAuth && (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">
                    Secret Stored
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showTwilioToken ? 'text' : 'password'}
                  placeholder="Enter 32-character Auth Token"
                  value={twilioAuthToken}
                  onChange={(e) => setTwilioAuthToken(e.target.value.trim())}
                  className="w-full text-xs font-mono p-2.5 pr-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowTwilioToken(!showTwilioToken)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showTwilioToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Leave as dots to preserve currently stored token</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Twilio From Phone Number *
              </label>
              <input
                type="tel"
                placeholder="+13055550199"
                value={twilioPhone}
                onChange={(e) => setTwilioPhone(e.target.value.trim())}
                className="w-full text-xs font-mono p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">E.164 format with country code (e.g. +1...)</span>
            </div>

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={handleVerifyTwilio}
                disabled={verifyingTwilio || !twilioAccountSid}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {verifyingTwilio ? <Loader2 className="w-4 h-4 animate-spin text-brand-600" /> : <ShieldCheck className="w-4 h-4 text-sky-600" />}
                Verify Twilio Credentials
              </button>
            </div>
          </div>

          {twilioVerifyResult && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              twilioVerifyResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {twilioVerifyResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{twilioVerifyResult.message}</span>
            </div>
          )}

          {/* Twilio Status Callback Webhook */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Twilio Status Callback Webhook URL (Paste into Twilio Console)
              </span>
              <button
                type="button"
                onClick={() => handleCopy(webhooks.twilioStatusUrl, 'twilio-hook')}
                className="text-[11px] font-bold text-brand-600 hover:underline flex items-center gap-1"
              >
                {copiedWebhook === 'twilio-hook' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copiedWebhook === 'twilio-hook' ? 'Copied' : 'Copy URL'}
              </button>
            </div>
            <p className="text-xs font-mono text-slate-700 break-all select-all">{webhooks.twilioStatusUrl}</p>
          </div>
        </div>

        {/* ================= 2. DIRECT WHATSAPP PROVIDER (META CLOUD API & TWILIO) ================= */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-xs shadow-xs">
                WA
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Direct WhatsApp Provider Setup</h3>
                <p className="text-xs text-slate-500">Official WhatsApp Business Cloud Platform (Meta Graph API) & Twilio WhatsApp</p>
              </div>
            </div>

            {/* Sub-provider selector */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setWhatsappProvider('direct_meta')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  whatsappProvider === 'direct_meta'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Meta Cloud API (Direct)
              </button>
              <button
                type="button"
                onClick={() => setWhatsappProvider('twilio')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  whatsappProvider === 'twilio'
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Twilio WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setWhatsappProvider('simulator')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  whatsappProvider === 'simulator'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Simulator
              </button>
            </div>
          </div>

          {/* META DIRECT CLOUD API FIELDS */}
          {whatsappProvider === 'direct_meta' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-2.5">
                <Info className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                <p className="text-xs text-emerald-900 leading-relaxed">
                  Meta WhatsApp Cloud API sends rich interactive template messages directly to staff without third-party markups. Obtain your Phone Number ID and Permanent System User Token from the <strong>Meta for Developers Portal &rarr; WhatsApp &rarr; API Setup</strong>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    WhatsApp Phone Number ID *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 104829104810293"
                    value={metaPhoneId}
                    onChange={(e) => setMetaPhoneId(e.target.value.trim())}
                    className="w-full text-xs font-mono p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Numeric ID assigned by Meta for this sender phone</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    WhatsApp Business Account ID (WABA ID)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 192837465019283"
                    value={metaWabaId}
                    onChange={(e) => setMetaWabaId(e.target.value.trim())}
                    className="w-full text-xs font-mono p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Meta Permanent Access Token (System User Token) *
                  </label>
                  {hasStoredMetaToken && (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">
                      Secret Stored
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showMetaToken ? 'text' : 'password'}
                    placeholder="EAA..."
                    value={metaAccessToken}
                    onChange={(e) => setMetaAccessToken(e.target.value.trim())}
                    className="w-full text-xs font-mono p-2.5 pr-10 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMetaToken(!showMetaToken)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showMetaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">Generate a permanent token with whatsapp_business_messaging permissions</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Display Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+1 305-555-0100"
                    value={metaDisplayPhone}
                    onChange={(e) => setMetaDisplayPhone(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={metaTemplateName}
                    onChange={(e) => setMetaTemplateName(e.target.value.trim())}
                    placeholder="resortcare_job_dispatch"
                    className="w-full text-xs font-mono p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Template Language
                  </label>
                  <input
                    type="text"
                    value={metaTemplateLang}
                    onChange={(e) => setMetaTemplateLang(e.target.value.trim())}
                    placeholder="en_US"
                    className="w-full text-xs font-mono p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleVerifyMeta}
                  disabled={verifyingMeta || !metaPhoneId}
                  className="py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {verifyingMeta ? <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> : <ShieldCheck className="w-4 h-4 text-emerald-600" />}
                  Verify Meta WhatsApp Connection
                </button>
              </div>

              {metaVerifyResult && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  metaVerifyResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {metaVerifyResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                  <span>{metaVerifyResult.message}</span>
                </div>
              )}

              {/* Meta Webhook Details */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Meta WhatsApp Webhook Configuration (Configure in Meta Developer Dashboard)
                </span>
                <div className="flex items-center justify-between text-xs font-mono text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="truncate mr-2">{webhooks.whatsappWebhookUrl}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(webhooks.whatsappWebhookUrl, 'meta-hook')}
                    className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1 shrink-0"
                  >
                    {copiedWebhook === 'meta-hook' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedWebhook === 'meta-hook' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-slate-600">Verify Token:</span>
                  <input
                    type="text"
                    value={metaVerifyToken}
                    onChange={(e) => setMetaVerifyToken(e.target.value)}
                    className="text-xs font-mono py-1 px-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TWILIO WHATSAPP FIELDS */}
          {whatsappProvider === 'twilio' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Twilio WhatsApp From Sender *
                  </label>
                  <input
                    type="text"
                    placeholder="whatsapp:+14155238886"
                    value={twilioWaSender}
                    onChange={(e) => setTwilioWaSender(e.target.value.trim())}
                    className="w-full text-xs font-mono p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">e.g. whatsapp:+14155238886 (sandbox) or your Twilio registered WhatsApp number</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Content Template SID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={twilioWaContentSid}
                    onChange={(e) => setTwilioWaContentSid(e.target.value.trim())}
                    className="w-full text-xs font-mono p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SIMULATOR NOTICE */}
          {whatsappProvider === 'simulator' && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>WhatsApp dispatches will be simulated in-app with real-time logs and zero messaging cost.</span>
            </div>
          )}

          {/* Fallback Rules */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900">Automatic WhatsApp &rarr; Twilio SMS Fallback</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                If WhatsApp delivery fails or recipient has no data, automatically retry via Twilio SMS.
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoFallbackToSms}
              onChange={(e) => setAutoFallbackToSms(e.target.checked)}
              className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save All Gateway Settings</span>
          </button>
        </div>
      </form>

      {/* ================= 3. DIRECT TEST DISPATCH CONSOLE ================= */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-6 shadow-md space-y-4">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-brand-400" />
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-white">
            Live Gateway Verification & Test Dispatcher
          </h3>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Send an immediate verification message to your personal mobile device to test Twilio SMS or Direct WhatsApp integration end-to-end.
        </p>

        <form onSubmit={handleSendTest} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                Channel
              </label>
              <div className="flex rounded-xl overflow-hidden border border-slate-700 bg-slate-800 p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setTestChannel('whatsapp')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
                    testChannel === 'whatsapp' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <MessageSquare className="w-3 h-3" /> WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setTestChannel('sms')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
                    testChannel === 'sms' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3 h-3" /> SMS
                </button>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                Your Mobile Phone Number *
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  required
                  placeholder="+1 305-555-0199"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="flex-1 text-xs bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="submit"
                  disabled={testingSend || !testPhone}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50 shrink-0"
                >
                  {testingSend ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Send Live Test</span>
                </button>
              </div>
            </div>
          </div>

          {testSendResult && (
            <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              testSendResult.success ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800' : 'bg-rose-950/80 text-rose-300 border border-rose-800'
            }`}>
              {testSendResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
              <span>{testSendResult.message}</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
