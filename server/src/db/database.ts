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

    console.log('✅ Database schema and migrations initialized successfully');
  } else {
    console.error('❌ Schema file not found at:', schemaPath);
  }
}

// Call on startup
initDatabase();

