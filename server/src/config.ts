import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  JWT_SECRET: process.env.JWT_SECRET || 'resortcare-super-secret-jwt-token-key-2026',
  JWT_EXPIRES_IN: '7d',
  DB_PATH: process.env.DB_PATH || path.join(__dirname, '../../data/resortcare.db'),
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'),
  BASE_URL: process.env.BASE_URL || 'http://localhost:5173',
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:5000',
  SQUARE: {
    ENVIRONMENT: process.env.SQUARE_ENVIRONMENT || 'sandbox',
    APPLICATION_ID: process.env.SQUARE_APPLICATION_ID || 'sandbox-sq0idb-demo',
    ACCESS_TOKEN: process.env.SQUARE_ACCESS_TOKEN || '',
    LOCATION_ID: process.env.SQUARE_LOCATION_ID || 'L_DEMO_LOCATION',
    WEBHOOK_SIGNATURE_KEY: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || 'sandbox_webhook_secret'
  },
  TWILIO: {
    ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
    AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
    PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',
    WHATSAPP_SENDER: process.env.TWILIO_WHATSAPP_SENDER || 'whatsapp:+14155238886',
    WHATSAPP_ENABLED: process.env.TWILIO_WHATSAPP_ENABLED === 'true',
    CONTENT_TEMPLATE_SID: process.env.TWILIO_CONTENT_TEMPLATE_SID || 'HXb5b62575e6e4d61dc12a0049f15430ed'
  },
  NOTIFICATION: {
    DEFAULT_JOB_EXPIRY_HOURS: parseInt(process.env.JOB_TOKEN_EXPIRY_HOURS || '24', 10),
    MAX_RETRY_ATTEMPTS: 3
  }
};

