import { SmsProvider, SmsSendOptions, SmsBalanceResult } from './sms.interface';
import { NotificationResult } from '../notification.interface';
import { SimulatorSMSProvider } from '../simulator.provider';

export class SimulatorSmsAdapter implements SmsProvider {
  readonly key: string = 'simulator';
  readonly name: string = 'Sandbox SMS Simulator';
  private client: SimulatorSMSProvider;

  constructor() {
    this.client = new SimulatorSMSProvider();
  }

  public normalizePhoneNumber(phoneNumber: string): string {
    return (phoneNumber || '').replace(/[\s\-\(\)]/g, '');
  }

  public validatePhoneNumber(phoneNumber: string): boolean {
    return Boolean(phoneNumber && phoneNumber.trim().length >= 7);
  }

  public async sendSms(to: string, message: string, _options?: SmsSendOptions): Promise<NotificationResult> {
    const res = await this.client.sendSMS(to, message);
    return {
      ...res,
      provider: 'simulator'
    };
  }

  public async getStatus(_providerMessageId: string): Promise<any> {
    return { status: 'DELIVERED', simulated: true };
  }

  public async getBalance(): Promise<SmsBalanceResult | null> {
    return {
      balance: 9999.00,
      currency: 'LKR',
      ratePerSms: 0.00
    };
  }
}
