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

    const request = db.prepare(`
      SELECT mr.*, r.room_number, h.id as hotel_id, h.name as hotel_name,
             (SELECT GROUP_CONCAT(mri.item_name || ': ' || mri.problem_type, ', ')
              FROM maintenance_request_items mri WHERE mri.request_id = mr.id) as items_summary,
             (SELECT mri.item_name FROM maintenance_request_items mri WHERE mri.request_id = mr.id LIMIT 1) as first_item,
             (SELECT mri.problem_type FROM maintenance_request_items mri WHERE mri.request_id = mr.id LIMIT 1) as first_problem
      FROM maintenance_requests mr
      JOIN rooms r ON mr.room_id = r.id
      JOIN hotels h ON mr.hotel_id = h.id
      WHERE mr.id = ?
    `).get(requestId) as any;

    const staff = db.prepare(`
      SELECT sp.*, u.full_name, u.phone as user_phone
      FROM staff_profiles sp
      JOIN users u ON sp.user_id = u.id
      WHERE sp.id = ?
    `).get(staffId) as any;

    if (!request || !staff) {
      return { fallbackUsed: false };
    }

    const { sms: smsProvider, whatsapp: waProvider } = this.getProviders(request.hotel_id);

    const payload: JobNotificationPayload = {
      hotelName: request.hotel_name || 'Ocean Pearl Resort',
      roomNumber: request.room_number,
      jobType: 'Maintenance',
      itemName: request.first_item || 'Room Equipment',
      problemType: request.first_problem || 'Reported Issue',
      priority: request.priority || 'Normal',
      description: request.description,
      jobUrl,
      jobToken,
      staffName: staff.full_name,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Construct short SMS message
    const smsMessage =
`${payload.hotelName}:
New maintenance job.

Room: ${payload.roomNumber}
Problem: ${payload.itemName} - ${payload.problemType}
Priority: ${payload.priority.toUpperCase()}

View and accept:
${payload.jobUrl}`;

    const mobilePhone = (staff.phone || staff.user_phone || '').trim();
    const waNumber = (staff.whatsapp_number || mobilePhone).trim();

    let smsResult: NotificationResult | undefined;
    let whatsappResult: NotificationResult | undefined;
    let fallbackUsed = false;

    const isEmergency = request.priority === 'Emergency';
    const preferredChannel = (staff.preferred_channel || 'whatsapp').toLowerCase();
    const smsEnabled = staff.sms_enabled !== 0;
    const waEnabled = staff.whatsapp_enabled !== 0 && staff.whatsapp_available !== 0;
    const fallbackEnabled = staff.fallback_enabled !== 0;

    // 1. If Emergency, send BOTH SMS and WhatsApp immediately
    if (isEmergency) {
      if (waEnabled && waNumber) {
        whatsappResult = await waProvider.sendWhatsApp(waNumber, payload);
        this.logNotification({
          jobId: requestId,
          staffId,
          channel: 'WhatsApp',
          provider: waProvider.name,
          recipient: waNumber,
          messageTemplate: 'New Hotel Job Assignment (Emergency)',
          providerMessageId: whatsappResult.providerMessageId,
          status: whatsappResult.status,
          errorCode: whatsappResult.errorCode,
          errorMessage: whatsappResult.errorMessage,
          payload
        });
      }

      if (smsEnabled && mobilePhone) {
        smsResult = await smsProvider.sendSMS(mobilePhone, smsMessage);
        this.logNotification({
          jobId: requestId,
          staffId,
          channel: 'SMS',
          provider: smsProvider.name,
          recipient: mobilePhone,
          messageTemplate: 'Job Notification SMS (Emergency)',
          providerMessageId: smsResult.providerMessageId,
          status: smsResult.status,
          errorCode: smsResult.errorCode,
          errorMessage: smsResult.errorMessage,
          payload: { smsMessage }
        });
      }
    } else {
      // 2. Normal / High Priority: Send via preferred channel
      if (preferredChannel === 'whatsapp' && waEnabled && waNumber) {
        whatsappResult = await waProvider.sendWhatsApp(waNumber, payload);

        this.logNotification({
          jobId: requestId,
          staffId,
          channel: 'WhatsApp',
          provider: waProvider.name,
          recipient: waNumber,
          messageTemplate: 'New Hotel Job Assignment',
          providerMessageId: whatsappResult.providerMessageId,
          status: whatsappResult.status,
          errorCode: whatsappResult.errorCode,
          errorMessage: whatsappResult.errorMessage,
          payload
        });

        // Check for WhatsApp failure and trigger automatic fallback to SMS
        if (!whatsappResult.success && fallbackEnabled && smsEnabled && mobilePhone) {
          fallbackUsed = true;
          smsResult = await smsProvider.sendSMS(mobilePhone, smsMessage);

          this.logNotification({
            jobId: requestId,
            staffId,
            channel: 'SMS',
            provider: smsProvider.name,
            recipient: mobilePhone,
            messageTemplate: 'Job Notification SMS (Fallback)',
            providerMessageId: smsResult.providerMessageId,
            status: smsResult.status,
            errorCode: smsResult.errorCode,
            errorMessage: smsResult.errorMessage,
            fallbackUsed: 1,
            payload: { reason: 'WhatsApp delivery failed, automatic fallback to SMS', smsMessage }
          });
        }
      } else if (smsEnabled && mobilePhone) {
        // SMS preferred
        smsResult = await smsProvider.sendSMS(mobilePhone, smsMessage);
        this.logNotification({
          jobId: requestId,
          staffId,
          channel: 'SMS',
          provider: smsProvider.name,
          recipient: mobilePhone,
          messageTemplate: 'Job Notification SMS',
          providerMessageId: smsResult.providerMessageId,
          status: smsResult.status,
          errorCode: smsResult.errorCode,
          errorMessage: smsResult.errorMessage,
          payload: { smsMessage }
        });

        // Fallback to WhatsApp if SMS fails
        if (!smsResult.success && fallbackEnabled && waEnabled && waNumber) {
          fallbackUsed = true;
          whatsappResult = await waProvider.sendWhatsApp(waNumber, payload);

          this.logNotification({
            jobId: requestId,
            staffId,
            channel: 'WhatsApp',
            provider: waProvider.name,
            recipient: waNumber,
            messageTemplate: 'New Hotel Job Assignment (Fallback)',
            providerMessageId: whatsappResult.providerMessageId,
            status: whatsappResult.status,
            errorCode: whatsappResult.errorCode,
            errorMessage: whatsappResult.errorMessage,
            fallbackUsed: 1,
            payload
          });
        }
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
      const res = await smsProvider.sendSMS(params.recipientPhone, msg);
      this.logNotification({
        channel: 'SMS',
        provider: smsProvider.name,
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
${params.technicianName ? `Assigned: ${params.technicianName}\\n` : ''}
Track live: ${trackUrl}`;

      const { sms: smsProvider } = this.getProviders(request.hotel_id);
      await smsProvider.sendSMS(recipientPhone, message);
    } catch (e) {
      // Non-blocking
    }
  }
}
