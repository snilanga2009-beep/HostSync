import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';

export function recordAuditLog(params: {
  hotelId: string;
  userId?: string;
  userName?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: any;
  ipAddress?: string;
}) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (
        id, hotel_id, user_id, user_name, action, entity, entity_id, details_json, ip_address, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      uuidv4(),
      params.hotelId,
      params.userId || null,
      params.userName || 'System',
      params.action,
      params.entity,
      params.entityId || null,
      params.details ? JSON.stringify(params.details) : null,
      params.ipAddress || null
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
