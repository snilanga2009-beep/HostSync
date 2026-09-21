export interface JobNotificationPayload {
  hotelName: string;
  roomNumber: string;
  jobType: string; // 'Maintenance' | 'Room Service' | 'Housekeeping'
  itemName?: string;
  problemType?: string;
  priority: string; // 'Normal' | 'High' | 'Emergency'
  description?: string;
  jobUrl: string;
  jobToken: string;
  assignedByName?: string;
  createdAt?: string;
  staffName?: string;
}

export interface NotificationResult {
  success: boolean;
  provider: string;
  channel: 'SMS' | 'WhatsApp';
  providerMessageId?: string;
  status: 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'READ';
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: any;
}

export interface SMSProvider {
  readonly name: string;
  sendSMS(to: string, message: string): Promise<NotificationResult>;
}

export interface WhatsAppProvider {
  readonly name: string;
  sendWhatsApp(to: string, payload: JobNotificationPayload, templateSid?: string): Promise<NotificationResult>;
  sendWhatsAppText(to: string, message: string): Promise<NotificationResult>;
}

export interface NotificationLogRecord {
  id: string;
  job_id?: string;
  staff_id?: string;
  channel: 'SMS' | 'WhatsApp';
  provider: string;
  recipient: string;
  message_template?: string;
  provider_message_id?: string;
  status: 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'READ';
  sent_at?: string;
  delivered_at?: string;
  failed_at?: string;
  error_code?: string;
  error_message?: string;
  retry_count: number;
  fallback_used: number;
  payload_json?: string;
  created_at: string;
}
