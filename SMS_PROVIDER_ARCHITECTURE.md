# SMS Provider Architecture & Developer Guide

This document describes the modular architecture of the SMS subsystem in ResortCare / HostSync and outlines how to add new Sri Lankan or international SMS gateways.

---

## 1. Architectural Design

The notification subsystem decouples SMS transport from business logic using the **Strategy Pattern** and a centralized **Manager Orchestrator**:

```
+-------------------------------------------------------------+
|                  Hotel Business Logic                       |
|   (Job Assignment, Direct Testing, Guest Status Updates)    |
+-------------------------------------------------------------+
                              |
                              v
             NotificationService.sendJobAssigned()
                              |
                              v
                   SmsManagerService (Singleton)
          +-------------------+--------------------+
          |                   |                    |
          v                   v                    v
+--------------------+ +-------------+ +---------------------+
| SriLankaSmsProvider| |TwilioAdapter| |SimulatorSmsAdapter  |
|     (Text.lk)      | |  (Fallback) | |     (Sandbox)       |
+--------------------+ +-------------+ +---------------------+
          |                   |
          v                   v
   app.text.lk          api.twilio.com
```

### Key Components

| File | Purpose |
|------|---------|
| `server/src/services/notification/sms/sms.interface.ts` | Base `SmsProvider` interface and types (`SmsSendOptions`, `SmsSendResult`, `SmsBalanceResult`). |
| `server/src/services/notification/sms/srilanka.provider.ts` | Concrete implementation for Text.lk REST API with number normalization, validation, and balance checks. |
| `server/src/services/notification/sms/twilio-sms.adapter.ts` | Adapter wrapping Twilio Programmable SMS API as an `SmsProvider`. |
| `server/src/services/notification/sms/simulator-sms.adapter.ts` | Mock provider for zero-cost local testing without carrier credentials. |
| `server/src/services/notification/sms/sms-manager.service.ts` | Orchestrator responsible for provider selection, sliding-window rate limiting, automatic fallback (`srilanka` &rarr; `twilio`), and database auditing. |

---

## 2. Core Interface (`SmsProvider`)

Every SMS gateway in ResortCare implements `SmsProvider`:

```typescript
export interface SmsProvider {
  readonly id: string;
  readonly name: string;

  /**
   * Send an SMS message
   */
  sendSms(options: SmsSendOptions): Promise<SmsSendResult>;

  /**
   * Check connection status / credentials validity
   */
  getStatus(): Promise<{ ready: boolean; message: string }>;

  /**
   * Fetch remaining account balance or credits (if supported)
   */
  getBalance?(): Promise<SmsBalanceResult>;

  /**
   * Validate recipient phone number format
   */
  validatePhoneNumber(phoneNumber: string): boolean;

  /**
   * Normalize number to gateway-expected format
   */
  normalizePhoneNumber(phoneNumber: string): string;
}
```

---

## 3. How to Add a New Sri Lankan Gateway

To add another Sri Lankan provider (such as **Dialog Enterprise Axiata**, **Mobitel mConnect**, **ShoutOUT**, or **Notify.lk**):

### Step 1: Create the Provider Class
Create a new file in `server/src/services/notification/sms/`, e.g. `dialog.provider.ts`:

```typescript
import axios from 'axios';
import { SmsProvider, SmsSendOptions, SmsSendResult, SmsBalanceResult } from './sms.interface';

export class DialogSmsProvider implements SmsProvider {
  readonly id = 'dialog';
  readonly name = 'Dialog Enterprise Axiata SMS';

  constructor(
    private username: string,
    private password: string,
    private sourceAddress: string = 'HOTELNAME'
  ) {}

  normalizePhoneNumber(phoneNumber: string): string {
    const digits = phoneNumber.replace(/[^0-9]/g, '');
    if (digits.startsWith('94') && digits.length === 11) return digits;
    if (digits.startsWith('0') && digits.length === 10) return '94' + digits.substring(1);
    if (digits.startsWith('7') && digits.length === 9) return '94' + digits;
    return digits;
  }

  validatePhoneNumber(phoneNumber: string): boolean {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    // Sri Lanka Mobile: 94 + (70, 71, 72, 74, 75, 76, 77, 78) + 7 digits
    return /^947[01245678][0-9]{7}$/.test(normalized);
  }

  async sendSms(options: SmsSendOptions): Promise<SmsSendResult> {
    if (!this.validatePhoneNumber(options.recipient)) {
      return {
        success: false,
        error: `Invalid Sri Lankan phone number: ${options.recipient}`,
        provider: this.id
      };
    }

    const recipient = this.normalizePhoneNumber(options.recipient);

    try {
      const response = await axios.post('https://esms.dialog.lk/api/v1/sms', {
        sourceAddress: this.sourceAddress,
        message: options.message,
        msisdn: [recipient]
      }, {
        auth: { username: this.username, password: this.password },
        timeout: 10000
      });

      return {
        success: true,
        messageId: response.data?.txId,
        provider: this.id,
        status: 'SENT'
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.message || err.message,
        provider: this.id,
        status: 'FAILED'
      };
    }
  }

  async getStatus(): Promise<{ ready: boolean; message: string }> {
    return { ready: Boolean(this.username && this.password), message: 'Dialog SMS ready' };
  }
}
```

### Step 2: Register in `SmsManagerService`
In `server/src/services/notification/sms/sms-manager.service.ts`:
1. Import `DialogSmsProvider`.
2. Add a factory branch in `createProvider(type)`:
```typescript
case 'dialog':
  return new DialogSmsProvider(
    config.DIALOG_SMS.USERNAME,
    config.DIALOG_SMS.PASSWORD,
    config.DIALOG_SMS.SENDER_ID
  );
```

### Step 3: Add to Settings & Admin UI
1. Add configuration keys in `server/src/config.ts`.
2. Add provider dropdown option in `client/src/components/admin/NotificationGatewaySettings.tsx`.

---

## 4. Database Audit Schema

All SMS dispatches are tracked with high-resolution audit logs in `sms_logs`:

```sql
CREATE TABLE IF NOT EXISTS sms_logs (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  staff_id TEXT,
  provider TEXT NOT NULL,          -- 'srilanka_textlk' | 'twilio' | 'simulator'
  recipient TEXT NOT NULL,         -- Normalized E.164 / SL number
  message TEXT NOT NULL,           -- Formatted SMS body
  message_id TEXT,                 -- Gateway transmission ID
  status TEXT NOT NULL,            -- 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED'
  error_message TEXT,              -- Failure details or telco reject reason
  fallback_used INTEGER DEFAULT 0, -- 1 if primary provider failed and fallback succeeded
  fallback_provider TEXT,          -- Name of fallback gateway (e.g. 'twilio')
  cost REAL DEFAULT 0,             -- Per-message tariff (e.g. LKR 0.50)
  currency TEXT DEFAULT 'LKR',
  metadata TEXT,                   -- JSON payload of webhook and delivery events
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  delivered_at DATETIME
);
```

`SmsManagerService` simultaneously updates `notification_logs` to maintain backward compatibility with Front Office live event feeds and real-time dashboard counters.
