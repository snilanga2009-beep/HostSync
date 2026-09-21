import { SmsProvider, SmsSendOptions, SmsBalanceResult } from './sms.interface';
import { NotificationResult } from '../notification.interface';

export interface SriLankaSmsConfig {
  provider?: string; // 'textlk' | 'dialog' | 'mobitel'
  apiToken: string;
  senderId?: string;
  apiUrl?: string;
}

/**
 * Dedicated Sri Lanka SMS Provider Implementation.
 * Primary implementation targets Text.lk REST API v3 with modular extension points.
 */
export class SriLankaSmsProvider implements SmsProvider {
  readonly key: string = 'textlk';
  readonly name: string = 'Sri Lanka SMS (Text.lk)';

  private apiToken: string;
  private senderId: string;
  private apiUrl: string;

  constructor(config?: Partial<SriLankaSmsConfig>) {
    this.apiToken = (config?.apiToken || process.env.SRI_LANKA_SMS_API_TOKEN || '').trim();
    this.senderId = (config?.senderId || process.env.SRI_LANKA_SMS_SENDER_ID || 'HOTELNAME').trim();
    this.apiUrl = (config?.apiUrl || process.env.SRI_LANKA_SMS_API_URL || 'https://app.text.lk/api/v3/sms/send').trim();
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
      const payload = {
        recipient: normalizedRecipient,
        sender_id: activeSenderId,
        type: options?.type || 'plain',
        message: message.trim()
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
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
    if (!this.apiToken || !providerMessageId) return null;
    try {
      const url = `https://app.text.lk/api/v3/sms/status/${providerMessageId}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Accept': 'application/json'
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
    if (!this.apiToken) return null;
    try {
      const balanceUrl = 'https://app.text.lk/api/v3/balance';
      const response = await fetch(balanceUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Accept': 'application/json'
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
