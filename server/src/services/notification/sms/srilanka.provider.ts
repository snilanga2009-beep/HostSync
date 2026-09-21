import { SmsProvider, SmsSendOptions, SmsBalanceResult } from './sms.interface';
import { NotificationResult } from '../notification.interface';

export interface SriLankaSmsConfig {
  provider?: string; // 'textlk' | 'dialog' | 'mobitel'
  userId?: string;
  apiKey?: string;
  apiToken?: string;
  senderId?: string;
  apiBaseUrl?: string;
  apiUrl?: string;
}

/**
 * Dedicated Sri Lanka SMS Provider Implementation.
 * Primary implementation targets Text.lk REST API v3 with modular extension points.
 */
export class SriLankaSmsProvider implements SmsProvider {
  readonly key: string = 'textlk';
  readonly name: string = 'Sri Lanka SMS (Text.lk)';

  public readonly userId: string;
  public readonly apiKey: string;
  public readonly apiToken: string;
  public readonly senderId: string;
  public readonly apiBaseUrl: string;
  public readonly apiUrl: string;

  constructor(config?: Partial<SriLankaSmsConfig>) {
    this.userId = (config?.userId || process.env.SRI_LANKA_SMS_USER_ID || '').trim();
    this.apiKey = (config?.apiKey || config?.apiToken || process.env.SRI_LANKA_SMS_API_KEY || process.env.SRI_LANKA_SMS_API_TOKEN || '').trim();
    this.apiToken = this.apiKey;
    this.senderId = (config?.senderId || process.env.SRI_LANKA_SMS_SENDER_ID || 'HOTELNAME').trim();

    // Flexible API Base URL resolution (e.g. 'https://app.text.lk/api/v3' or 'https://app.text.lk/api/v3/sms/send')
    const rawUrl = (config?.apiBaseUrl || config?.apiUrl || process.env.SRI_LANKA_SMS_API_BASE_URL || process.env.SRI_LANKA_SMS_API_URL || 'https://app.text.lk/api/v3').trim();
    this.apiBaseUrl = rawUrl.replace(/\/sms\/send\/?$/, '').replace(/\/$/, '');
    this.apiUrl = rawUrl.includes('/sms/send') ? rawUrl : `${this.apiBaseUrl}/sms/send`;

    if (config?.provider) {
      this.key = config.provider;
    }
  }

  /**
   * Normalizes any Sri Lankan mobile phone number into standard 947XXXXXXXX format.
   * Handles formats:
   * - 0771234567 -> 94771234567
   * - +94771234567 -> 94771234567
   * - 0094771234567 -> 94771234567
   * - 771234567 -> 94771234567
   * - 94771234567 -> 94771234567
   */
  public normalizePhoneNumber(phoneNumber: string): string {
    if (!phoneNumber) return '';
    // Strip everything except digits
    let digits = phoneNumber.replace(/\D/g, '');

    // 0094... prefix
    if (digits.startsWith('0094')) {
      digits = digits.substring(2);
    }

    // 0XXXXXXXXX format
    if (digits.startsWith('0')) {
      digits = '94' + digits.substring(1);
    } else if (digits.startsWith('7') && digits.length === 9) {
      digits = '94' + digits;
    }

    return digits;
  }

  /**
   * Validates if a phone number is a valid Sri Lankan mobile number (94 7X XXX XXXX).
   * Valid prefixes: 070, 071, 072, 074, 075, 076, 077, 078.
   */
  public validatePhoneNumber(phoneNumber: string): boolean {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    // Sri Lanka mobile pattern: 94 + 7 + 8 digits (total 11 digits)
    const slMobileRegex = /^947[01245678][0-9]{7}$/;
    return slMobileRegex.test(normalized);
  }

  /**
   * Sends an SMS via Text.lk REST API.
   * Endpoint: POST https://app.text.lk/api/v3/sms/send
   */
  public async sendSms(to: string, message: string, options?: SmsSendOptions): Promise<NotificationResult> {
    const normalizedRecipient = this.normalizePhoneNumber(to);

    // Validate phone number before sending
    if (!this.validatePhoneNumber(normalizedRecipient)) {
      return {
        success: false,
        provider: this.key,
        channel: 'SMS',
        status: 'FAILED',
        errorCode: 'INVALID_SL_PHONE_NUMBER',
        errorMessage: `Invalid Sri Lankan mobile phone number: "${to}". Must be a valid 947XXXXXXXX number.`
      };
    }

    if (!this.apiToken) {
      return {
        success: false,
        provider: this.key,
        channel: 'SMS',
        status: 'FAILED',
        errorCode: 'MISSING_API_TOKEN',
        errorMessage: 'Sri Lanka SMS API token (SRI_LANKA_SMS_API_TOKEN) is not configured.'
      };
    }

    const activeSenderId = (options?.senderId || this.senderId || 'HOTELNAME').trim();

    try {
      const payload: any = {
        recipient: normalizedRecipient,
        sender_id: activeSenderId,
        type: options?.type || 'plain',
        message: message.trim()
      };

      if (this.userId) {
        payload.user_id = this.userId;
      }

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      if (this.userId) {
        headers['X-User-Id'] = this.userId;
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const responseData: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg =
          responseData?.message ||
          responseData?.error ||
          responseData?.data?.message ||
          `HTTP Error ${response.status}: ${response.statusText}`;

        return {
          success: false,
          provider: this.key,
          channel: 'SMS',
          status: 'FAILED',
          errorCode: `HTTP_${response.status}`,
          errorMessage: String(errorMsg),
          rawResponse: responseData
        };
      }

      // Text.lk success response format inspection
      // Usually returns status 'success' or data with uid/id
      const messageId =
        responseData?.data?.uid ||
        responseData?.data?.id ||
        responseData?.uid ||
        responseData?.id ||
        responseData?.message_id ||
        `textlk-${Date.now()}`;

      return {
        success: true,
        provider: this.key,
        channel: 'SMS',
        providerMessageId: String(messageId),
        status: 'SENT',
        rawResponse: responseData
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.key,
        channel: 'SMS',
        status: 'FAILED',
        errorCode: 'NETWORK_OR_RUNTIME_ERROR',
        errorMessage: err.message || 'Unknown network error while contacting Sri Lanka SMS API'
      };
    }
  }

  /**
   * Retrieves message delivery status from Text.lk if available.
   */
  public async getStatus(providerMessageId: string): Promise<any> {
    if (!this.apiKey || !providerMessageId) return null;
    try {
      const url = `${this.apiBaseUrl}/sms/status/${providerMessageId}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          ...(this.userId ? { 'X-User-Id': this.userId } : {})
        }
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Queries account balance from Text.lk REST API.
   */
  public async getBalance(): Promise<SmsBalanceResult | null> {
    if (!this.apiKey) return null;
    try {
      const balanceUrl = `${this.apiBaseUrl}/balance`;
      const response = await fetch(balanceUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
          ...(this.userId ? { 'X-User-Id': this.userId } : {})
        }
      });

      if (!response.ok) return null;
      const data: any = await response.json();

      // Parse balance from data payload
      const balanceValue =
        parseFloat(data?.data?.remaining_balance || data?.data?.balance || data?.balance || '0');

      return {
        balance: isNaN(balanceValue) ? 0 : balanceValue,
        currency: data?.data?.currency || 'LKR',
        raw: data
      };
    } catch {
      return null;
    }
  }
}
