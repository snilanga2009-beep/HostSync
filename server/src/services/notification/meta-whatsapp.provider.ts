import { WhatsAppProvider, NotificationResult, JobNotificationPayload } from './notification.interface';

export interface MetaWhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  wabaId?: string;
  apiVersion?: string;
  templateName?: string;
  templateLanguage?: string;
}

export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'Direct WhatsApp (Meta Cloud API)';
  private config: MetaWhatsAppConfig | null;

  constructor(config?: MetaWhatsAppConfig) {
    this.config = config || null;
  }

  private cleanPhoneNumber(phone: string): string {
    // Meta requires country code with no +, spaces, dashes, or leading zeros
    return phone.replace(/[^0-9]/g, '');
  }

  async sendWhatsAppText(to: string, message: string, overrideConfig?: MetaWhatsAppConfig): Promise<NotificationResult> {
    const cfg = overrideConfig || this.config;
    if (!cfg || !cfg.phoneNumberId || !cfg.accessToken) {
      return {
        success: false,
        provider: this.name,
        channel: 'WhatsApp',
        status: 'FAILED',
        errorCode: 'META_WHATSAPP_NOT_CONFIGURED',
        errorMessage: 'Meta WhatsApp Cloud API credentials (Phone Number ID or Access Token) are missing.'
      };
    }

    const apiVersion = cfg.apiVersion || 'v21.0';
    const recipient = this.cleanPhoneNumber(to);

    try {
      const response = await fetch(`https://graph.facebook.com/${apiVersion}/${cfg.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfg.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipient,
          type: 'text',
          text: {
            preview_url: false,
            body: message
          }
        })
      });

      const data = (await response.json()) as any;

      if (!response.ok || data.error) {
        return {
          success: false,
          provider: this.name,
          channel: 'WhatsApp',
          status: 'FAILED',
          errorCode: data.error?.code ? `META_${data.error.code}` : `HTTP_${response.status}`,
          errorMessage: data.error?.message || 'Meta WhatsApp message send failed',
          rawResponse: data
        };
      }

      const messageId = data.messages?.[0]?.id || data.id;

      return {
        success: true,
        provider: this.name,
        channel: 'WhatsApp',
        providerMessageId: messageId,
        status: 'SENT',
        rawResponse: data
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        channel: 'WhatsApp',
        status: 'FAILED',
        errorCode: 'NETWORK_ERROR',
        errorMessage: err.message || 'Network error communicating with Meta WhatsApp Cloud API'
      };
    }
  }

  async sendWhatsApp(
    to: string,
    payload: JobNotificationPayload,
    templateSid?: string
  ): Promise<NotificationResult> {
    const cfg = this.config;
    if (!cfg || !cfg.phoneNumberId || !cfg.accessToken) {
      return {
        success: false,
        provider: this.name,
        channel: 'WhatsApp',
        status: 'FAILED',
        errorCode: 'META_WHATSAPP_NOT_CONFIGURED',
        errorMessage: 'Meta WhatsApp Cloud API credentials missing.'
      };
    }

    const apiVersion = cfg.apiVersion || 'v21.0';
    const recipient = this.cleanPhoneNumber(to);
    const templateName = cfg.templateName || 'resortcare_job_dispatch';
    const languageCode = cfg.templateLanguage || 'en_US';

    // 1. First attempt: Official WhatsApp Business Template
    try {
      const templateBody = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: payload.staffName || 'Staff Member' },
                { type: 'text', text: payload.roomNumber || 'Room' },
                { type: 'text', text: payload.priority || 'Normal' },
                { type: 'text', text: payload.jobUrl || '' }
              ]
            },
            {
              type: 'button',
              sub_type: 'url',
              index: '0',
              parameters: [
                { type: 'text', text: payload.jobToken || '' }
              ]
            }
          ]
        }
      };

      const response = await fetch(`https://graph.facebook.com/${apiVersion}/${cfg.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfg.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateBody)
      });

      const data = (await response.json()) as any;

      if (response.ok && !data.error && data.messages?.[0]?.id) {
        return {
          success: true,
          provider: this.name,
          channel: 'WhatsApp',
          providerMessageId: data.messages[0].id,
          status: 'SENT',
          rawResponse: data
        };
      }

      // If template was rejected (e.g. template doesn't exist yet on Meta), fallback to structured text message
      console.warn('Meta WhatsApp template failed, attempting text message fallback:', data.error?.message);
    } catch (templateErr) {
      console.warn('Meta WhatsApp template error, attempting text message fallback:', templateErr);
    }

    // 2. Fallback: Formatted Text Message with direct job URL
    const textMessage = `🔔 *ResortCare Job Assignment*\n\nHello ${payload.staffName || 'Staff'},\nYou have a new ${payload.priority || 'Normal'} priority ${payload.jobType || 'Maintenance'} task.\n\n📍 *Room*: ${payload.roomNumber}\n⚠️ *Issue*: ${payload.itemName || 'Equipment'} (${payload.problemType || 'Reported'})\n📝 *Note*: ${payload.description ? payload.description.substring(0, 100) : 'Check room'}\n\n👉 *Open Mobile Job Portal (No Login Required)*:\n${payload.jobUrl}\n\n_Sent via ResortCare Staff Notification System_`;

    return this.sendWhatsAppText(to, textMessage, cfg);
  }
}
