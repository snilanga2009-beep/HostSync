import { v4 as uuidv4 } from 'uuid';
import { db } from '../../../db/database';
import { CONFIG } from '../../../config';
import { SmsProvider, SmsSendOptions } from './sms.interface';
import { SriLankaSmsProvider } from './srilanka.provider';
import { TwilioSmsAdapter } from './twilio-sms.adapter';
import { SimulatorSmsAdapter } from './simulator-sms.adapter';
import { NotificationResult } from '../notification.interface';

// Simple in-memory sliding window rate limiter per recipient
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();

export class SmsManagerService {
  /**
   * Retrieves active SMS provider configuration for the hotel.
   */
  public static getHotelSmsConfig(hotelId: string = 'hotel-ocean-pearl') {
    let stored: any = {};
    try {
      const row = db.prepare(`
        SELECT value_json FROM settings WHERE hotel_id = ? AND category = 'notifications' AND key = 'providers'
      `).get(hotelId) as any;
      if (row && row.value_json) {
        stored = JSON.parse(row.value_json);
      }
    } catch {}

    // Primary choice: 'srilanka' | 'twilio' | 'simulator' | 'disabled'
    const activeProvider =
      stored.smsProvider ||
      (CONFIG.SRI_LANKA_SMS.ENABLED
        ? 'srilanka'
        : CONFIG.TWILIO.ACCOUNT_SID
        ? 'twilio'
        : stored.mode === 'simulator'
        ? 'simulator'
        : 'disabled');

    const slConfig = {
      enabled: stored.sriLankaSms?.enabled !== undefined ? stored.sriLankaSms.enabled : CONFIG.SRI_LANKA_SMS.ENABLED,
      provider: stored.sriLankaSms?.provider || CONFIG.SRI_LANKA_SMS.PROVIDER || 'textlk',
      apiToken: stored.sriLankaSms?.apiToken || CONFIG.SRI_LANKA_SMS.API_TOKEN || '',
      senderId: stored.sriLankaSms?.senderId || CONFIG.SRI_LANKA_SMS.SENDER_ID || 'HOTELNAME',
      apiUrl: stored.sriLankaSms?.apiUrl || CONFIG.SRI_LANKA_SMS.API_URL || 'https://app.text.lk/api/v3/sms/send'
    };

    const twilioConfig = {
      enabled: stored.twilioSms?.enabled !== undefined ? stored.twilioSms.enabled : Boolean(CONFIG.TWILIO.ACCOUNT_SID),
      accountSid: stored.twilioSms?.accountSid || CONFIG.TWILIO.ACCOUNT_SID || '',
      authToken: stored.twilioSms?.authToken || CONFIG.TWILIO.AUTH_TOKEN || '',
      phoneNumber: stored.twilioSms?.phoneNumber || CONFIG.TWILIO.PHONE_NUMBER || ''
    };

    const fallbackEnabled =
      stored.smsFallbackEnabled !== undefined
        ? stored.smsFallbackEnabled
        : CONFIG.SRI_LANKA_SMS.FALLBACK_ENABLED;

    return {
      activeProvider,
      slConfig,
      twilioConfig,
      fallbackEnabled,
      mode: stored.mode || 'live'
    };
  }

  /**
   * Instantiates the primary SMS provider.
   */
  public static getPrimaryProvider(hotelId: string = 'hotel-ocean-pearl'): SmsProvider | null {
    const config = this.getHotelSmsConfig(hotelId);

    if (config.mode === 'simulator' && config.activeProvider !== 'disabled') {
      return new SimulatorSmsAdapter();
    }

    if (config.activeProvider === 'srilanka' && config.slConfig.enabled) {
      return new SriLankaSmsProvider(config.slConfig);
    }

    if (config.activeProvider === 'twilio' && config.twilioConfig.enabled) {
      return new TwilioSmsAdapter(config.twilioConfig);
    }

    if (config.activeProvider === 'simulator') {
      return new SimulatorSmsAdapter();
    }

    return null; // Disabled
  }

  /**
   * Instantiates the fallback SMS provider (typically Twilio if primary is Sri Lanka).
   */
  public static getFallbackProvider(hotelId: string = 'hotel-ocean-pearl'): SmsProvider | null {
    const config = this.getHotelSmsConfig(hotelId);
    if (!config.fallbackEnabled) return null;

    if (config.activeProvider === 'srilanka') {
      if (config.twilioConfig.enabled && config.twilioConfig.accountSid && config.twilioConfig.authToken) {
        return new TwilioSmsAdapter(config.twilioConfig);
      }
    }
    return null;
  }

  /**
   * Rate limits SMS dispatch per recipient (maximum 5 SMS per 2 minutes per recipient).
   */
  private static checkRateLimit(recipient: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(recipient);
    if (!entry || now > entry.expiresAt) {
      rateLimitMap.set(recipient, { count: 1, expiresAt: now + 2 * 60 * 1000 });
      return true;
    }
    if (entry.count >= 5) {
      return false; // Rate limited
    }
    entry.count += 1;
    return true;
  }

  /**
   * Logs SMS message details to `sms_logs`.
   */
  public static logSms(params: {
    jobId?: string;
    staffId?: string;
    recipient: string;
    provider: string;
    senderId?: string;
    message: string;
    providerMessageId?: string;
    status: 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';
    errorCode?: string;
    errorMessage?: string;
  }): string {
    const id = `sms-${uuidv4().substring(0, 10)}`;
    try {
      db.prepare(`
        INSERT INTO sms_logs (
          id, job_id, staff_id, recipient, provider, sender_id,
          message, provider_message_id, status, error_code, error_message,
          sent_at, delivered_at, failed_at, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          CASE WHEN ? IN ('sent', 'delivered') THEN datetime('now') ELSE NULL END,
          CASE WHEN ? = 'delivered' THEN datetime('now') ELSE NULL END,
          CASE WHEN ? = 'failed' THEN datetime('now') ELSE NULL END,
          datetime('now')
        )
      `).run(
        id,
        params.jobId || null,
        params.staffId || null,
        params.recipient,
        params.provider,
        params.senderId || null,
        params.message,
        params.providerMessageId || null,
        params.status,
        params.errorCode || null,
        params.errorMessage || null,
        params.status,
        params.status,
        params.status
      );
    } catch (err) {
      console.error('Failed to insert sms_logs record:', err);
    }
    return id;
  }

  /**
   * Master dispatch method:
   * - Enforces rate limits
   * - Sends via primary provider
   * - Executes automatic fallback to Twilio if primary fails
   * - Logs all attempts to sms_logs
   */
  public static async sendSms(
    to: string,
    message: string,
    options?: SmsSendOptions & { hotelId?: string }
  ): Promise<{ result: NotificationResult; fallbackUsed: boolean; logId?: string }> {
    const hotelId = options?.hotelId || 'hotel-ocean-pearl';
    const primary = this.getPrimaryProvider(hotelId);

    // Free-tier mode check
    if (!primary) {
      return {
        result: {
          success: false,
          provider: 'disabled',
          channel: 'SMS',
          status: 'FAILED',
          errorCode: 'SMS_DISABLED',
          errorMessage: 'SMS dispatch is currently disabled (Free-tier mode).'
        },
        fallbackUsed: false
      };
    }

    // Rate limit check
    if (!this.checkRateLimit(to)) {
      const rateLimitRes: NotificationResult = {
        success: false,
        provider: primary.key,
        channel: 'SMS',
        status: 'FAILED',
        errorCode: 'RATE_LIMIT_EXCEEDED',
        errorMessage: `Rate limit exceeded for recipient ${to}. Please wait 2 minutes before dispatching more SMS.`
      };
      const logId = this.logSms({
        jobId: options?.jobId,
        staffId: options?.staffId,
        recipient: to,
        provider: primary.key,
        senderId: options?.senderId,
        message,
        status: 'failed',
        errorCode: rateLimitRes.errorCode,
        errorMessage: rateLimitRes.errorMessage
      });
      return { result: rateLimitRes, fallbackUsed: false, logId };
    }

    // 1. Primary Attempt
    let result = await primary.sendSms(to, message, options);
    let fallbackUsed = false;

    let logId = this.logSms({
      jobId: options?.jobId,
      staffId: options?.staffId,
      recipient: to,
      provider: primary.key,
      senderId: options?.senderId,
      message,
      providerMessageId: result.providerMessageId,
      status: result.success ? 'sent' : 'failed',
      errorCode: result.errorCode,
      errorMessage: result.errorMessage
    });

    // 2. Automatic Fallback Attempt (if primary failed and fallback enabled)
    if (!result.success) {
      const fallback = this.getFallbackProvider(hotelId);
      if (fallback) {
        console.warn(`[SMS Fallback] Primary SMS provider (${primary.key}) failed. Initiating fallback to ${fallback.key}...`);
        const fallbackResult = await fallback.sendSms(to, message, options);
        fallbackUsed = true;

        this.logSms({
          jobId: options?.jobId,
          staffId: options?.staffId,
          recipient: to,
          provider: `${fallback.key}_fallback`,
          senderId: options?.senderId,
          message,
          providerMessageId: fallbackResult.providerMessageId,
          status: fallbackResult.success ? 'sent' : 'failed',
          errorCode: fallbackResult.errorCode,
          errorMessage: fallbackResult.errorMessage
        });

        if (fallbackResult.success) {
          result = fallbackResult;
        }
      }
    }

    return { result, fallbackUsed, logId };
  }
}
