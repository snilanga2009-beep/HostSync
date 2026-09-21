import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { CONFIG } from '../config';
import { recordAuditLog } from '../middleware/audit';

export interface JobTokenDetails {
  id: string;
  token: string;
  request_id: string;
  staff_id: string;
  hotel_id: string;
  room_id: string;
  expires_at: string;
  is_revoked: number;
  revoked_reason?: string;
  access_count: number;
}

export class JobTokenService {
  /**
   * Generates a cryptographically secure random token (URL-safe base64url)
   * that maps internally to Job, Staff, Hotel, and Room.
   */
  static createJobToken(params: {
    requestId: string;
    staffId: string;
    hotelId: string;
    roomId: string;
    expiryHours?: number;
  }): { id: string; token: string; jobUrl: string; expiresAt: string } {
    const { requestId, staffId, hotelId, roomId } = params;

    // Check admin configured expiry hours in settings
    let expiryHours = params.expiryHours || CONFIG.NOTIFICATION.DEFAULT_JOB_EXPIRY_HOURS;
    try {
      const setting = db.prepare(`
        SELECT value_json FROM settings WHERE hotel_id = ? AND category = 'notifications' AND key = 'job_link_expiration_hours'
      `).get(hotelId) as any;
      if (setting && setting.value_json) {
        const parsed = JSON.parse(setting.value_json);
        if (typeof parsed === 'number') expiryHours = parsed;
      }
    } catch (e) {
      // Use default
    }

    // 24 random bytes -> 32 characters base64url string
    const rawToken = crypto.randomBytes(24).toString('base64url');
    const id = `jtok-${uuidv4().substring(0, 8)}`;

    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);

    db.prepare(`
      INSERT INTO job_tokens (
        id, token, request_id, staff_id, hotel_id, room_id, expires_at,
        is_revoked, access_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, datetime('now'))
    `).run(id, rawToken, requestId, staffId, hotelId, roomId, expiresAt);

    const jobUrl = `${CONFIG.BASE_URL}/job/${rawToken}`;

    recordAuditLog({
      hotelId,
      action: 'JOB_TOKEN_CREATED',
      entity: 'job_tokens',
      entityId: id,
      details: { requestId, staffId, expiryHours, expiresAt }
    });

    return { id, token: rawToken, jobUrl, expiresAt };
  }

  /**
   * Validates a job token, checking revocation, expiration, and job status.
   */
  static validateJobToken(token: string, clientIp?: string, userAgent?: string): {
    valid: boolean;
    errorStatus?: 400 | 401 | 403 | 404 | 410;
    errorCode?: string;
    errorMessage?: string;
    tokenRecord?: any;
    job?: any;
    staff?: any;
  } {
    if (!token || typeof token !== 'string') {
      return { valid: false, errorStatus: 400, errorCode: 'INVALID_TOKEN_FORMAT', errorMessage: 'Invalid job token format.' };
    }

    const tokenRecord = db.prepare(`
      SELECT jt.*, datetime('now') as server_now
      FROM job_tokens jt
      WHERE jt.token = ?
    `).get(token) as any;

    if (!tokenRecord) {
      return { valid: false, errorStatus: 404, errorCode: 'TOKEN_NOT_FOUND', errorMessage: 'Job link not found or invalid.' };
    }

    if (tokenRecord.is_revoked === 1) {
      return {
        valid: false,
        errorStatus: 403,
        errorCode: 'TOKEN_REVOKED',
        errorMessage: tokenRecord.revoked_reason || 'This job link has been revoked or reassigned.'
      };
    }

    // Expiration check
    if (new Date(tokenRecord.expires_at).getTime() < Date.now()) {
      return {
        valid: false,
        errorStatus: 410,
        errorCode: 'TOKEN_EXPIRED',
        errorMessage: 'This job link has expired. Tap below to request a new link.'
      };
    }

    // Load maintenance request & assigned staff details
    const job = db.prepare(`
      SELECT mr.*,
             r.room_number, r.name as room_name,
             b.name as building_name, f.name as floor_name,
             h.name as hotel_name, h.logo_url as hotel_logo, h.phone as hotel_phone,
             sa.id as assignment_id, sa.status as assignment_status, sa.assigned_at,
             (SELECT u.full_name FROM users u WHERE u.id = sa.assigned_by_user_id) as assigned_by_name,
             (SELECT GROUP_CONCAT(mri.item_name || ' (' || mri.problem_type || ')', ', ')
              FROM maintenance_request_items mri WHERE mri.request_id = mr.id) as items_summary
      FROM maintenance_requests mr
      JOIN rooms r ON mr.room_id = r.id
      JOIN hotels h ON mr.hotel_id = h.id
      LEFT JOIN buildings b ON r.building_id = b.id
      LEFT JOIN floors f ON r.floor_id = f.id
      LEFT JOIN staff_assignments sa ON sa.request_id = mr.id AND sa.staff_id = ? AND sa.status != 'Reassigned'
      WHERE mr.id = ?
    `).get(tokenRecord.staff_id, tokenRecord.request_id) as any;

    if (!job) {
      return { valid: false, errorStatus: 404, errorCode: 'JOB_NOT_FOUND', errorMessage: 'Associated job request was not found.' };
    }

    const staff = db.prepare(`
      SELECT sp.*, u.full_name, u.email, u.role
      FROM staff_profiles sp
      JOIN users u ON sp.user_id = u.id
      WHERE sp.id = ?
    `).get(tokenRecord.staff_id) as any;

    // Track access count and timestamp
    try {
      db.prepare(`
        UPDATE job_tokens
        SET access_count = access_count + 1,
            last_accessed_at = datetime('now'),
            ip_address = COALESCE(?, ip_address),
            device_info = COALESCE(?, device_info)
        WHERE id = ?
      `).run(clientIp || null, userAgent ? userAgent.substring(0, 150) : null, tokenRecord.id);
    } catch (e) {
      // Non-critical
    }

    return { valid: true, tokenRecord, job, staff };
  }

  /**
   * Revoke tokens for a request (e.g. when reassigned or cancelled)
   */
  static revokeTokensForRequest(requestId: string, reason: string = 'Job reassigned or cancelled'): void {
    db.prepare(`
      UPDATE job_tokens
      SET is_revoked = 1, revoked_reason = ?
      WHERE request_id = ? AND is_revoked = 0
    `).run(reason, requestId);
  }
}
