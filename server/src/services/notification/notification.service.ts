import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db/database';
import { CONFIG } from '../../config';
import { sseService } from '../sse';
import { recordAuditLog } from '../../middleware/audit';
import {
  JobNotificationPayload,
  NotificationResult,
  SMSProvider,
  WhatsAppProvider
} from './notification.interface';
import { TwilioSMSProvider, TwilioWhatsAppProvider } from './twilio.provider';
import { SimulatorSMSProvider, SimulatorWhatsAppProvider } from './simulator.provider';
import { MetaWhatsAppProvider } from './meta-whatsapp.provider';
import { SmsManagerService } from './sms/sms-manager.service';

export class NotificationService {
  private static twilioSMS = new TwilioSMSProvider();
  private static twilioWhatsApp = new TwilioWhatsAppProvider();
  private static simSMS = new SimulatorSMSProvider();
  private static simWhatsApp = new SimulatorWhatsAppProvider();

  /**
   * Get active notification provider configuration from database settings.
   */
  public static getActiveProviderConfig(hotelId: string): any {
    try {
      const row = db.prepare(`
        SELECT value_json FROM settings WHERE hotel_id = ? AND category = 'notifications' AND key = 'providers'
      `).get(hotelId) as any;
      if (row && row.value_json) {
        return JSON.parse(row.value_json);
      }
    } catch (e) {}
    return null;
  }

  /**
   * Get active providers based on hotel settings (Twilio, Meta Direct WhatsApp, or Simulator).
   */
  private static getProviders(hotelId: string): { sms: SMSProvider; whatsapp: WhatsAppProvider } {
    const config = this.getActiveProviderConfig(hotelId);

    // SMS Provider resolution
    let smsProvider: SMSProvider = this.simSMS;
    if (config?.twilioSms?.enabled) {
      const sid = config.twilioSms.accountSid || CONFIG.TWILIO.ACCOUNT_SID;
      const auth = config.twilioSms.authToken || CONFIG.TWILIO.AUTH_TOKEN;
      const phone = config.twilioSms.phoneNumber || CONFIG.TWILIO.PHONE_NUMBER;
      if (sid && auth && phone) {
        smsProvider = new TwilioSMSProvider({ accountSid: sid, authToken: auth, phoneNumber: phone });
      }
    } else if (CONFIG.TWILIO.ACCOUNT_SID && CONFIG.TWILIO.AUTH_TOKEN && CONFIG.TWILIO.PHONE_NUMBER) {
      smsProvider = this.twilioSMS;
    }

    // WhatsApp Provider resolution
    let whatsappProvider: WhatsAppProvider = this.simWhatsApp;
    const waProviderType = config?.whatsapp?.provider || 'simulator';

    if (waProviderType === 'direct_meta' && config?.whatsapp?.meta?.enabled) {
      const { phoneNumberId, accessToken, wabaId, apiVersion, templateName, templateLanguage } = config.whatsapp.meta;
      if (phoneNumberId && accessToken) {
        whatsappProvider = new MetaWhatsAppProvider({
          phoneNumberId,
          accessToken,
          wabaId,
          apiVersion: apiVersion || 'v21.0',
          templateName: templateName || 'resortcare_job_dispatch',
          templateLanguage: templateLanguage || 'en_US'
        });
      }
    } else if (waProviderType === 'twilio') {
      const sid = config?.twilioSms?.accountSid || CONFIG.TWILIO.ACCOUNT_SID;
      const auth = config?.twilioSms?.authToken || CONFIG.TWILIO.AUTH_TOKEN;
      const sender = config?.whatsapp?.twilio?.whatsappSender || CONFIG.TWILIO.WHATSAPP_SENDER;
      const tpl = config?.whatsapp?.twilio?.contentTemplateSid || CONFIG.TWILIO.CONTENT_TEMPLATE_SID;
      if (sid && auth) {
        whatsappProvider = new TwilioWhatsAppProvider({
          accountSid: sid,
          authToken: auth,
          whatsappSender: sender,
          contentTemplateSid: tpl
        });
      }
    }

    return { sms: smsProvider, whatsapp: whatsappProvider };
  }

  /**
   * Record a notification delivery attempt in notification_logs.
   */
  static logNotification(params: {
    jobId?: string;
    staffId?: string;
    channel: 'SMS' | 'WhatsApp';
    provider: string;
    recipient: string;
    messageTemplate?: string;
    providerMessageId?: string;
    status: 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'READ';
    errorCode?: string;
    errorMessage?: string;
    retryCount?: number;
    fallbackUsed?: number;
    payload?: any;
  }): string {
    const id = `notif-${uuidv4().substring(0, 10)}`;
    try {
      db.prepare(`
        INSERT INTO notification_logs (
          id, job_id, staff_id, channel, provider, recipient,
          message_template, provider_message_id, status,
          sent_at, delivered_at, failed_at, error_code, error_message,
          retry_count, fallback_used, payload_json, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          CASE WHEN ? IN ('SENT', 'DELIVERED') THEN datetime('now') ELSE NULL END,
          CASE WHEN ? = 'DELIVERED' THEN datetime('now') ELSE NULL END,
          CASE WHEN ? = 'FAILED' THEN datetime('now') ELSE NULL END,
          ?, ?, ?, ?, ?, datetime('now')
        )
      `).run(
        id,
        params.jobId || null,
        params.staffId || null,
        params.channel,
        params.provider,
        params.recipient,
        params.messageTemplate || null,
        params.providerMessageId || null,
        params.status,
        params.status,
        params.status,
        params.status,
        params.errorCode || null,
        params.errorMessage || null,
        params.retryCount || 0,
        params.fallbackUsed || 0,
        params.payload ? JSON.stringify(params.payload) : null
      );
    } catch (e) {
      console.error('Failed to insert notification_log:', e);
    }
    return id;
  }

  /**
   * Dispatches notifications when a job is assigned to a staff member.
   * Enforces staff channel preferences, WhatsApp -> SMS fallback, and Emergency dual-channel alerts.
   */
  static async sendJobAssigned(params: {
    requestId: string;
    staffId: string;
    jobToken: string;
    jobUrl: string;
    assignedByUserId?: string;
  }): Promise<{ smsResult?: NotificationResult; whatsappResult?: NotificationResult; fallbackUsed: boolean }> {
    const { requestId, staffId, jobToken, jobUrl } = params;

    let request = db.prepare(`
      SELECT mr.*, r.room_number, h.id as hotel_id, h.name as hotel_name,
             (SELECT GROUP_CONCAT(mri.item_name || ': ' || mri.problem_type, ', ')
              FROM maintenance_request_items mri WHERE mri.request_id = mr.id) as items_summary,
             (SELECT mri.item_name FROM maintenance_request_items mri WHERE mri.request_id = mr.id LIMIT 1) as first_item,
             (SELECT mri.problem_type FROM maintenance_request_items mri WHERE mri.request_id = mr.id LIMIT 1) as first_problem
      FROM maintenance_requests mr
      LEFT JOIN rooms r ON mr.room_id = r.id
      LEFT JOIN hotels h ON mr.hotel_id = h.id
      WHERE mr.id = ?
    `).get(requestId) as any;

    let jobType = 'Maintenance';
    let itemName = request?.first_item || 'Room Equipment';
    let problemType = request?.first_problem || 'Reported Issue';

    if (!request) {
      const gsr = db.prepare(`
        SELECT gsr.*, r.room_number, h.id as hotel_id, h.name as hotel_name,
               (SELECT GROUP_CONCAT(gsri.item_name, ', ')
                FROM guest_service_request_items gsri WHERE gsri.request_id = gsr.id) as items_summary,
               (SELECT gsri.item_name FROM guest_service_request_items gsri WHERE gsri.request_id = gsr.id LIMIT 1) as first_item
        FROM guest_service_requests gsr
        LEFT JOIN rooms r ON gsr.room_id = r.id
        LEFT JOIN hotels h ON gsr.hotel_id = h.id
        WHERE gsr.id = ?
      `).get(requestId) as any;

      if (gsr) {
        request = gsr;
        jobType = gsr.service_type || 'Guest Service';
        itemName = gsr.first_item || gsr.items_summary || 'Service Request';
        problemType = gsr.special_instructions || 'Guest Service Order';
      }
    }

    const staff = db.prepare(`
      SELECT sp.*, u.full_name, u.phone as user_phone
      FROM staff_profiles sp
      JOIN users u ON sp.user_id = u.id
      WHERE sp.id = ?
    `).get(staffId) as any;

    if (!request || !staff) {
      console.warn(`[NotificationService] Cannot dispatch: request (${Boolean(request)}) or staff (${Boolean(staff)}) not found for id ${requestId}, staff ${staffId}`);
      return { fallbackUsed: false };
    }

    const { sms: smsProvider, whatsapp: waProvider } = this.getProviders(request.hotel_id);

    const payload: JobNotificationPayload = {
      hotelName: request.hotel_name || 'Ocean Pearl Resort',
      roomNumber: request.room_number || 'General',
      jobType,
      itemName,
      problemType,
      priority: request.priority || 'Normal',
      description: request.description || request.special_instructions || '',
      jobUrl,
      jobToken,
      staffName: staff.full_name,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Construct concise, clean SMS message
    const smsMessage =
`HOTEL JOB
Room: ${payload.roomNumber}
Service: ${payload.jobType}
Item: ${payload.itemName}
Problem: ${payload.problemType}
Priority: ${payload.priority.toUpperCase()}

View & Accept:
${payload.jobUrl}`;

    const mobilePhone = (staff.phone || staff.user_phone || '').replace(/[\s()-]/g, '').trim();
    const waNumber = (staff.whatsapp_number || mobilePhone).replace(/[\s()-]/g, '').trim();

    let smsResult: NotificationResult | undefined;
    let whatsappResult: NotificationResult | undefined;
    let fallbackUsed = false;

    const isEmergency = (request.priority || '').toLowerCase() === 'emergency';
    const preferredChannel = (staff.preferred_channel || 'sms').toLowerCase();
    const smsEnabled = staff.sms_enabled !== 0;
    const waEnabled = staff.whatsapp_enabled !== 0 && staff.whatsapp_available !== 0;
    const fallbackEnabled = staff.fallback_enabled !== 0;

    // Check if WhatsApp is actually live (Meta Cloud API with credentials or Twilio WhatsApp)
    const isWaLive = Boolean(waProvider && waProvider.name !== 'Simulator WhatsApp' && waProvider.name !== 'simulator');

    // Helper: Send SMS
    const dispatchSms = async (isFallback = false) => {
      // Allow SMS dispatch if SMS is enabled OR if mobilePhone exists and WhatsApp is not live / fallback
      const canSend = Boolean(mobilePhone) && (smsEnabled || isFallback || !isWaLive);
      if (!canSend) {
        console.warn(`[NotificationService] Skipping SMS dispatch for staff ${staffId}: mobilePhone='${mobilePhone}', smsEnabled=${smsEnabled}, isFallback=${isFallback}, isWaLive=${isWaLive}`);
        return;
      }

      console.log(`[NotificationService] Dispatching SMS to ${mobilePhone} for job ${requestId} (isFallback=${isFallback})...`);
      const smsDispatch = await SmsManagerService.sendSms(mobilePhone, smsMessage, {
        jobId: requestId,
        staffId,
        hotelId: request.hotel_id
      });
      smsResult = smsDispatch.result;
      if (smsDispatch.fallbackUsed) fallbackUsed = true;
      console.log(`[NotificationService] SMS dispatch result: status=${smsResult.status}, provider=${smsResult.provider}, msgId=${smsResult.providerMessageId}, error=${smsResult.errorMessage || 'none'}`);

      this.logNotification({
        jobId: requestId,
        staffId,
        channel: 'SMS',
        provider: smsResult.provider || 'SMS',
        recipient: mobilePhone,
        messageTemplate: isFallback ? 'Job Notification SMS (Fallback)' : 'Job Notification SMS',
        providerMessageId: smsResult.providerMessageId,
        status: smsResult.status,
        errorCode: smsResult.errorCode,
        errorMessage: smsResult.errorMessage,
        fallbackUsed: isFallback ? 1 : 0,
        payload: { smsMessage, jobUrl: payload.jobUrl }
      });
    };

    // Helper: Send WhatsApp
    const dispatchWhatsApp = async (isFallback = false) => {
      if (!waEnabled || !waNumber) return;
      console.log(`[NotificationService] Dispatching WhatsApp to ${waNumber} for job ${requestId}...`);
      whatsappResult = await waProvider.sendWhatsApp(waNumber, payload);

      this.logNotification({
        jobId: requestId,
        staffId,
        channel: 'WhatsApp',
        provider: waProvider.name,
        recipient: waNumber,
        messageTemplate: isFallback ? 'New Hotel Job Assignment (Fallback)' : 'New Hotel Job Assignment',
        providerMessageId: whatsappResult.providerMessageId,
        status: whatsappResult.status,
        errorCode: whatsappResult.errorCode,
        errorMessage: whatsappResult.errorMessage,
        fallbackUsed: isFallback ? 1 : 0,
        payload
      });
    };

    // 1. Emergency or Both Preferred: Dispatch to all live channels
    if (isEmergency || preferredChannel === 'both') {
      if (isWaLive && waEnabled && waNumber) {
        await dispatchWhatsApp();
      }
      await dispatchSms();
    } else if (preferredChannel === 'whatsapp') {
      // 2. WhatsApp Preferred:
      if (isWaLive && waEnabled && waNumber) {
        await dispatchWhatsApp();
        if (!whatsappResult?.success && fallbackEnabled) {
          fallbackUsed = true;
          await dispatchSms(true);
        }
      } else {
        // WhatsApp is not live/configured: Deliver via SMS immediately so staff receives the job link!
        fallbackUsed = true;
        await dispatchSms(true);
      }
    } else {
      // 3. SMS Preferred (or default)
      await dispatchSms();
      if (!smsResult?.success && fallbackEnabled && isWaLive && waEnabled && waNumber) {
        fallbackUsed = true;
        await dispatchWhatsApp(true);
      }
    }

    // Real-time broadcast to Front Office & Staff
    sseService.broadcast('JOB_NOTIFICATION_SENT', {
      requestId,
      staffId,
      staffName: staff.full_name,
      roomNumber: request.room_number,
      whatsappStatus: whatsappResult?.status || null,
      smsStatus: smsResult?.status || null,
      fallbackUsed
    });

    return { smsResult, whatsappResult, fallbackUsed };
  }

  /**
   * Direct test notification to staff member (triggered by admin)
   */
  static async sendTestNotification(params: {
    hotelId: string;
    staffId: string;
    channel: 'SMS' | 'WhatsApp';
  }): Promise<NotificationResult> {
    const { hotelId, staffId, channel } = params;
    const staff = db.prepare(`
      SELECT sp.*, u.full_name, u.phone as user_phone
      FROM staff_profiles sp
      JOIN users u ON sp.user_id = u.id
      WHERE sp.id = ?
    `).get(staffId) as any;

    if (!staff) {
      return {
        success: false,
        provider: 'System',
        channel,
        status: 'FAILED',
        errorMessage: 'Staff profile not found'
      };
    }

    const { sms: smsProvider, whatsapp: waProvider } = this.getProviders(hotelId);
    const mobilePhone = (staff.phone || staff.user_phone || '').trim();
    const waNumber = (staff.whatsapp_number || mobilePhone).trim();

    if (channel === 'SMS') {
      if (!mobilePhone) {
        return {
          success: false,
          provider: smsProvider.name,
          channel: 'SMS',
          status: 'FAILED',
          errorMessage: 'No mobile phone number configured for staff.'
        };
      }
      const testMsg = `[Ocean Pearl Resort Test] Hello ${staff.full_name}, this is a test notification from the staff mobile dispatch system.`;
      const res = await smsProvider.sendSMS(mobilePhone, testMsg);

      this.logNotification({
        staffId,
        channel: 'SMS',
        provider: smsProvider.name,
        recipient: mobilePhone,
        messageTemplate: 'Admin Channel Test (SMS)',
        providerMessageId: res.providerMessageId,
        status: res.status,
        errorCode: res.errorCode,
        errorMessage: res.errorMessage,
        payload: { testMsg }
      });

      return res;
    } else {
      if (!waNumber) {
        return {
          success: false,
          provider: waProvider.name,
          channel: 'WhatsApp',
          status: 'FAILED',
          errorMessage: 'No WhatsApp number configured for staff.'
        };
      }
      const testMsg = `🔧 *Ocean Pearl Resort Test*\\nHello ${staff.full_name}, your WhatsApp notification channel is active and ready to receive hotel jobs!`;
      const res = await waProvider.sendWhatsAppText(waNumber, testMsg);

      this.logNotification({
        staffId,
        channel: 'WhatsApp',
        provider: waProvider.name,
        recipient: waNumber,
        messageTemplate: 'Admin Channel Test (WhatsApp)',
        providerMessageId: res.providerMessageId,
        status: res.status,
        errorCode: res.errorCode,
        errorMessage: res.errorMessage,
        payload: { testMsg }
      });

      return res;
    }
  }

  /**
   * Send direct test message to an arbitrary phone number from the Admin Settings Panel.
   */
  static async sendDirectTest(params: {
    channel: 'SMS' | 'WhatsApp';
    recipientPhone: string;
    message?: string;
    hotelId?: string;
  }): Promise<NotificationResult> {
    const hotelId = params.hotelId || 'hotel-ocean-pearl';
    const { sms: smsProvider, whatsapp: waProvider } = this.getProviders(hotelId);
    const msg = params.message || `🔔 [ResortCare Test] This is a verification test from ResortCare System Admin Panel.`;

    if (params.channel === 'SMS') {
      const smsDispatch = await SmsManagerService.sendSms(params.recipientPhone, msg, { hotelId });
      const res = smsDispatch.result;
      this.logNotification({
        channel: 'SMS',
        provider: res.provider || 'SMS',
        recipient: params.recipientPhone,
        messageTemplate: 'Admin Direct Test (SMS)',
        providerMessageId: res.providerMessageId,
        status: res.status,
        errorCode: res.errorCode,
        errorMessage: res.errorMessage
      });
      return res;
    } else {
      const res = await waProvider.sendWhatsAppText(params.recipientPhone, msg);
      this.logNotification({
        channel: 'WhatsApp',
        provider: waProvider.name,
        recipient: params.recipientPhone,
        messageTemplate: 'Admin Direct Test (WhatsApp)',
        providerMessageId: res.providerMessageId,
        status: res.status,
        errorCode: res.errorCode,
        errorMessage: res.errorMessage
      });
      return res;
    }
  }

  /**
   * Notifies guest on maintenance status progression if consent is provided.
   */
  static async sendGuestUpdate(params: {
    requestId: string;
    status: string;
    technicianName?: string;
  }): Promise<void> {
    try {
      const request = db.prepare(`
        SELECT mr.*, r.room_number, h.name as hotel_name, h.id as hotel_id
        FROM maintenance_requests mr
        JOIN rooms r ON mr.room_id = r.id
        JOIN hotels h ON mr.hotel_id = h.id
        WHERE mr.id = ?
      `).get(params.requestId) as any;

      if (!request) return;

      // Check guest preferences and consent
      const prefs = db.prepare(`
        SELECT * FROM guest_notification_preferences WHERE tracking_token = ?
      `).get(request.tracking_token) as any;

      const recipientPhone = prefs?.phone || request.guest_phone;
      if (!recipientPhone) return;

      const trackUrl = `${CONFIG.BASE_URL}/guest/track/${request.tracking_token}`;
      const statusTitle = params.status === 'Technician On The Way' ? 'Technician On The Way' : params.status;

      const message =
`${request.hotel_name}

Your Room ${request.room_number} maintenance request status: ${statusTitle.toUpperCase()}.
${params.technicianName ? `Assigned: ${params.technicianName}\n` : ''}
Track live: ${trackUrl}`;

      await SmsManagerService.sendSms(recipientPhone, message, {
        hotelId: request.hotel_id,
        jobId: params.requestId
      });
    } catch (e) {
      // Non-blocking
    }
  }
}
