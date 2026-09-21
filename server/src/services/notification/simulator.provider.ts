import { v4 as uuidv4 } from 'uuid';
import { SMSProvider, WhatsAppProvider, NotificationResult, JobNotificationPayload } from './notification.interface';

/**
 * Interactive In-App Simulator Provider for testing, demonstration,
 * carrier cost avoidance, and fallback verification.
 */
export class SimulatorSMSProvider implements SMSProvider {
  readonly name = 'Simulator SMS';
  private shouldFail: boolean = false;

  setSimulateFailure(fail: boolean) {
    this.shouldFail = fail;
  }

  async sendSMS(to: string, message: string): Promise<NotificationResult> {
    const messageId = `sim-sms-${uuidv4().substring(0, 12)}`;
    // Delay 300ms to simulate network dispatch
    await new Promise(r => setTimeout(r, 300));

    if (this.shouldFail) {
      return {
        success: false,
        provider: this.name,
        channel: 'SMS',
        status: 'FAILED',
        errorCode: 'SIM_SMS_DELIVERY_FAILED',
        errorMessage: 'Simulated SMS carrier delivery rejection (test mode).'
      };
    }

    return {
      success: true,
      provider: this.name,
      channel: 'SMS',
      providerMessageId: messageId,
      status: 'DELIVERED',
      rawResponse: { simulated: true, to, message, timestamp: new Date().toISOString() }
    };
  }
}

export class SimulatorWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'Simulator WhatsApp';
  private shouldFail: boolean = false;

  setSimulateFailure(fail: boolean) {
    this.shouldFail = fail;
  }

  async sendWhatsAppText(to: string, message: string): Promise<NotificationResult> {
    const messageId = `sim-wa-${uuidv4().substring(0, 12)}`;
    await new Promise(r => setTimeout(r, 300));

    if (this.shouldFail) {
      return {
        success: false,
        provider: this.name,
        channel: 'WhatsApp',
        status: 'FAILED',
        errorCode: 'SIM_WHATSAPP_UNREACHABLE',
        errorMessage: 'Simulated WhatsApp user unreachable / template rejected (triggering fallback).'
      };
    }

    return {
      success: true,
      provider: this.name,
      channel: 'WhatsApp',
      providerMessageId: messageId,
      status: 'DELIVERED',
      rawResponse: { simulated: true, to, message, timestamp: new Date().toISOString() }
    };
  }

  async sendWhatsApp(to: string, payload: JobNotificationPayload): Promise<NotificationResult> {
    const messageId = `sim-wa-${uuidv4().substring(0, 12)}`;
    await new Promise(r => setTimeout(r, 300));

    if (this.shouldFail) {
      return {
        success: false,
        provider: this.name,
        channel: 'WhatsApp',
        status: 'FAILED',
        errorCode: 'SIM_WHATSAPP_TIMEOUT',
        errorMessage: 'Simulated WhatsApp Business API timeout (test fallback).'
      };
    }

    return {
      success: true,
      provider: this.name,
      channel: 'WhatsApp',
      providerMessageId: messageId,
      status: 'DELIVERED',
      rawResponse: { simulated: true, to, payload, timestamp: new Date().toISOString() }
    };
  }
}
