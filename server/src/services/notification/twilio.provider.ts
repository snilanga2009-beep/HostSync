import { CONFIG } from '../../config';
import { SMSProvider, WhatsAppProvider, NotificationResult, JobNotificationPayload } from './notification.interface';

export interface TwilioConfig {
  accountSid?: string;
  authToken?: string;
  phoneNumber?: string;
  whatsappSender?: string;
  contentTemplateSid?: string;
}

export class TwilioSMSProvider implements SMSProvider {
  readonly name = 'Twilio SMS';
  constructor(private config?: TwilioConfig) {}

  async getBalance(): Promise<{ balance: number; currency: string } | null> {
    const ACCOUNT_SID = (this.config?.accountSid || CONFIG.TWILIO.ACCOUNT_SID || '').trim();
    const AUTH_TOKEN = (this.config?.authToken || CONFIG.TWILIO.AUTH_TOKEN || '').trim();
    if (!ACCOUNT_SID || !AUTH_TOKEN) return null;

    try {
      const authHeader = 'Basic ' + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Balance.json`, {
        headers: { Authorization: authHeader }
      });
      if (!response.ok) return null;
      const data = await response.json() as any;
      return {
        balance: parseFloat(data.balance || '0'),
        currency: data.currency || 'USD'
      };
    } catch {
      return null;
    }
  }

  async getStatus(providerMessageId: string): Promise<any> {
    const ACCOUNT_SID = (this.config?.accountSid || CONFIG.TWILIO.ACCOUNT_SID || '').trim();
    const AUTH_TOKEN = (this.config?.authToken || CONFIG.TWILIO.AUTH_TOKEN || '').trim();
    if (!ACCOUNT_SID || !AUTH_TOKEN || !providerMessageId) return null;

    try {
      const authHeader = 'Basic ' + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages/${providerMessageId}.json`, {
        headers: { Authorization: authHeader }
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  async sendSMS(to: string, message: string): Promise<NotificationResult> {
    const ACCOUNT_SID = (this.config?.accountSid || CONFIG.TWILIO.ACCOUNT_SID || '').trim();
    const AUTH_TOKEN = (this.config?.authToken || CONFIG.TWILIO.AUTH_TOKEN || '').trim();
    const PHONE_NUMBER = (this.config?.phoneNumber || CONFIG.TWILIO.PHONE_NUMBER || '').trim();

    if (!ACCOUNT_SID || !AUTH_TOKEN || !PHONE_NUMBER) {
      return {
        success: false,
        provider: this.name,
        channel: 'SMS',
        status: 'FAILED',
        errorCode: 'TWILIO_NOT_CONFIGURED',
        errorMessage: 'Twilio credentials (ACCOUNT_SID, AUTH_TOKEN, or PHONE_NUMBER) are missing in server config.'
      };
    }

    try {
      const authHeader = 'Basic ' + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');
      const params = new URLSearchParams();
      params.append('From', PHONE_NUMBER);
      params.append('To', to);
      params.append('Body', message);

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      let data: any = {};
      try {
        data = await response.json();
      } catch {
        data = { message: `Twilio responded with HTTP ${response.status}` };
      }

      if (!response.ok) {
        return {
          success: false,
          provider: this.name,
          channel: 'SMS',
          status: 'FAILED',
          errorCode: String(data.code || response.status),
          errorMessage: data.message || 'Twilio SMS request failed',
          rawResponse: data
        };
      }

      return {
        success: true,
        provider: this.name,
        channel: 'SMS',
        providerMessageId: data.sid,
        status: (data.status === 'delivered' ? 'DELIVERED' : (data.status === 'sent' ? 'SENT' : 'QUEUED')),
        rawResponse: data
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        channel: 'SMS',
        status: 'FAILED',
        errorCode: 'NETWORK_ERROR',
        errorMessage: err.message || 'Network error communicating with Twilio'
      };
    }
  }
}

export class TwilioWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'Twilio WhatsApp';
  constructor(private config?: TwilioConfig) {}

  private formatWhatsAppNumber(phone: string): string {
    const cleaned = phone.trim().replace(/^whatsapp:/i, '');
    return cleaned.startsWith('+') ? `whatsapp:${cleaned}` : `whatsapp:+${cleaned}`;
  }

  async sendWhatsAppText(to: string, message: string): Promise<NotificationResult> {
    const ACCOUNT_SID = this.config?.accountSid || CONFIG.TWILIO.ACCOUNT_SID;
    const AUTH_TOKEN = this.config?.authToken || CONFIG.TWILIO.AUTH_TOKEN;
    const WHATSAPP_SENDER = this.config?.whatsappSender || CONFIG.TWILIO.WHATSAPP_SENDER;

    if (!ACCOUNT_SID || !AUTH_TOKEN) {
      return {
        success: false,
        provider: this.name,
        channel: 'WhatsApp',
        status: 'FAILED',
        errorCode: 'TWILIO_NOT_CONFIGURED',
        errorMessage: 'Twilio WhatsApp credentials missing in server config.'
      };
    }

    try {
      const authHeader = 'Basic ' + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');
      const params = new URLSearchParams();
      params.append('From', WHATSAPP_SENDER);
      params.append('To', this.formatWhatsAppNumber(to));
      params.append('Body', message);

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      const data = await response.json() as any;

      if (!response.ok) {
        return {
          success: false,
          provider: this.name,
          channel: 'WhatsApp',
          status: 'FAILED',
          errorCode: String(data.code || response.status),
          errorMessage: data.message || 'Twilio WhatsApp request failed',
          rawResponse: data
        };
      }

      return {
        success: true,
        provider: this.name,
        channel: 'WhatsApp',
        providerMessageId: data.sid,
        status: (data.status === 'delivered' ? 'DELIVERED' : (data.status === 'sent' ? 'SENT' : 'QUEUED')),
        rawResponse: data
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        channel: 'WhatsApp',
        status: 'FAILED',
        errorCode: 'NETWORK_ERROR',
        errorMessage: err.message
      };
    }
  }

  async sendWhatsApp(to: string, payload: JobNotificationPayload, templateSid?: string): Promise<NotificationResult> {
    const ACCOUNT_SID = this.config?.accountSid || CONFIG.TWILIO.ACCOUNT_SID;
    const AUTH_TOKEN = this.config?.authToken || CONFIG.TWILIO.AUTH_TOKEN;
    const WHATSAPP_SENDER = this.config?.whatsappSender || CONFIG.TWILIO.WHATSAPP_SENDER;
    const CONTENT_TEMPLATE_SID = this.config?.contentTemplateSid || CONFIG.TWILIO.CONTENT_TEMPLATE_SID;

    if (!ACCOUNT_SID || !AUTH_TOKEN) {
      return {
        success: false,
        provider: this.name,
        channel: 'WhatsApp',
        status: 'FAILED',
        errorCode: 'TWILIO_NOT_CONFIGURED',
        errorMessage: 'Twilio credentials not configured'
      };
    }

    try {
      const authHeader = 'Basic ' + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');
      const params = new URLSearchParams();
      params.append('From', WHATSAPP_SENDER);
      params.append('To', this.formatWhatsAppNumber(to));

      const useTemplate = templateSid || CONTENT_TEMPLATE_SID;

      // When template SID is available and approved:
      if (useTemplate) {
        params.append('ContentSid', useTemplate);
        params.append('ContentVariables', JSON.stringify({
          '1': payload.staffName || 'Technician',
          '2': payload.jobType || 'Maintenance',
          '3': payload.hotelName || 'Ocean Pearl Resort',
          '4': payload.roomNumber,
          '5': `${payload.itemName || 'Equipment'}: ${payload.problemType || 'Issue reported'}`,
          '6': payload.priority
        }));
      } else {
        // Direct WhatsApp text message fallback
        const body =
`🔧 *New Hotel Job Assignment*
*Hotel:* ${payload.hotelName}
*Room:* ${payload.roomNumber}
*Priority:* ${payload.priority === 'Emergency' ? '🚨 EMERGENCY' : (payload.priority === 'High' ? '🔴 HIGH' : 'NORMAL')}
*Issue:* ${payload.itemName || 'Item'} - ${payload.problemType || 'Reported Issue'}
${payload.description ? `*Details:* ${payload.description}\\n` : ''}
Tap link to view & accept job:
${payload.jobUrl}`;
        params.append('Body', body);
      }

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      const data = await response.json() as any;

      if (!response.ok) {
        return {
          success: false,
          provider: this.name,
          channel: 'WhatsApp',
          status: 'FAILED',
          errorCode: String(data.code || response.status),
          errorMessage: data.message || 'WhatsApp template dispatch failed',
          rawResponse: data
        };
      }

      return {
        success: true,
        provider: this.name,
        channel: 'WhatsApp',
        providerMessageId: data.sid,
        status: (data.status === 'delivered' ? 'DELIVERED' : (data.status === 'sent' ? 'SENT' : 'QUEUED')),
        rawResponse: data
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        channel: 'WhatsApp',
        status: 'FAILED',
        errorCode: 'NETWORK_ERROR',
        errorMessage: err.message
      };
    }
  }
}
