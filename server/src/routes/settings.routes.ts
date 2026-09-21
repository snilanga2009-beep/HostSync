import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { db } from '../db/database';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { recordAuditLog } from '../middleware/audit';
import { CONFIG } from '../config';

const router = Router();

function maskSecret(val?: string): string {
  if (!val || val.length < 6) return '';
  return '••••••••' + val.substring(val.length - 4);
}

// GET /api/settings/notifications/providers - Retrieve SMS & WhatsApp provider configuration
router.get('/notifications/providers', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;
    const hotelId = hotel?.id || 'hotel-ocean-pearl';

    const row = db.prepare(`
      SELECT value_json FROM settings WHERE hotel_id = ? AND category = 'notifications' AND key = 'providers'
    `).get(hotelId) as any;

    let stored: any = {};
    if (row && row.value_json) {
      try {
        stored = JSON.parse(row.value_json);
      } catch (e) {}
    }

    const slEnabled = stored.sriLankaSms?.enabled !== undefined ? stored.sriLankaSms.enabled : CONFIG.SRI_LANKA_SMS.ENABLED;
    const slProvider = stored.sriLankaSms?.provider || CONFIG.SRI_LANKA_SMS.PROVIDER || 'textlk';
    const slUserId = stored.sriLankaSms?.userId || CONFIG.SRI_LANKA_SMS.USER_ID || '';
    const slToken = stored.sriLankaSms?.apiKey || stored.sriLankaSms?.apiToken || CONFIG.SRI_LANKA_SMS.API_KEY || CONFIG.SRI_LANKA_SMS.API_TOKEN || '';
    const slSender = stored.sriLankaSms?.senderId || CONFIG.SRI_LANKA_SMS.SENDER_ID || 'HOTELNAME';
    const slBaseUrl = stored.sriLankaSms?.apiBaseUrl || stored.sriLankaSms?.apiUrl || CONFIG.SRI_LANKA_SMS.API_BASE_URL || 'https://app.text.lk/api/v3';
    const slUrl = stored.sriLankaSms?.apiUrl || CONFIG.SRI_LANKA_SMS.API_URL || 'https://app.text.lk/api/v3/sms/send';

    const twilioSid = stored.twilioSms?.accountSid || CONFIG.TWILIO.ACCOUNT_SID || '';
    const twilioAuth = stored.twilioSms?.authToken || CONFIG.TWILIO.AUTH_TOKEN || '';
    const twilioPhone = stored.twilioSms?.phoneNumber || CONFIG.TWILIO.PHONE_NUMBER || '';
    const twilioSender = stored.whatsapp?.twilio?.whatsappSender || CONFIG.TWILIO.WHATSAPP_SENDER || 'whatsapp:+14155238886';
    const twilioTpl = stored.whatsapp?.twilio?.contentTemplateSid || CONFIG.TWILIO.CONTENT_TEMPLATE_SID || '';

    const metaPhoneId = stored.whatsapp?.meta?.phoneNumberId || '';
    const metaToken = stored.whatsapp?.meta?.accessToken || '';
    const metaWabaId = stored.whatsapp?.meta?.wabaId || '';
    const metaDisplayPhone = stored.whatsapp?.meta?.displayPhoneNumber || '';
    const metaTpl = stored.whatsapp?.meta?.templateName || 'resortcare_job_dispatch';
    const metaLang = stored.whatsapp?.meta?.templateLanguage || 'en_US';
    const metaVerifyToken = stored.whatsapp?.meta?.verifyToken || 'resortcare_webhook_secret_2026';

    const smsProvider =
      stored.smsProvider ||
      (slEnabled ? 'srilanka' : (twilioSid ? 'twilio' : (stored.mode === 'simulator' ? 'simulator' : 'disabled')));
    const smsFallbackEnabled =
      stored.smsFallbackEnabled !== undefined ? stored.smsFallbackEnabled : CONFIG.SRI_LANKA_SMS.FALLBACK_ENABLED;

    res.json({
      mode: stored.mode || (twilioSid || slToken ? 'live' : 'simulator'),
      publicBaseUrl: stored.publicBaseUrl || (CONFIG.BASE_URL.includes('localhost') ? 'http://192.168.1.12:5173' : CONFIG.BASE_URL),
      smsProvider,
      smsFallbackEnabled,
      sriLankaSms: {
        enabled: Boolean(slEnabled),
        provider: slProvider,
        userId: slUserId,
        apiKey: slToken,
        apiToken: slToken,
        senderId: slSender,
        apiBaseUrl: slBaseUrl,
        apiUrl: slUrl,
        hasApiKey: Boolean(slToken),
        maskedApiKey: maskSecret(slToken),
        hasApiToken: Boolean(slToken),
        maskedApiToken: maskSecret(slToken)
      },
      twilioSms: {
        enabled: stored.twilioSms?.enabled !== undefined ? stored.twilioSms.enabled : Boolean(twilioSid && twilioAuth),
        accountSid: twilioSid,
        hasAuthToken: Boolean(twilioAuth),
        maskedAuthToken: maskSecret(twilioAuth),
        phoneNumber: twilioPhone
      },
      whatsapp: {
        provider: stored.whatsapp?.provider || (metaPhoneId ? 'direct_meta' : (twilioSid ? 'twilio' : 'simulator')),
        autoFallbackToSms: stored.whatsapp?.autoFallbackToSms !== undefined ? stored.whatsapp.autoFallbackToSms : true,
        meta: {
          enabled: stored.whatsapp?.meta?.enabled !== undefined ? stored.whatsapp.meta.enabled : Boolean(metaPhoneId && metaToken),
          phoneNumberId: metaPhoneId,
          wabaId: metaWabaId,
          hasAccessToken: Boolean(metaToken),
          maskedAccessToken: maskSecret(metaToken),
          displayPhoneNumber: metaDisplayPhone,
          templateName: metaTpl,
          templateLanguage: metaLang,
          verifyToken: metaVerifyToken
        },
        twilio: {
          whatsappSender: twilioSender,
          contentTemplateSid: twilioTpl
        }
      },
      webhooks: {
        twilioStatusUrl: `${CONFIG.BASE_URL.replace('5173', '5000')}/api/webhooks/twilio/status`,
        whatsappWebhookUrl: `${CONFIG.BASE_URL.replace('5173', '5000')}/api/webhooks/whatsapp`,
        sriLankaSmsWebhookUrl: `${CONFIG.BASE_URL.replace('5173', '5000')}/api/webhooks/sri-lanka-sms`
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings/notifications/providers - Save SMS & WhatsApp provider configuration
router.put('/notifications/providers', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), (req: AuthRequest, res: Response) => {
  try {
    const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;
    const hotelId = hotel?.id || 'hotel-ocean-pearl';

    const row = db.prepare(`
      SELECT value_json FROM settings WHERE hotel_id = ? AND category = 'notifications' AND key = 'providers'
    `).get(hotelId) as any;

    let existing: any = {};
    if (row && row.value_json) {
      try { existing = JSON.parse(row.value_json); } catch (e) {}
    }

    const payload = req.body;

    // Preserve existing secret tokens if masked or not provided
    let newSlToken = payload.sriLankaSms?.apiKey || payload.sriLankaSms?.apiToken;
    if (!newSlToken || newSlToken.startsWith('••••') || newSlToken.trim() === '') {
      newSlToken = existing.sriLankaSms?.apiKey || existing.sriLankaSms?.apiToken || CONFIG.SRI_LANKA_SMS.API_KEY || CONFIG.SRI_LANKA_SMS.API_TOKEN || '';
    }

    let newTwilioAuth = payload.twilioSms?.authToken;
    if (!newTwilioAuth || newTwilioAuth.startsWith('••••') || newTwilioAuth.trim() === '') {
      newTwilioAuth = existing.twilioSms?.authToken || CONFIG.TWILIO.AUTH_TOKEN || '';
    }

    let newMetaToken = payload.whatsapp?.meta?.accessToken;
    if (!newMetaToken || newMetaToken.startsWith('••••') || newMetaToken.trim() === '') {
      newMetaToken = existing.whatsapp?.meta?.accessToken || '';
    }

    const mergedSettings = {
      mode: payload.mode || (newSlToken || newTwilioAuth ? 'live' : existing.mode || 'live'),
      publicBaseUrl: payload.publicBaseUrl ? String(payload.publicBaseUrl).trim() : (existing.publicBaseUrl || ''),
      smsProvider: payload.smsProvider || 'srilanka',
      smsFallbackEnabled: payload.smsFallbackEnabled !== undefined ? Boolean(payload.smsFallbackEnabled) : true,
      sriLankaSms: {
        enabled: payload.sriLankaSms?.enabled !== undefined ? Boolean(payload.sriLankaSms.enabled) : true,
        provider: payload.sriLankaSms?.provider || 'textlk',
        userId: (payload.sriLankaSms?.userId || '').trim(),
        apiKey: newSlToken,
        apiToken: newSlToken,
        senderId: (payload.sriLankaSms?.senderId || 'HOTELNAME').trim(),
        apiBaseUrl: (payload.sriLankaSms?.apiBaseUrl || payload.sriLankaSms?.apiUrl || 'https://app.text.lk/api/v3').trim(),
        apiUrl: (payload.sriLankaSms?.apiUrl || payload.sriLankaSms?.apiBaseUrl || 'https://app.text.lk/api/v3/sms/send').trim()
      },
      twilioSms: {
        enabled: payload.smsProvider === 'twilio' || Boolean(payload.twilioSms?.enabled),
        accountSid: (payload.twilioSms?.accountSid || '').trim(),
        authToken: newTwilioAuth.trim(),
        phoneNumber: (payload.twilioSms?.phoneNumber || '').trim()
      },
      whatsapp: {
        provider: payload.whatsapp?.provider || 'simulator',
        autoFallbackToSms: payload.whatsapp?.autoFallbackToSms !== undefined ? Boolean(payload.whatsapp.autoFallbackToSms) : true,
        meta: {
          enabled: Boolean(payload.whatsapp?.meta?.enabled),
          phoneNumberId: payload.whatsapp?.meta?.phoneNumberId || '',
          wabaId: payload.whatsapp?.meta?.wabaId || '',
          accessToken: newMetaToken,
          displayPhoneNumber: payload.whatsapp?.meta?.displayPhoneNumber || '',
          templateName: payload.whatsapp?.meta?.templateName || 'resortcare_job_dispatch',
          templateLanguage: payload.whatsapp?.meta?.templateLanguage || 'en_US',
          verifyToken: payload.whatsapp?.meta?.verifyToken || 'resortcare_webhook_secret_2026'
        },
        twilio: {
          whatsappSender: payload.whatsapp?.twilio?.whatsappSender || 'whatsapp:+14155238886',
          contentTemplateSid: payload.whatsapp?.twilio?.contentTemplateSid || ''
        }
      }
    };

    db.prepare(`
      INSERT INTO settings (id, hotel_id, category, key, value_json, updated_at)
      VALUES (?, ?, 'notifications', 'providers', ?, datetime('now'))
      ON CONFLICT(hotel_id, category, key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = datetime('now')
    `).run(`set-notifications-providers-${hotelId}`, hotelId, JSON.stringify(mergedSettings));

    recordAuditLog({
      hotelId,
      userId: req.user?.id,
      userName: req.user?.full_name,
      action: 'NOTIFICATION_PROVIDERS_CONFIGURED',
      entity: 'settings',
      details: {
        mode: mergedSettings.mode,
        twilioSmsEnabled: mergedSettings.twilioSms.enabled,
        whatsAppProvider: mergedSettings.whatsapp.provider
      }
    });

    res.json({ success: true, message: 'Provider configuration saved successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/notifications/verify-twilio - Live Twilio Account verification
router.post('/notifications/verify-twilio', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), async (req: AuthRequest, res: Response) => {
  try {
    let { accountSid, authToken } = req.body;
    accountSid = (accountSid || '').trim();

    if (!authToken || authToken.startsWith('••••')) {
      const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;
      const row = db.prepare(`SELECT value_json FROM settings WHERE hotel_id = ? AND category = 'notifications' AND key = 'providers'`).get(hotel?.id) as any;
      if (row?.value_json) {
        try {
          const p = JSON.parse(row.value_json);
          authToken = p.twilioSms?.authToken;
        } catch (e) {}
      }
      if (!authToken) authToken = CONFIG.TWILIO.AUTH_TOKEN;
    }

    authToken = (authToken || '').trim();

    if (!accountSid || !authToken) {
      return res.status(400).json({ success: false, error: 'Both Twilio Account SID and Auth Token are required for verification.' });
    }

    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      headers: { Authorization: authHeader }
    });

    let data: any = {};
    try {
      data = await response.json();
    } catch {
      data = { message: `Twilio returned HTTP ${response.status}` };
    }

    if (!response.ok) {
      return res.status(400).json({
        success: false,
        error: data.message || `Twilio authentication rejected with status ${response.status}`,
        code: data.code
      });
    }

    // Also attempt to fetch balance
    let balance: number | null = null;
    let currency = 'USD';
    try {
      const balRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Balance.json`, {
        headers: { Authorization: authHeader }
      });
      if (balRes.ok) {
        const balData = await balRes.json() as any;
        if (balData.balance !== undefined) {
          balance = parseFloat(balData.balance);
          currency = balData.currency || 'USD';
        }
      }
    } catch {}

    res.json({
      success: true,
      friendlyName: data.friendly_name || 'Twilio Account',
      status: data.status,
      type: data.type,
      balance,
      currency
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Error connecting to Twilio API' });
  }
});

// POST /api/settings/notifications/verify-srilanka-sms - Live Sri Lanka SMS API verification & Balance Check
router.post('/notifications/verify-srilanka-sms', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), async (req: AuthRequest, res: Response) => {
  try {
    let { userId, apiKey, apiToken, apiBaseUrl, apiUrl, senderId } = req.body;
    let token = apiKey || apiToken;

    if (!token || token.startsWith('••••')) {
      const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;
      const row = db.prepare(`SELECT value_json FROM settings WHERE hotel_id = ? AND category = 'notifications' AND key = 'providers'`).get(hotel?.id) as any;
      if (row?.value_json) {
        try {
          const p = JSON.parse(row.value_json);
          token = p.sriLankaSms?.apiKey || p.sriLankaSms?.apiToken || CONFIG.SRI_LANKA_SMS.API_KEY || CONFIG.SRI_LANKA_SMS.API_TOKEN;
          if (!userId) userId = p.sriLankaSms?.userId || CONFIG.SRI_LANKA_SMS.USER_ID;
          if (!apiBaseUrl) apiBaseUrl = p.sriLankaSms?.apiBaseUrl || CONFIG.SRI_LANKA_SMS.API_BASE_URL;
          if (!apiUrl) apiUrl = p.sriLankaSms?.apiUrl || CONFIG.SRI_LANKA_SMS.API_URL;
          if (!senderId) senderId = p.sriLankaSms?.senderId || CONFIG.SRI_LANKA_SMS.SENDER_ID;
        } catch (e) {}
      }
    }

    if (!userId) userId = CONFIG.SRI_LANKA_SMS.USER_ID;
    if (!apiBaseUrl) apiBaseUrl = CONFIG.SRI_LANKA_SMS.API_BASE_URL;
    if (!apiUrl) apiUrl = CONFIG.SRI_LANKA_SMS.API_URL;
    if (!senderId) senderId = CONFIG.SRI_LANKA_SMS.SENDER_ID;
    if (!token) token = CONFIG.SRI_LANKA_SMS.API_KEY || CONFIG.SRI_LANKA_SMS.API_TOKEN;

    if (!token) {
      return res.status(400).json({ success: false, error: 'API Key (or Bearer Token) is required for verification.' });
    }

    const { SriLankaSmsProvider } = await import('../services/notification/sms/srilanka.provider');
    const provider = new SriLankaSmsProvider({ userId, apiKey: token, apiToken: token, apiBaseUrl, apiUrl, senderId });
    const balanceInfo = await provider.getBalance();

    res.json({
      success: true,
      provider: provider.key,
      providerName: provider.name,
      status: 'active',
      balance: balanceInfo?.balance ?? null,
      currency: balanceInfo?.currency || 'LKR',
      message: `Successfully connected to ${provider.name}.`
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Error connecting to Sri Lanka SMS API' });
  }
});

// POST /api/settings/notifications/sms/test - Send Test SMS with step diagnostics (Sri Lanka or Twilio)
router.post('/notifications/sms/test', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), async (req: AuthRequest, res: Response) => {
  try {
    const rawNumber = (req.body.phoneNumber || req.body.recipientPhone || req.body.phone || req.body.to || '').trim();
    const { message, userId, apiKey, apiToken, apiBaseUrl, apiUrl, senderId, accountSid, authToken, fromNumber, provider: reqProvider } = req.body;
    if (!rawNumber) {
      return res.status(400).json({ success: false, error: 'Phone number is required for test SMS.' });
    }

    const hotel = db.prepare(`SELECT id, name FROM hotels LIMIT 1`).get() as any;
    const hotelId = hotel?.id || 'hotel-ocean-pearl';
    const { SmsManagerService } = await import('../services/notification/sms/sms-manager.service');

    // Fetch existing stored settings for fallback credentials if masked or omitted
    const row = db.prepare(`SELECT value_json FROM settings WHERE hotel_id = ? AND category = 'notifications' AND key = 'providers'`).get(hotelId) as any;
    let storedSettings: any = {};
    if (row?.value_json) {
      try {
        storedSettings = JSON.parse(row.value_json);
      } catch {}
    }

    const targetProvider = (reqProvider || (storedSettings.smsProvider === 'twilio' ? 'twilio' : 'srilanka')).toLowerCase();

    // ================= 1. TWILIO SMS TEST =================
    if (targetProvider === 'twilio') {
      const { TwilioSmsAdapter } = await import('../services/notification/sms/twilio-sms.adapter');
      const storedTwilio = storedSettings.twilioSms || {};

      const sid = (accountSid && !accountSid.startsWith('••••'))
        ? accountSid
        : (storedTwilio.accountSid || CONFIG.TWILIO.ACCOUNT_SID || '');
      const auth = (authToken && !authToken.startsWith('••••'))
        ? authToken
        : (storedTwilio.authToken || CONFIG.TWILIO.AUTH_TOKEN || '');
      const phone = fromNumber || req.body.phoneNumber || storedTwilio.phoneNumber || CONFIG.TWILIO.PHONE_NUMBER || '';

      const twilioAdapter = new TwilioSmsAdapter({
        accountSid: String(sid).trim(),
        authToken: String(auth).trim(),
        phoneNumber: String(phone).trim()
      });

      const isPhoneValid = twilioAdapter.validatePhoneNumber(rawNumber);
      const normalizedNumber = twilioAdapter.normalizePhoneNumber(rawNumber);
      const testMsg = message || `🔔 [${hotel?.name || 'Hotel'} Twilio Test] Hello! This is a test dispatch from Hotel Admin Panel via Twilio SMS. Normalization: ${normalizedNumber} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;

      const dispatchResult = await twilioAdapter.sendSms(rawNumber, testMsg);

      SmsManagerService.logSms({
        recipient: normalizedNumber || rawNumber,
        provider: 'Twilio SMS',
        senderId: phone,
        message: testMsg,
        providerMessageId: dispatchResult.providerMessageId,
        status: dispatchResult.success ? 'sent' : 'failed',
        errorCode: dispatchResult.errorCode,
        errorMessage: dispatchResult.errorMessage
      });

      return res.json({
        success: dispatchResult.success,
        recipient: normalizedNumber || rawNumber,
        rawRecipient: rawNumber,
        provider: 'Twilio SMS',
        status: dispatchResult.status,
        steps: {
          phoneValid: isPhoneValid,
          apiConnected: dispatchResult.status !== 'FAILED' || dispatchResult.errorCode !== 'TWILIO_NOT_CONFIGURED',
          smsAccepted: dispatchResult.success
        },
        error: dispatchResult.errorMessage,
        result: dispatchResult
      });
    }

    // ================= 2. SRI LANKA SMS TEST =================
    const storedSl = storedSettings.sriLankaSms || {};
    const { SriLankaSmsProvider } = await import('../services/notification/sms/srilanka.provider');

    const effectiveUserId = (userId !== undefined && userId !== '') ? userId : (storedSl.userId || CONFIG.SRI_LANKA_SMS.USER_ID || '');
    const keyCandidate = apiKey || apiToken;
    const effectiveKey = (keyCandidate && !keyCandidate.startsWith('••••'))
      ? keyCandidate
      : (storedSl.apiKey || storedSl.apiToken || CONFIG.SRI_LANKA_SMS.API_KEY || CONFIG.SRI_LANKA_SMS.API_TOKEN || '');
    const effectiveBaseUrl = apiBaseUrl || storedSl.apiBaseUrl || storedSl.apiUrl || CONFIG.SRI_LANKA_SMS.API_BASE_URL;
    const effectiveSenderId = senderId || storedSl.senderId || CONFIG.SRI_LANKA_SMS.SENDER_ID || '';

    const slProvider = new SriLankaSmsProvider({
      userId: effectiveUserId,
      apiKey: effectiveKey,
      apiToken: effectiveKey,
      apiBaseUrl: effectiveBaseUrl,
      apiUrl: apiUrl || storedSl.apiUrl,
      senderId: effectiveSenderId
    });

    const isSlValid = slProvider.validatePhoneNumber(rawNumber);
    const normalizedNumber = slProvider.normalizePhoneNumber(rawNumber);

    const testMsg = message || `🔔 [${hotel?.name || 'Hotel'} Test SMS] Hello! This is a test dispatch from the Hotel Admin Panel via ${slProvider.name}. Normalization: ${normalizedNumber} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;

    // Attempt direct dispatch via configured Sri Lanka provider
    const dispatchResult = await slProvider.sendSms(rawNumber, testMsg);

    // If direct dispatch failed and fallback is enabled, attempt Twilio fallback
    let fallbackUsed = false;
    let finalResult = dispatchResult;
    if (!dispatchResult.success) {
      const fallback = SmsManagerService.getFallbackProvider(hotelId);
      if (fallback) {
        const fallbackRes = await fallback.sendSms(rawNumber, testMsg);
        if (fallbackRes.success) {
          fallbackUsed = true;
          finalResult = fallbackRes;
        }
      }
    }

    // Log the test dispatch
    SmsManagerService.logSms({
      recipient: normalizedNumber || rawNumber,
      provider: finalResult.provider,
      senderId: effectiveSenderId,
      message: testMsg,
      providerMessageId: finalResult.providerMessageId,
      status: finalResult.success ? 'sent' : 'failed',
      errorCode: finalResult.errorCode,
      errorMessage: finalResult.errorMessage
    });

    res.json({
      success: finalResult.success,
      recipient: normalizedNumber || rawNumber,
      rawRecipient: rawNumber,
      provider: finalResult.provider,
      status: finalResult.status,
      fallbackUsed,
      steps: {
        phoneValid: isSlValid,
        apiConnected: dispatchResult.status !== 'FAILED' || dispatchResult.errorCode !== 'NETWORK_OR_RUNTIME_ERROR',
        smsAccepted: finalResult.success
      },
      error: finalResult.errorMessage,
      result: finalResult
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to dispatch test SMS' });
  }
});

// GET /api/settings/notifications/sms/balance - Fetch live account balance (Twilio or Sri Lanka SMS)
router.get('/notifications/sms/balance', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;
    const hotelId = hotel?.id || 'hotel-ocean-pearl';
    const { SmsManagerService } = await import('../services/notification/sms/sms-manager.service');
    const requested = (req.query.provider as string || '').toLowerCase();

    let provider: any = null;
    if (requested === 'twilio') {
      const twilioConfig = SmsManagerService.getHotelSmsConfig(hotelId).twilioConfig;
      const { TwilioSmsAdapter } = await import('../services/notification/sms/twilio-sms.adapter');
      provider = new TwilioSmsAdapter(twilioConfig);
    } else if (requested === 'srilanka' || requested === 'textlk' || requested === 'smslenz') {
      const slConfig = SmsManagerService.getHotelSmsConfig(hotelId).slConfig;
      const { SriLankaSmsProvider } = await import('../services/notification/sms/srilanka.provider');
      provider = new SriLankaSmsProvider(slConfig);
    } else {
      provider = SmsManagerService.getPrimaryProvider(hotelId);
      if (!provider || !provider.getBalance) {
        const slConfig = SmsManagerService.getHotelSmsConfig(hotelId).slConfig;
        const { SriLankaSmsProvider } = await import('../services/notification/sms/srilanka.provider');
        provider = new SriLankaSmsProvider(slConfig);
      }
    }

    const balanceInfo = await provider.getBalance();
    res.json({
      success: true,
      provider: provider.name,
      balance: balanceInfo?.balance ?? null,
      currency: balanceInfo?.currency || (requested === 'twilio' ? 'USD' : 'LKR')
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/settings/notifications/verify-whatsapp - Live Meta WhatsApp Cloud API verification
router.post('/notifications/verify-whatsapp', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), async (req: AuthRequest, res: Response) => {
  try {
    let { phoneNumberId, accessToken, apiVersion } = req.body;

    if (!accessToken || accessToken.startsWith('••••')) {
      const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;
      const row = db.prepare(`SELECT value_json FROM settings WHERE hotel_id = ? AND category = 'notifications' AND key = 'providers'`).get(hotel?.id) as any;
      if (row?.value_json) {
        try {
          const p = JSON.parse(row.value_json);
          accessToken = p.whatsapp?.meta?.accessToken;
        } catch (e) {}
      }
    }

    if (!phoneNumberId || !accessToken) {
      return res.status(400).json({ success: false, error: 'Both Phone Number ID and Access Token are required for verification.' });
    }

    const version = apiVersion || 'v21.0';
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}?fields=verified_name,display_phone_number,quality_rating,code_verification_status`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const data = await response.json() as any;

    if (!response.ok || data.error) {
      return res.status(400).json({
        success: false,
        error: data.error?.message || `Meta WhatsApp verification failed with status ${response.status}`,
        code: data.error?.code
      });
    }

    res.json({
      success: true,
      verifiedName: data.verified_name || 'Verified WhatsApp Business Account',
      displayPhoneNumber: data.display_phone_number || phoneNumberId,
      qualityRating: data.quality_rating || 'UNKNOWN',
      verificationStatus: data.code_verification_status || 'VERIFIED'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Error connecting to Meta WhatsApp Cloud API' });
  }
});

// POST /api/settings/notifications/send-test - Send live test SMS or WhatsApp to arbitrary phone number
router.post('/notifications/send-test', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { channel, recipientPhone, message } = req.body;
    if (!channel || !recipientPhone) {
      return res.status(400).json({ error: 'channel and recipientPhone are required.' });
    }

    const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;
    const hotelId = hotel?.id || 'hotel-ocean-pearl';
    const testMsg = message || `🔔 [ResortCare Test] This is a verification test from ResortCare System Admin Panel. Sent at ${new Date().toLocaleTimeString()}.`;

    const { NotificationService } = await import('../services/notification/notification.service');
    const result = await NotificationService.sendDirectTest({
      channel: channel.toLowerCase() === 'sms' ? 'SMS' : 'WhatsApp',
      recipientPhone,
      message: testMsg,
      hotelId
    });

    res.json({ success: result.success, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings - Retrieve all system settings
router.get('/', (req, res: Response) => {
  try {
    const rows = db.prepare(`SELECT * FROM settings`).all() as any[];
    const settings: Record<string, Record<string, any>> = {};

    rows.forEach(r => {
      if (!settings[r.category]) settings[r.category] = {};
      try {
        settings[r.category][r.key] = JSON.parse(r.value_json);
      } catch (e) {
        settings[r.category][r.key] = r.value_json;
      }
    });

    res.json({ settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings/:category/:key - Update a specific configuration setting
router.put('/:category/:key', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), (req: AuthRequest, res: Response) => {
  try {
    const { category, key } = req.params;
    const value = req.body;
    const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;

    db.prepare(`
      INSERT INTO settings (id, hotel_id, category, key, value_json, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(hotel_id, category, key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = datetime('now')
    `).run(`set-${category}-${key}-${hotel.id}`, hotel.id, category, key, JSON.stringify(value));

    recordAuditLog({
      hotelId: hotel.id,
      userId: req.user?.id,
      userName: req.user?.full_name,
      action: 'SETTINGS_UPDATED',
      entity: 'settings',
      details: { category, key }
    });

    res.json({ success: true, category, key, value });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/backup/info - Retrieve database backup stats
router.get('/backup/info', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), (req: AuthRequest, res: Response) => {
  try {
    const dbPath = CONFIG.DB_PATH;
    let sizeBytes = 0;
    let lastModified: Date | null = null;
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      sizeBytes = stats.size;
      lastModified = stats.mtime;
    }

    // Get table counts
    const roomsCount = (db.prepare(`SELECT COUNT(*) as count FROM rooms`).get() as any)?.count || 0;
    const requestsCount = (db.prepare(`SELECT COUNT(*) as count FROM maintenance_requests`).get() as any)?.count || 0;
    const usersCount = (db.prepare(`SELECT COUNT(*) as count FROM users`).get() as any)?.count || 0;
    const staffCount = (db.prepare(`SELECT COUNT(*) as count FROM staff_profiles`).get() as any)?.count || 0;
    const tipsCount = (db.prepare(`SELECT COUNT(*) as count FROM tips`).get() as any)?.count || 0;
    const tablesCount = (db.prepare(`SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).get() as any)?.count || 0;

    res.json({
      engine: 'SQLite 3 (WAL Mode)',
      filePath: path.basename(dbPath),
      sizeBytes,
      sizeFormatted: sizeBytes > 1024 * 1024 ? `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB` : `${(sizeBytes / 1024).toFixed(1)} KB`,
      lastModified: lastModified ? lastModified.toISOString() : null,
      tablesCount,
      counts: {
        rooms: roomsCount,
        requests: requestsCount,
        users: usersCount,
        staff: staffCount,
        tips: tipsCount
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/backup/download - Download clean SQLite database file
router.get('/backup/download', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), async (req: AuthRequest, res: Response) => {
  try {
    // Flush WAL checkpoint to ensure consistent snapshot
    db.pragma('wal_checkpoint(TRUNCATE)');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const backupDir = path.join(path.dirname(CONFIG.DB_PATH), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFileName = `resortcare_backup_${timestamp}.db`;
    const backupFilePath = path.join(backupDir, backupFileName);

    // better-sqlite3 native backup
    await db.backup(backupFilePath);

    res.download(backupFilePath, backupFileName, (err) => {
      // Clean up temporary backup file after download finishes
      if (fs.existsSync(backupFilePath)) {
        try {
          fs.unlinkSync(backupFilePath);
        } catch (e) {}
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/settings/backup/export-json - Export all database data as JSON
router.get('/backup/export-json', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), (req: AuthRequest, res: Response) => {
  try {
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).all() as any[];
    const exportData: Record<string, any[]> = {};

    tables.forEach(t => {
      exportData[t.name] = db.prepare(`SELECT * FROM ${t.name}`).all();
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const jsonStr = JSON.stringify(exportData, null, 2);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=resortcare_export_${timestamp}.json`);
    res.send(jsonStr);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
