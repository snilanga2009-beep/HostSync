import { NotificationResult } from '../notification.interface';

export interface SmsSendOptions {
  senderId?: string;
  jobId?: string;
  staffId?: string;
  type?: 'plain' | 'unicode';
}

export interface SmsBalanceResult {
  balance: number;
  currency: string;
  ratePerSms?: number;
  raw?: any;
}

export interface SmsProvider {
  readonly key: string; // 'textlk' | 'twilio' | 'simulator'
  readonly name: string;
  sendSms(to: string, message: string, options?: SmsSendOptions): Promise<NotificationResult>;
  getStatus(providerMessageId: string): Promise<any>;
  getBalance(): Promise<SmsBalanceResult | null>;
  validatePhoneNumber(phoneNumber: string): boolean;
  normalizePhoneNumber(phoneNumber: string): string;
}
