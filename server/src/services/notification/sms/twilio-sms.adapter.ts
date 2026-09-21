import { SmsProvider, SmsSendOptions, SmsBalanceResult } from './sms.interface';
import { NotificationResult } from '../notification.interface';
import { TwilioSMSProvider, TwilioConfig } from '../twilio.provider';

export class TwilioSmsAdapter implements SmsProvider {
  readonly key: string = 'twilio';
  readonly name: string = 'Twilio SMS';
  private client: TwilioSMSProvider;

  constructor(config?: TwilioConfig) {
    this.client = new TwilioSMSProvider(config);
  }

  public normalizePhoneNumber(phoneNumber: string): string {
    if (!phoneNumber) return '';
    let cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');
    if (!cleaned.startsWith('+')) {
      if (cleaned.startsWith('00')) {
        cleaned = '+' + cleaned.substring(2);
      } else if (cleaned.startsWith('0') && cleaned.length === 10) {
        cleaned = '+94' + cleaned.substring(1);
      } else if (cleaned.length === 10 && !cleaned.startsWith('1')) {
        cleaned = '+1' + cleaned;
      } else {
        cleaned = '+' + cleaned;
      }
    }
    return cleaned;
  }

  public validatePhoneNumber(phoneNumber: string): boolean {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    // Standard E.164 pattern: + followed by 7-15 digits
    return /^\+[1-9]\d{6,14}$/.test(normalized);
  }

  public async sendSms(to: string, message: string, _options?: SmsSendOptions): Promise<NotificationResult> {
    const normalized = this.normalizePhoneNumber(to);
    return await this.client.sendSMS(normalized, message);
  }

  public async getStatus(_providerMessageId: string): Promise<any> {
    return null;
  }

  public async getBalance(): Promise<SmsBalanceResult | null> {
    return null;
  }
}
