import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { JobTokenService } from '../services/job-token.service';
import { NotificationService } from '../services/notification/notification.service';
import { sseService } from '../services/sse';
import { recordAuditLog } from '../middleware/audit';

const router = Router();

// GET /api/jobs/:token - Fetch job details via secure public job token (loginless)
router.get('/:token', (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const clientIp = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const validation = JobTokenService.validateJobToken(token, clientIp, userAgent);
    if (!validation.valid) {
      return res.status(validation.errorStatus || 400).json({
        error: validation.errorMessage,
        code: validation.errorCode,
        canRequestNewLink: validation.errorCode === 'TOKEN_EXPIRED'
      });
    }

    const { job, staff, tokenRecord } = validation;

    res.json({
      success: true,
      job: {
        id: job.id,
        requestCode: job.request_code,
        roomNumber: job.room_number,
        roomName: job.room_name,
        roomId: job.room_id,
        roomToken: job.room_qr_token || job.qr_token,
        trackingToken: job.tracking_token,
        buildingName: job.building_name,
        floorName: job.floor_name,
        priority: job.priority,
        status: job.status,
        description: job.description,
        itemsSummary: job.items_summary,
        photosJson: job.photos_json,
        createdAt: job.created_at,
        assignedAt: job.assigned_at,
        assignedByName: job.assigned_by_name || 'Front Office',
        hotelName: job.hotel_name,
        hotelLogo: job.hotel_logo,
        hotelPhone: job.hotel_phone,
        completionNotes: job.completion_notes,
        partsUsed: job.parts_used,
        repairCost: job.repair_cost,
        guestSignatureUrl: job.guest_signature_url
      },
      staff: {
        id: staff.id,
        fullName: staff.full_name,
        jobTitle: staff.job_title,
        department: staff.department,
        avatarUrl: staff.avatar_url,
        employeeId: staff.employee_id
      },
      token: {
        expiresAt: tokenRecord.expires_at,
        accessCount: tokenRecord.access_count
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch job' });
  }
});

// POST /api/jobs/:token/accept - Staff accepts job
router.post('/:token/accept', (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const validation = JobTokenService.validateJobToken(token);
    if (!validation.valid) {
      return res.status(validation.errorStatus || 400).json({ error: validation.errorMessage, code: validation.errorCode });
    }

    const { job, staff, tokenRecord } = validation;

    db.transaction(() => {
      // 1. Update Request
      db.prepare(`
        UPDATE maintenance_requests
        SET status = 'Accepted', updated_at = datetime('now')
        WHERE id = ?
      `).run(job.id);

      // 2. Update Assignment
      db.prepare(`
        UPDATE staff_assignments
        SET status = 'Accepted'
        WHERE request_id = ? AND staff_id = ? AND status = 'Assigned'
      `).run(job.id, staff.id);

      // 3. Status History
      db.prepare(`
        INSERT INTO request_status_history (id, request_id, status, notes, created_at)
        VALUES (?, ?, 'Accepted', ?, datetime('now'))
      `).run(uuidv4(), job.id, `Job accepted by ${staff.full_name} via Mobile Job Portal`);
    })();

    // Audit Log
    recordAuditLog({
      hotelId: job.hotel_id,
      userName: staff.full_name,
      action: 'JOB_ACCEPTED',
      entity: 'maintenance_requests',
      entityId: job.id,
      details: { staffId: staff.id, roomNumber: job.room_number }
    });

    // Real-Time Front Office & Guest broadcast
    sseService.broadcast('JOB_STATUS_CHANGED', {
      requestId: job.id,
      requestCode: job.request_code,
      roomNumber: job.room_number,
      staffName: staff.full_name,
      status: 'Accepted',
      message: `${staff.full_name} accepted Room ${job.room_number} job.`
    });
    sseService.broadcastToTrackingToken(job.tracking_token, 'STATUS_UPDATED', {
      status: 'Accepted',
      staffName: staff.full_name
    });

    res.json({ success: true, status: 'Accepted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs/:token/decline - Staff declines job
router.post('/:token/decline', (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { reason } = req.body;
    const validation = JobTokenService.validateJobToken(token);
    if (!validation.valid) {
      return res.status(validation.errorStatus || 400).json({ error: validation.errorMessage, code: validation.errorCode });
    }

    const { job, staff } = validation;

    db.transaction(() => {
      db.prepare(`
        UPDATE maintenance_requests
        SET status = 'Submitted', updated_at = datetime('now')
        WHERE id = ?
      `).run(job.id);

      db.prepare(`
        UPDATE staff_assignments
        SET status = 'Declined', notes = ?
        WHERE request_id = ? AND staff_id = ?
      `).run(reason || 'Declined by technician via mobile portal', job.id, staff.id);

      db.prepare(`
        UPDATE staff_profiles
        SET status = 'available', updated_at = datetime('now')
        WHERE id = ?
      `).run(staff.id);

      db.prepare(`
        INSERT INTO request_status_history (id, request_id, status, notes, created_at)
        VALUES (?, ?, 'Declined', ?, datetime('now'))
      `).run(uuidv4(), job.id, `Job declined by ${staff.full_name}: ${reason || 'Not available'}`);

      // Revoke this token
      JobTokenService.revokeTokensForRequest(job.id, 'Job declined by technician');
    })();

    sseService.broadcast('JOB_DECLINED', {
      requestId: job.id,
      requestCode: job.request_code,
      roomNumber: job.room_number,
      staffName: staff.full_name,
      reason: reason || 'Not available',
      message: `⚠️ ${staff.full_name} declined Room ${job.room_number} job.`
    });

    res.json({ success: true, status: 'Declined' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs/:token/on-the-way - Staff is on the way
router.post('/:token/on-the-way', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const validation = JobTokenService.validateJobToken(token);
    if (!validation.valid) {
      return res.status(validation.errorStatus || 400).json({ error: validation.errorMessage, code: validation.errorCode });
    }

    const { job, staff } = validation;

    db.transaction(() => {
      db.prepare(`
        UPDATE maintenance_requests
        SET status = 'Technician On The Way', updated_at = datetime('now')
        WHERE id = ?
      `).run(job.id);

      db.prepare(`
        UPDATE staff_assignments
        SET status = 'In Progress'
        WHERE request_id = ? AND staff_id = ?
      `).run(job.id, staff.id);

      db.prepare(`
        INSERT INTO request_status_history (id, request_id, status, notes, created_at)
        VALUES (?, ?, 'Technician On The Way', ?, datetime('now'))
      `).run(uuidv4(), job.id, `${staff.full_name} is on the way to Room ${job.room_number}`);
    })();

    recordAuditLog({
      hotelId: job.hotel_id,
      userName: staff.full_name,
      action: 'JOB_ON_THE_WAY',
      entity: 'maintenance_requests',
      entityId: job.id,
      details: { staffId: staff.id, roomNumber: job.room_number }
    });

    // Notify guest if consented
    await NotificationService.sendGuestUpdate({
      requestId: job.id,
      status: 'Technician On The Way',
      technicianName: staff.full_name
    });

    sseService.broadcast('JOB_STATUS_CHANGED', {
      requestId: job.id,
      requestCode: job.request_code,
      roomNumber: job.room_number,
      staffName: staff.full_name,
      status: 'Technician On The Way',
      message: `${staff.full_name} is on the way to Room ${job.room_number}.`
    });

    sseService.broadcastToTrackingToken(job.tracking_token, 'STATUS_UPDATED', {
      status: 'Technician On The Way',
      staffName: staff.full_name
    });

    res.json({ success: true, status: 'Technician On The Way' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs/:token/arrived - Staff arrived at room
router.post('/:token/arrived', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const validation = JobTokenService.validateJobToken(token);
    if (!validation.valid) {
      return res.status(validation.errorStatus || 400).json({ error: validation.errorMessage, code: validation.errorCode });
    }

    const { job, staff } = validation;

    db.transaction(() => {
      db.prepare(`
        UPDATE maintenance_requests
        SET status = 'Arrived', arrived_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(job.id);

      db.prepare(`
        INSERT INTO request_status_history (id, request_id, status, notes, created_at)
        VALUES (?, ?, 'Arrived', ?, datetime('now'))
      `).run(uuidv4(), job.id, `${staff.full_name} arrived at Room ${job.room_number}`);
    })();

    recordAuditLog({
      hotelId: job.hotel_id,
      userName: staff.full_name,
      action: 'JOB_ARRIVED',
      entity: 'maintenance_requests',
      entityId: job.id,
      details: { staffId: staff.id, roomNumber: job.room_number }
    });

    await NotificationService.sendGuestUpdate({
      requestId: job.id,
      status: 'Technician Arrived',
      technicianName: staff.full_name
    });

    sseService.broadcast('JOB_STATUS_CHANGED', {
      requestId: job.id,
      requestCode: job.request_code,
      roomNumber: job.room_number,
      staffName: staff.full_name,
      status: 'Arrived',
      message: `${staff.full_name} arrived at Room ${job.room_number}.`
    });

    sseService.broadcastToTrackingToken(job.tracking_token, 'STATUS_UPDATED', {
      status: 'Arrived',
      staffName: staff.full_name
    });

    res.json({ success: true, status: 'Arrived' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs/:token/start - Staff started work
router.post('/:token/start', (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const validation = JobTokenService.validateJobToken(token);
    if (!validation.valid) {
      return res.status(validation.errorStatus || 400).json({ error: validation.errorMessage, code: validation.errorCode });
    }

    const { job, staff } = validation;

    db.transaction(() => {
      db.prepare(`
        UPDATE maintenance_requests
        SET status = 'In Progress', started_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(job.id);

      db.prepare(`
        INSERT INTO request_status_history (id, request_id, status, notes, created_at)
        VALUES (?, ?, 'In Progress', ?, datetime('now'))
      `).run(uuidv4(), job.id, `Work started by ${staff.full_name}`);
    })();

    sseService.broadcast('JOB_STATUS_CHANGED', {
      requestId: job.id,
      requestCode: job.request_code,
      roomNumber: job.room_number,
      staffName: staff.full_name,
      status: 'In Progress',
      message: `${staff.full_name} started work in Room ${job.room_number}.`
    });

    sseService.broadcastToTrackingToken(job.tracking_token, 'STATUS_UPDATED', {
      status: 'In Progress',
      staffName: staff.full_name
    });

    res.json({ success: true, status: 'In Progress' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs/:token/complete - Staff completes job with notes, photos, parts, cost, signature
router.post('/:token/complete', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const {
      completion_notes,
      before_photos,
      after_photos,
      parts_used,
      repair_cost,
      guest_signature_url
    } = req.body;

    const validation = JobTokenService.validateJobToken(token);
    if (!validation.valid) {
      return res.status(validation.errorStatus || 400).json({ error: validation.errorMessage, code: validation.errorCode });
    }

    const { job, staff } = validation;
    const nowIso = new Date().toISOString();

    db.transaction(() => {
      // 1. Update Request to Completed
      db.prepare(`
        UPDATE maintenance_requests
        SET status = 'Completed',
            resolved_at = datetime('now'),
            updated_at = datetime('now'),
            completion_notes = ?,
            before_photos_json = ?,
            after_photos_json = ?,
            parts_used = ?,
            repair_cost = ?,
            guest_signature_url = ?,
            completed_by_staff_id = ?
        WHERE id = ?
      `).run(
        completion_notes || null,
        before_photos ? JSON.stringify(before_photos) : '[]',
        after_photos ? JSON.stringify(after_photos) : '[]',
        parts_used || null,
        repair_cost ? parseFloat(repair_cost) : 0,
        guest_signature_url || null,
        staff.id,
        job.id
      );

      // 2. Complete Assignment
      db.prepare(`
        UPDATE staff_assignments
        SET status = 'Completed', completed_at = datetime('now'), notes = ?
        WHERE request_id = ? AND staff_id = ?
      `).run(completion_notes || 'Completed via mobile web portal', job.id, staff.id);

      // 3. Mark staff back to available
      db.prepare(`
        UPDATE staff_profiles
        SET status = 'available', updated_at = datetime('now')
        WHERE id = ?
      `).run(staff.id);

      // 4. Status history
      db.prepare(`
        INSERT INTO request_status_history (id, request_id, status, notes, created_at)
        VALUES (?, ?, 'Completed', ?, datetime('now'))
      `).run(
        uuidv4(),
        job.id,
        `Completed by ${staff.full_name}. ${completion_notes ? 'Notes: ' + completion_notes : ''}`
      );

      // 5. In-app notification for Front Office
      db.prepare(`
        INSERT INTO notifications (id, hotel_id, target_role, title, message, type, link, created_at)
        VALUES (?, ?, 'Front Office Staff', ?, ?, 'success', '/admin/maintenance', datetime('now'))
      `).run(
        uuidv4(),
        job.hotel_id,
        `Room ${job.room_number} Maintenance Completed`,
        `${staff.full_name} completed job ${job.request_code} for Room ${job.room_number}.`
      );
    })();

    recordAuditLog({
      hotelId: job.hotel_id,
      userName: staff.full_name,
      action: 'JOB_COMPLETED',
      entity: 'maintenance_requests',
      entityId: job.id,
      details: {
        staffId: staff.id,
        roomNumber: job.room_number,
        repairCost: repair_cost,
        partsUsed: parts_used
      }
    });

    // Notify guest if consented
    await NotificationService.sendGuestUpdate({
      requestId: job.id,
      status: 'Completed',
      technicianName: staff.full_name
    });

    // Broadcast SSE
    sseService.broadcast('JOB_COMPLETED', {
      requestId: job.id,
      requestCode: job.request_code,
      roomNumber: job.room_number,
      staffName: staff.full_name,
      status: 'Completed',
      message: `Room ${job.room_number} maintenance completed by ${staff.full_name}.`
    });

    sseService.broadcastToTrackingToken(job.tracking_token, 'STATUS_UPDATED', {
      status: 'Completed',
      staffName: staff.full_name
    });

    res.json({
      success: true,
      status: 'Completed',
      jobId: job.request_code,
      completedAt: nowIso,
      staffName: staff.full_name
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs/:token/request-link - Staff requests a fresh link if token expired
router.post('/:token/request-link', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const tokenRecord = db.prepare(`SELECT * FROM job_tokens WHERE token = ?`).get(token) as any;
    if (!tokenRecord) {
      return res.status(404).json({ error: 'Job token not found.' });
    }

    // Invalidate old token
    JobTokenService.revokeTokensForRequest(tokenRecord.request_id, 'Regenerated on staff request');

    // Create fresh token
    const newToken = JobTokenService.createJobToken({
      requestId: tokenRecord.request_id,
      staffId: tokenRecord.staff_id,
      hotelId: tokenRecord.hotel_id,
      roomId: tokenRecord.room_id
    });

    // Re-dispatch notification to staff
    await NotificationService.sendJobAssigned({
      requestId: tokenRecord.request_id,
      staffId: tokenRecord.staff_id,
      jobToken: newToken.token,
      jobUrl: newToken.jobUrl
    });

    res.json({
      success: true,
      message: 'New job link dispatched to your mobile phone via SMS/WhatsApp.',
      newJobUrl: newToken.jobUrl
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
