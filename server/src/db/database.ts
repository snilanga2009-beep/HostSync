import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config';

// Ensure data directory exists
const dbDir = path.dirname(CONFIG.DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Ensure upload directory exists
if (!fs.existsSync(CONFIG.UPLOAD_DIR)) {
  fs.mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true });
}

export const db = new Database(CONFIG.DB_PATH);

// Optimize performance and enforce integrity
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

// Helper to safely add column if not already present
function addColumnIfNotExists(table: string, columnDef: string) {
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`).run();
  } catch (err: any) {
    // Column already exists, safe to ignore
  }
}

// Run schema initialization and migrations
export function initDatabase() {
  let schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.join(__dirname, '../../src/db/schema.sql');
  }
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.join(__dirname, '../src/db/schema.sql');
  }
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    // Apply migrations for columns that may be missing in existing databases
    // Staff Profiles
    addColumnIfNotExists('staff_profiles', "country_code TEXT DEFAULT '+1'");
    addColumnIfNotExists('staff_profiles', 'whatsapp_number TEXT');
    addColumnIfNotExists('staff_profiles', 'whatsapp_available INTEGER DEFAULT 1');
    addColumnIfNotExists('staff_profiles', 'sms_enabled INTEGER DEFAULT 1');
    addColumnIfNotExists('staff_profiles', 'whatsapp_enabled INTEGER DEFAULT 1');
    addColumnIfNotExists('staff_profiles', "preferred_channel TEXT DEFAULT 'whatsapp'");
    addColumnIfNotExists('staff_profiles', 'fallback_enabled INTEGER DEFAULT 1');
    addColumnIfNotExists('staff_profiles', "pin_code TEXT DEFAULT '1234'");

    // Maintenance Requests
    addColumnIfNotExists('maintenance_requests', 'completion_notes TEXT');
    addColumnIfNotExists('maintenance_requests', "before_photos_json TEXT DEFAULT '[]'");
    addColumnIfNotExists('maintenance_requests', "after_photos_json TEXT DEFAULT '[]'");
    addColumnIfNotExists('maintenance_requests', 'parts_used TEXT');
    addColumnIfNotExists('maintenance_requests', 'repair_cost REAL DEFAULT 0');
    addColumnIfNotExists('maintenance_requests', 'guest_signature_url TEXT');
    addColumnIfNotExists('maintenance_requests', 'completed_by_staff_id TEXT');
    addColumnIfNotExists('maintenance_requests', 'arrived_at DATETIME');
    addColumnIfNotExists('maintenance_requests', 'started_at DATETIME');

    // Dedicated SMS Logs & Providers tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS sms_logs (
          id TEXT PRIMARY KEY,
          job_id TEXT,
          staff_id TEXT,
          recipient TEXT NOT NULL,
          provider TEXT NOT NULL,
          sender_id TEXT,
          message TEXT NOT NULL,
          provider_message_id TEXT,
          status TEXT NOT NULL,
          error_code TEXT,
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          sent_at DATETIME,
          delivered_at DATETIME,
          failed_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS sms_providers (
          id TEXT PRIMARY KEY,
          hotel_id TEXT NOT NULL DEFAULT 'hotel-ocean-pearl',
          provider_key TEXT NOT NULL,
          provider_name TEXT NOT NULL,
          is_enabled INTEGER DEFAULT 0,
          is_primary INTEGER DEFAULT 0,
          api_token_encrypted TEXT,
          sender_id TEXT,
          api_url TEXT,
          cached_balance REAL,
          currency TEXT DEFAULT 'LKR',
          last_status TEXT DEFAULT 'active',
          last_error TEXT,
          last_tested_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_sms_logs_job ON sms_logs(job_id);
      CREATE INDEX IF NOT EXISTS idx_sms_logs_staff ON sms_logs(staff_id);
      CREATE INDEX IF NOT EXISTS idx_sms_logs_status ON sms_logs(status);
      CREATE INDEX IF NOT EXISTS idx_sms_logs_provider ON sms_logs(provider);
      CREATE INDEX IF NOT EXISTS idx_sms_providers_hotel ON sms_providers(hotel_id);
    `);

    console.log('✅ Database schema and migrations initialized successfully');

    // Auto-heal staff profiles: ensure technicians with phone numbers can receive SMS dispatch links
    try {
      db.prepare(`
        UPDATE staff_profiles
        SET sms_enabled = 1,
            fallback_enabled = 1,
            preferred_channel = CASE WHEN preferred_channel = 'whatsapp' THEN 'both' ELSE preferred_channel END
        WHERE sms_enabled = 0 OR fallback_enabled = 0 OR preferred_channel = 'whatsapp'
      `).run();
    } catch (err: any) {
      console.warn('Staff profiles auto-heal notice:', err.message);
    }

    // Auto-heal notification providers: ensure live SMS is configured if missing or empty
    try {
      const hotel = db.prepare('SELECT id FROM hotels LIMIT 1').get() as any;
      const hotelId = hotel ? hotel.id : 'hotel-ocean-pearl';
      const existingNotifRow = db.prepare(
        "SELECT value_json FROM settings WHERE hotel_id = ? AND category = 'notifications' AND key = 'providers'"
      ).get(hotelId) as any;

      let needsDefault = true;
      if (existingNotifRow?.value_json) {
        try {
          const parsed = JSON.parse(existingNotifRow.value_json);
          if (parsed.sriLankaSms?.apiKey && parsed.sriLankaSms.apiKey.length > 5 && parsed.mode === 'live') {
            needsDefault = false;
          }
        } catch (e) {}
      }

      if (needsDefault) {
        const defaultLiveSettings = {
          mode: 'live',
          publicBaseUrl: 'https://host-sync-new.vercel.app',
          smsProvider: 'srilanka',
          smsFallbackEnabled: true,
          sriLankaSms: {
            enabled: true,
            provider: 'srilanka',
            userId: '2561',
            apiKey: '4b60f716-fa34-4634-bfde-8567b33b1458',
            apiToken: '4b60f716-fa34-4634-bfde-8567b33b1458',
            senderId: 'SMSlenzDEMO',
            apiBaseUrl: 'https://smslenz.lk/api',
            apiUrl: 'https://smslenz.lk/api/send-sms'
          },
          twilioSms: {
            enabled: false,
            accountSid: '',
            authToken: '',
            phoneNumber: ''
          },
          whatsapp: {
            provider: 'simulator',
            autoFallbackToSms: true
          }
        };

        db.prepare(`
          INSERT INTO settings (id, hotel_id, category, key, value_json, updated_at)
          VALUES (?, ?, 'notifications', 'providers', ?, datetime('now'))
          ON CONFLICT(hotel_id, category, key) DO UPDATE SET
            value_json = excluded.value_json,
            updated_at = datetime('now')
        `).run(`set-notifications-providers-${hotelId}`, hotelId, JSON.stringify(defaultLiveSettings));
      }
    } catch (err: any) {
      console.warn('Providers settings auto-heal notice:', err.message);
    }

    // Auto-seed on first startup if hotels table is empty
    try {
      const hotelCheck = db.prepare('SELECT count(*) as count FROM hotels').get() as any;
      if (!hotelCheck || hotelCheck.count === 0) {
        console.log('🌱 Database is empty on first boot. Running initial seed...');
        import('./seed').then(m => {
          if (m.seed) m.seed();
        }).catch(err => console.error('Auto-seed failed:', err));
      }
    } catch (e) {}
  } else {
    console.error('❌ Schema file not found at:', schemaPath);
  }
}

// Call on startup
initDatabase();

