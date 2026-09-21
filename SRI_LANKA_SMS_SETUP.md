# Sri Lanka SMS Gateway Setup Guide (Text.lk REST API)

This guide walks you through configuring the dedicated **Sri Lanka SMS Provider** in the ResortCare / HostSync hotel maintenance platform.

---

## 1. Overview & Architecture

ResortCare features a modular SMS provider architecture tailored for Sri Lankan hospitality properties:

* **Primary Sri Lanka SMS Gateway**: Powered by [Text.lk](https://text.lk/) REST API (v3).
* **Automatic Phone Normalization**: Automatically converts all common Sri Lankan mobile formats (`0771234567`, `+94771234567`, `94771234567`) to the required 11-digit format `947XXXXXXXX`.
* **Telco Prefix Validation**: Validates Dialog (074, 076, 077), Mobitel (070, 071), Airtel (075), and Hutch (072, 078). Invalid numbers or landlines (`011...`) are rejected before hitting the API to conserve wallet credits.
* **Optional Twilio SMS Fallback**: If Sri Lanka SMS delivery fails or your SMS balance runs out, ResortCare can automatically retry dispatching the message using Twilio SMS.
* **Zero-Cost Free-Tier Mode**: If you disable SMS dispatch, the hotel system continues operating normally at zero cost using in-app real-time alerts and WhatsApp.

---

## 2. Text.lk Account Setup & Sender ID Registration

### Step 1: Create a Text.lk Account
1. Visit [https://text.lk](https://text.lk) or [https://app.text.lk](https://app.text.lk).
2. Register your company or hotel profile.
3. Top up your wallet in Sri Lankan Rupees (LKR) via credit/debit card or bank transfer.

### Step 2: Register your TRCSL Sender ID (Mask)
Under Sri Lankan Telecommunications Regulatory Commission (TRCSL) regulations, transactional SMS requires a registered Sender ID (e.g. `HOTELNAME`, `RESORTCARE`, max 11 alphanumeric characters):
1. In the Text.lk dashboard, navigate to **Sender IDs &rarr; Request Sender ID**.
2. Submit your hotel business registration certificate (BR) and request your desired mask (e.g., `HERITANCE`, `CINNAMON`).
3. While your custom Sender ID is being approved by TRCSL, Text.lk provides a default or promotional testing mask.

### Step 3: Generate an API Token
1. Go to **Developer &rarr; API Tokens** or **Integrations**.
2. Click **Generate New Token**.
3. Copy the bearer token (e.g. `123|abcdef...`).

---

## 3. Configuring ResortCare

You can configure the Sri Lanka SMS provider either via the Admin Web Interface or via Environment Variables.

### Option A: Admin Web Interface (Recommended)
1. Log in to the ResortCare Admin Dashboard.
2. Navigate to **System Settings &rarr; SMS & WhatsApp Gateways** (`/admin/settings?tab=gateways`).
3. Under **SMS Gateway Provider Architecture**, select **🇱🇰 Sri Lanka SMS (Text.lk)**.
4. Fill in the **API Information** fields:
   * **User ID**: Your SMS gateway user/account identifier (e.g. `USER-10824` or client ID).
   * **API Key**: Paste your Bearer API Key / Token generated from the SMS developer portal.
   * **API Base URL**: Gateway endpoint URL (Default: `https://app.text.lk/api/v3` or custom endpoint).
   * **TRCSL Sender ID**: Enter your approved mask (e.g., `HOTELNAME`).
5. Click **Verify Text.lk Connection** to validate credentials.
6. Click **Check SMS Wallet Balance** to confirm your available LKR balance.
7. (Optional) Check **Automatic Fallback to Twilio SMS** if you have Twilio credentials configured.
8. Click **Save All Gateway Settings**.

### Option B: Environment Variables (`.env`)
You can also specify default credentials in your server `.env`:
```env
# SMS Gateway Selection ('srilanka' | 'twilio' | 'disabled')
SMS_PROVIDER=srilanka
SMS_FALLBACK_ENABLED=true

# Sri Lanka SMS Gateway API Information
SRI_LANKA_SMS_ENABLED=true
SRI_LANKA_SMS_PROVIDER=textlk
SRI_LANKA_SMS_USER_ID=your_user_id_here
SRI_LANKA_SMS_API_KEY=your_api_key_or_token_here
SRI_LANKA_SMS_API_BASE_URL=https://app.text.lk/api/v3
SRI_LANKA_SMS_SENDER_ID=HOTELNAME
SRI_LANKA_SMS_API_URL=https://app.text.lk/api/v3/sms/send

# Twilio SMS (Optional Secondary / Fallback)
TWILIO_SMS_ENABLED=false
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_PHONE_NUMBER=+13055550199
```

---

## 4. Real-Time Delivery Reports (DLR) Webhook

To track delivery statuses (Delivered, Sent, Failed) in real time:

1. Copy your ResortCare Webhook URL:
   ```
   https://YOUR_DOMAIN/api/webhooks/sri-lanka-sms
   ```
2. Log in to your **Text.lk Dashboard &rarr; Webhooks / DLR Settings**.
3. Set the delivery callback URL to the address above.
4. When a message is delivered to a staff member's phone, Text.lk automatically notifies ResortCare via `POST /api/webhooks/sri-lanka-sms`, updating both `sms_logs` and the live front-office dashboard via Server-Sent Events (SSE).

---

## 5. Live Testing & Diagnostics

ResortCare includes a built-in 3-step diagnostic test console in the Admin Gateway Settings:

1. Enter a technician's Sri Lankan mobile number (e.g., `0771234567`).
2. Click **Send Test**.
3. View the live 3-step status badges:
   * `✓ Phone Valid (SL Format)`: Verified valid Dialog/Mobitel/Airtel/Hutch prefix and normalized to `947XXXXXXXX`.
   * `✓ Text.lk API Authenticated`: HTTP 200 response with valid Bearer token.
   * `✓ Gateway Accepted`: Message accepted into carrier queue with gateway reference ID.

---

## 6. SMS Dispatch Template

When a job is assigned to a technician, ResortCare generates a concise, telco-compliant SMS formatted within 160 characters (1 standard SMS credit):

```
ResortCare: New Job
Room: {roomNumber}
Issue: {shortTitle}
Priority: {priority}
Action: https://{domain}/job/{token}
```

Technicians can tap the secure one-click link to open the job details without logging into the full admin portal.
