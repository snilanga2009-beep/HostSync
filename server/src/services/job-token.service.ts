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

    // Self-healing signed token encoding: encodes requestId, staffId, hotelId, roomId, and expiration
    const expTime = Date.now() + expiryHours * 60 * 60 * 1000;
    const payloadObj = { r: requestId, s: staffId, h: hotelId, m: roomId, e: expTime };
    const payloadB64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
    const signature = crypto.createHmac('sha256', CONFIG.JWT_SECRET).update(payloadB64).digest('base64url').substring(0, 16);
    const rawToken = `${payloadB64}.${signature}`;
    const id = `jtok-${uuidv4().substring(0, 8)}`;

    const expiresAt = new Date(expTime)
      .toISOString()
      .replace('T', ' ')
      .substring(0, 19);

    try {
      db.prepare(`
        INSERT INTO job_tokens (
          id, token, request_id, staff_id, hotel_id, room_id, expires_at,
          is_revoked, access_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, datetime('now'))
      `).run(id, rawToken, requestId, staffId, hotelId, roomId, expiresAt);
    } catch (err: any) {
      console.warn('Could not insert job_token into DB:', err.message);
    }

    // Resolve accessible base URL for mobile smartphones
    let baseWebUrl = CONFIG.BASE_URL;
    try {
      const row = db.prepare(`
        SELECT value_json FROM settings WHERE hotel_id = ? AND category = 'notifications' AND key = 'providers'
      `).get(hotelId) as any;
      if (row?.value_json) {
        const p = JSON.parse(row.value_json);
        if (p.publicBaseUrl && typeof p.publicBaseUrl === 'string' && p.publicBaseUrl.trim().startsWith('http')) {
          baseWebUrl = p.publicBaseUrl.trim().replace(/\/$/, '');
        }
      }
    } catch {}

    if (baseWebUrl.includes('localhost')) {
      if (process.env.PUBLIC_URL && process.env.PUBLIC_URL.startsWith('http')) {
        baseWebUrl = process.env.PUBLIC_URL.trim().replace(/\/$/, '');
      } else {
        // Auto-detect local Wi-Fi / LAN IP for mobile device access on same network
        try {
          const os = require('os');
          const nets = os.networkInterfaces();
          for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
              if (net.family === 'IPv4' && !net.internal) {
                baseWebUrl = `http://${net.address}:5173`;
                break;
              }
            }
            if (!baseWebUrl.includes('localhost')) break;
          }
        } catch {}
      }
    }

    const jobUrl = `${baseWebUrl}/job/${rawToken}`;

    recordAuditLog({
      hotelId,
      action: 'JOB_TOKEN_CREATED',
      entity: 'job_tokens',
      entityId: id,
      details: { requestId, staffId, expiryHours, expiresAt, jobUrl }
    });

    return { id, token: rawToken, jobUrl, expiresAt };
  }

  /**
   * Validates a job token, checking revocation, expiration, and job status.
   * Features self-healing fallback to allow access even after server reboot or container redeployment.
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

    const cleanToken = token.trim().replace(/[.,;:/?#]+$/, '');

    let tokenRecord = db.prepare(`
      SELECT jt.*, datetime('now') as server_now
      FROM job_tokens jt
      WHERE jt.token = ?
    `).get(cleanToken) as any;

    // Self-healing fallback: If not found in SQLite (e.g. server container rebooted or disk reset), verify HMAC signature
    if (!tokenRecord && cleanToken.includes('.')) {
      const [payloadPart, sigPart] = cleanToken.split('.');
      if (payloadPart && sigPart) {
        const expectedSig = crypto.createHmac('sha256', CONFIG.JWT_SECRET).update(payloadPart).digest('base64url').substring(0, 16);
        if (sigPart === expectedSig) {
          try {
            const decoded = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
            if (decoded.r && decoded.s) {
              const expDate = new Date(decoded.e || (Date.now() + 48 * 3600 * 1000));
              const expiresAt = expDate.toISOString().replace('T', ' ').substring(0, 19);
              const autoId = `jtok-${uuidv4().substring(0, 8)}`;
              try {
                db.prepare(`
                  INSERT OR IGNORE INTO job_tokens (
                    id, token, request_id, staff_id, hotel_id, room_id, expires_at,
                    is_revoked, access_count, created_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, datetime('now'))
                `).run(autoId, cleanToken, decoded.r, decoded.s, decoded.h || 'hotel-ocean-pearl', decoded.m || '', expiresAt);
              } catch (e) {}

              tokenRecord = db.prepare(`SELECT jt.*, datetime('now') as server_now FROM job_tokens jt WHERE jt.token = ?`).get(cleanToken);
            }
          } catch (e) {}
        }
      }
    }

    // Fallback 2: Check if cleanToken matches request_id or recent token
    if (!tokenRecord) {
      const fallbackRecord = db.prepare(`
        SELECT jt.*, datetime('now') as server_now
        FROM job_tokens jt
        WHERE jt.request_id = ? OR jt.token LIKE ?
        ORDER BY jt.created_at DESC LIMIT 1
      `).get(cleanToken, `%${cleanToken}%`) as any;
      if (fallbackRecord) {
        tokenRecord = fallbackRecord;
      }
    }

    if (!tokenRecord) {
      return { valid: false, errorStatus: 404, errorCode: 'TOKEN_NOT_FOUND', errorMessage: 'Job link not found or invalid. Please check your latest SMS link.' };
    }

    // Revocation check: If marked revoked, verify whether the staff member is still assigned
    if (tokenRecord.is_revoked === 1) {
      const stillAssigned = db.prepare(`
        SELECT id FROM staff_assignments
        WHERE request_id = ? AND staff_id = ? AND status NOT IN ('Cancelled', 'Declined')
        LIMIT 1
      `).get(tokenRecord.request_id, tokenRecord.staff_id) as any;

      const gsrStillAssigned = db.prepare(`
        SELECT id FROM guest_service_requests
        WHERE id = ? AND status NOT IN ('Cancelled', 'Declined')
        LIMIT 1
      `).get(tokenRecord.request_id) as any;

      if (!stillAssigned && !gsrStillAssigned) {
        return {
          valid: false,
          errorStatus: 403,
          errorCode: 'TOKEN_REVOKED',
          errorMessage: tokenRecord.revoked_reason || 'This job link has been reassigned to another technician.'
        };
      }
      // If still assigned to technician, allow seamless access
    }

    // Expiration check (UTC safe comparison)
    const expTime = new Date((tokenRecord.expires_at || '').replace(' ', 'T') + 'Z').getTime();
    if (!isNaN(expTime) && expTime < Date.now()) {
      return {
        valid: false,
        errorStatus: 410,
        errorCode: 'TOKEN_EXPIRED',
        errorMessage: 'This job link has expired. Tap below to request a new link.'
      };
    }

    // Load maintenance request details
    let job = db.prepare(`
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
      LEFT JOIN staff_assignments sa ON sa.request_id = mr.id AND sa.staff_id = ?
      WHERE mr.id = ?
    `).get(tokenRecord.staff_id, tokenRecord.request_id) as any;

    // Load guest service request details if not maintenance
    if (!job) {
      const gsr = db.prepare(`
        SELECT gsr.*,
               gsr.service_type as priority,
               gsr.service_type as job_type,
               gsr.special_instructions as description,
               r.room_number, r.name as room_name,
               b.name as building_name, f.name as floor_name,
               h.name as hotel_name, h.logo_url as hotel_logo, h.phone as hotel_phone,
               sa.id as assignment_id, sa.status as assignment_status, sa.assigned_at,
               (SELECT u.full_name FROM users u WHERE u.id = sa.assigned_by_user_id) as assigned_by_name,
               (SELECT GROUP_CONCAT(gsri.item_name, ', ')
                FROM guest_service_request_items gsri WHERE gsri.request_id = gsr.id) as items_summary
        FROM guest_service_requests gsr
        JOIN rooms r ON gsr.room_id = r.id
        JOIN hotels h ON gsr.hotel_id = h.id
        LEFT JOIN buildings b ON r.building_id = b.id
        LEFT JOIN floors f ON r.floor_id = f.id
        LEFT JOIN staff_assignments sa ON sa.request_id = gsr.id AND sa.staff_id = ?
        WHERE gsr.id = ?
      `).get(tokenRecord.staff_id, tokenRecord.request_id) as any;

      if (gsr) {
        job = gsr;
      }
    }

    if (!job) {
      return { valid: false, errorStatus: 404, errorCode: 'JOB_NOT_FOUND', errorMessage: 'Associated job request was not found or was deleted.' };
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
