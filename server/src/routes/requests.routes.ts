import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { sseService } from '../services/sse';
import { recordAuditLog } from '../middleware/audit';
import { CONFIG } from '../config';
import { JobTokenService } from '../services/job-token.service';
import { NotificationService } from '../services/notification/notification.service';

const router = Router();

// GET /api/requests - Front Office request management table with filters and search
router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { room_number, building_id, floor_id, priority, status, staff_id, date, search } = req.query;

    let query = `
      SELECT mr.*,
             r.room_number, r.name as room_name,
             b.name as building_name,
             f.name as floor_name,
             sp.id as staff_profile_id,
             u.full_name as assigned_staff_name,
             sp.job_title as assigned_staff_title,
             sp.avatar_url as assigned_staff_avatar,
             sa.status as staff_assignment_status,
             (SELECT token FROM job_tokens WHERE request_id = mr.id AND is_revoked = 0 ORDER BY created_at DESC LIMIT 1) as latest_job_token,
             (SELECT status FROM notification_logs WHERE job_id = mr.id ORDER BY created_at DESC LIMIT 1) as latest_notif_status,
             (SELECT channel FROM notification_logs WHERE job_id = mr.id ORDER BY created_at DESC LIMIT 1) as latest_notif_channel,
             (SELECT GROUP_CONCAT(mri.item_name || ' (' || mri.problem_type || ')', ', ')
              FROM maintenance_request_items mri WHERE mri.request_id = mr.id) as reported_items_summary
      FROM maintenance_requests mr
      JOIN rooms r ON mr.room_id = r.id
      LEFT JOIN buildings b ON r.building_id = b.id
      LEFT JOIN floors f ON r.floor_id = f.id
      LEFT JOIN staff_assignments sa ON sa.request_id = mr.id AND sa.status != 'Cancelled'
      LEFT JOIN staff_profiles sp ON sa.staff_id = sp.id
      LEFT JOIN users u ON sp.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (room_number) {
      query += ` AND r.room_number = ?`;
      params.push(room_number);
    }
    if (building_id) {
      query += ` AND r.building_id = ?`;
      params.push(building_id);
    }
    if (floor_id) {
      query += ` AND r.floor_id = ?`;
      params.push(floor_id);
    }
    if (priority) {
      query += ` AND mr.priority = ?`;
      params.push(priority);
    }
    if (status) {
      query += ` AND mr.status = ?`;
      params.push(status);
    }
    if (staff_id) {
      query += ` AND sa.staff_id = ?`;
      params.push(staff_id);
    }
    if (date) {
      query += ` AND date(mr.created_at) = date(?)`;
      params.push(date);
    }
    if (search) {
      query += ` AND (
        mr.request_code LIKE ? OR
        r.room_number LIKE ? OR
        mr.guest_name LIKE ? OR
        mr.description LIKE ? OR
        u.full_name LIKE ?
      )`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY
      CASE mr.priority
        WHEN 'Emergency' THEN 1
        WHEN 'High' THEN 2
        WHEN 'Normal' THEN 3
        ELSE 4
      END ASC,
      mr.created_at DESC`;

    const requests = db.prepare(query).all(...params);
    res.json({ requests });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/requests/:id - Detailed request view
router.get('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    let request = db.prepare(`
      SELECT mr.*,
             r.room_number, r.name as room_name,
             rt.name as room_type_name,
             b.name as building_name,
             f.name as floor_name
      FROM maintenance_requests mr
      JOIN rooms r ON mr.room_id = r.id
      LEFT JOIN room_types rt ON r.room_type_id = rt.id
      LEFT JOIN buildings b ON r.building_id = b.id
      LEFT JOIN floors f ON r.floor_id = f.id
      WHERE mr.id = ?
    `).get(id) as any;

    if (!request) {
      request = db.prepare(`
        SELECT gsr.*,
               gsr.service_type as category,
               gsr.notes as description,
               r.room_number, r.name as room_name,
               rt.name as room_type_name,
               b.name as building_name,
               f.name as floor_name
        FROM guest_service_requests gsr
        JOIN rooms r ON gsr.room_id = r.id
        LEFT JOIN room_types rt ON r.room_type_id = rt.id
        LEFT JOIN buildings b ON r.building_id = b.id
        LEFT JOIN floors f ON r.floor_id = f.id
        WHERE gsr.id = ?
      `).get(id) as any;
    }

    if (!request) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    const items = db.prepare(`
      SELECT mri.*, ria.serial_number, ria.condition_status
      FROM maintenance_request_items mri
      LEFT JOIN room_item_assignments ria ON mri.room_item_assignment_id = ria.id
      WHERE mri.request_id = ?
    `).all(id);

    const timeline = db.prepare(`
      SELECT rsh.*, u.full_name as changed_by_name
      FROM request_status_history rsh
      LEFT JOIN users u ON rsh.changed_by_user_id = u.id
      WHERE rsh.request_id = ?
      ORDER BY rsh.created_at ASC
    `).all(id);

    const currentAssignment = db.prepare(`
      SELECT sa.*, sp.job_title, sp.department, sp.phone as staff_phone, sp.avatar_url,
             u.full_name as staff_name, u.email as staff_email
      FROM staff_assignments sa
      JOIN staff_profiles sp ON sa.staff_id = sp.id
      JOIN users u ON sp.user_id = u.id
      WHERE sa.request_id = ?
      ORDER BY sa.assigned_at DESC LIMIT 1
    `).get(id);

    const activeJobToken = db.prepare(`
      SELECT token, expires_at, created_at, access_count, last_accessed_at
      FROM job_tokens
      WHERE request_id = ? AND is_revoked = 0 AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(id);

    const notificationLogs = db.prepare(`
      SELECT * FROM notification_logs WHERE job_id = ? ORDER BY created_at DESC LIMIT 10
    `).all(id);

    res.json({ request, items, timeline, currentAssignment, activeJobToken, notificationLogs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST/PUT /api/requests/:id/assign - Assign staff member to request
router.all(['/:id/assign'], authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const staffId = req.body.staffId || req.body.staff_id;
    const notes = req.body.notes || '';

    if (!staffId) {
      return res.status(400).json({ error: 'Staff member selection is required.' });
    }

    let request = db.prepare(`SELECT mr.*, r.room_number FROM maintenance_requests mr JOIN rooms r ON mr.room_id = r.id WHERE mr.id = ?`).get(id) as any;
    let isService = false;
    if (!request) {
      request = db.prepare(`SELECT gsr.*, r.room_number FROM guest_service_requests gsr JOIN rooms r ON gsr.room_id = r.id WHERE gsr.id = ?`).get(id) as any;
      if (request) isService = true;
    }
    if (!request) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    const staff = db.prepare(`
      SELECT sp.*, u.id as user_id, u.full_name
      FROM staff_profiles sp JOIN users u ON sp.user_id = u.id WHERE sp.id = ?
    `).get(staffId) as any;

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }

    if (isService) {
      db.prepare(`UPDATE guest_service_requests SET status = 'Assigned', updated_at = datetime('now') WHERE id = ?`).run(id);

      const jobToken = JobTokenService.createJobToken({
        requestId: id,
        staffId: staffId,
        hotelId: request.hotel_id,
        roomId: request.room_id
      });

      const notifResult = await NotificationService.sendJobAssigned({
        requestId: id,
        staffId: staffId,
        jobToken: jobToken.token,
        jobUrl: jobToken.jobUrl,
        assignedByUserId: req.user?.id
      });

      sseService.broadcastToUser(staff.user_id, 'TASK_ASSIGNED', {
        requestId: id,
        requestCode: request.request_code,
        roomNumber: request.room_number,
        priority: request.priority || 'Normal',
        jobUrl: jobToken.jobUrl
      });

      return res.json({
        success: true,
        message: `Task successfully assigned to ${staff.full_name}.`,
        jobToken: jobToken.token,
        jobUrl: jobToken.jobUrl,
        notification: notifResult
      });
    }

    // 1. Revoke any prior job tokens for this request (reassignment security)
    JobTokenService.revokeTokensForRequest(id, 'Job reassigned to another technician');

    db.transaction(() => {
      // 1. Mark prior assignments as reassigned if existing
      db.prepare(`UPDATE staff_assignments SET status = 'Reassigned' WHERE request_id = ? AND status = 'Assigned'`).run(id);

      // 2. Insert new Assignment
      db.prepare(`
        INSERT INTO staff_assignments (id, request_id, staff_id, assigned_by_user_id, status, assigned_at, notes)
        VALUES (?, ?, ?, ?, 'Assigned', datetime('now'), ?)
      `).run(uuidv4(), id, staffId, req.user?.id || null, notes || '');

      // 3. Update Request Status to 'Assigned'
      db.prepare(`
        UPDATE maintenance_requests
        SET status = 'Assigned', updated_at = datetime('now')
        WHERE id = ?
      `).run(id);

      // 4. Update Staff Profile status to 'busy'
      db.prepare(`UPDATE staff_profiles SET status = 'busy' WHERE id = ?`).run(staffId);

      // 5. Add to Timeline
      db.prepare(`
        INSERT INTO request_status_history (id, request_id, status, changed_by_user_id, notes, created_at)
        VALUES (?, ?, 'Assigned', ?, ?, datetime('now'))
      `).run(uuidv4(), id, req.user?.id || null, `Assigned to ${staff.full_name} (${staff.job_title}). ${notes ? 'Note: ' + notes : ''}`);

      // 6. In-App Notification
      db.prepare(`
        INSERT INTO notifications (id, hotel_id, user_id, target_role, title, message, type, link, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'warning', '/staff/tasks', datetime('now'))
      `).run(
        uuidv4(), request.hotel_id, staff.user_id, staff.department,
        `New Task: Room ${request.room_number}`,
        `${request.priority} Priority: ${request.description ? request.description.substring(0, 50) : 'Maintenance task'}...`
      );
    })();

    // 2. Generate cryptographically secure random job token
    const jobToken = JobTokenService.createJobToken({
      requestId: id,
      staffId: staffId,
      hotelId: request.hotel_id,
      roomId: request.room_id
    });

    // 3. Dispatch SMS / WhatsApp notification to technician's phone
    const notifResult = await NotificationService.sendJobAssigned({
      requestId: id,
      staffId: staffId,
      jobToken: jobToken.token,
      jobUrl: jobToken.jobUrl,
      assignedByUserId: req.user?.id
    });

    // 4. Live real-time push to staff member and guest
    sseService.broadcastToUser(staff.user_id, 'TASK_ASSIGNED', {
      requestId: id,
      requestCode: request.request_code,
      roomNumber: request.room_number,
      priority: request.priority,
      jobUrl: jobToken.jobUrl
    });

    sseService.broadcastToTrackingToken(request.tracking_token, 'STATUS_UPDATED', {
      status: 'Assigned',
      technicianName: staff.full_name,
      jobTitle: staff.job_title,
      avatarUrl: staff.avatar_url
    });

    recordAuditLog({
      hotelId: request.hotel_id,
      userId: req.user?.id,
      userName: req.user?.full_name,
      action: 'REQUEST_ASSIGNED',
      entity: 'maintenance_request',
      entityId: id,
      details: {
        staffName: staff.full_name,
        room: request.room_number,
        jobToken: jobToken.token,
        whatsappStatus: notifResult.whatsappResult?.status,
        smsStatus: notifResult.smsResult?.status,
        fallbackUsed: notifResult.fallbackUsed
      }
    });

    res.json({
      success: true,
      message: `Task successfully assigned to ${staff.full_name}.`,
      jobToken: jobToken.token,
      jobUrl: jobToken.jobUrl,
      notification: notifResult
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/requests/:id/resend-notification - Resend WhatsApp or SMS job link
router.post('/:id/resend-notification', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const request = db.prepare(`SELECT mr.*, r.room_number FROM maintenance_requests mr JOIN rooms r ON mr.room_id = r.id WHERE mr.id = ?`).get(id) as any;
    if (!request) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    // Find current active assignment
    const assignment = db.prepare(`
      SELECT sa.*, sp.id as staff_profile_id
      FROM staff_assignments sa
      JOIN staff_profiles sp ON sa.staff_id = sp.id
      WHERE sa.request_id = ? AND sa.status IN ('Assigned', 'Accepted', 'In Progress')
      ORDER BY sa.assigned_at DESC LIMIT 1
    `).get(id) as any;

    if (!assignment) {
      return res.status(400).json({ error: 'No active technician assignment found for this request.' });
    }

    // Find or create active job token
    let tokenRecord = db.prepare(`
      SELECT * FROM job_tokens
      WHERE request_id = ? AND staff_id = ? AND is_revoked = 0 AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(id, assignment.staff_profile_id) as any;

    let token = tokenRecord?.token;
    let jobUrl = token ? `${CONFIG.BASE_URL}/job/${token}` : '';

    if (!tokenRecord) {
      const newToken = JobTokenService.createJobToken({
        requestId: id,
        staffId: assignment.staff_profile_id,
        hotelId: request.hotel_id,
        roomId: request.room_id
      });
      token = newToken.token;
      jobUrl = newToken.jobUrl;
    }

    const notifResult = await NotificationService.sendJobAssigned({
      requestId: id,
      staffId: assignment.staff_profile_id,
      jobToken: token,
      jobUrl,
      assignedByUserId: req.user?.id
    });

    res.json({
      success: true,
      message: 'Notification resent to assigned technician.',
      jobUrl,
      notification: notifResult
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/requests/:id/notifications - Get delivery history for a request
router.get('/:id/notifications', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const logs = db.prepare(`
      SELECT nl.*, sp.job_title, u.full_name as staff_name
      FROM notification_logs nl
      LEFT JOIN staff_profiles sp ON nl.staff_id = sp.id
      LEFT JOIN users u ON sp.user_id = u.id
      WHERE nl.job_id = ?
      ORDER BY nl.created_at DESC
    `).all(id);

    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST/PUT /api/requests/:id/status - Update technician/desk workflow status
router.all(['/:id/status'], authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes, photos, parts_used, cost } = req.body;

    const validStatuses = [
      'Submitted', 'Received', 'Under Review', 'Assigned', 'Accepted',
      'On The Way', 'Arrived', 'In Progress', 'Completed', 'Cancelled'
    ];
    const matchStatus = validStatuses.find(s => s.toLowerCase() === (status || '').toLowerCase().trim());
    if (!matchStatus) {
      return res.status(400).json({ error: `Invalid status. Valid: ${validStatuses.join(', ')}` });
    }

    let request = db.prepare(`
      SELECT mr.*, r.id as room_id, r.room_number
      FROM maintenance_requests mr
      JOIN rooms r ON mr.room_id = r.id
      WHERE mr.id = ?
    `).get(id) as any;

    if (!request) {
      const srvReq = db.prepare(`
        SELECT gsr.*, r.id as room_id, r.room_number
        FROM guest_service_requests gsr
        JOIN rooms r ON gsr.room_id = r.id
        WHERE gsr.id = ?
      `).get(id) as any;

      if (srvReq) {
        db.prepare(`
          UPDATE guest_service_requests
          SET status = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(matchStatus, id);

        sseService.broadcast('REQUEST_STATUS_CHANGED', {
          requestId: id,
          requestCode: srvReq.request_code,
          status: matchStatus,
          roomNumber: srvReq.room_number,
          updatedBy: req.user?.full_name
        });

        return res.json({ success: true, status: matchStatus, message: `Status updated to ${matchStatus}.` });
      }

      return res.status(404).json({ error: 'Request not found.' });
    }

    db.transaction(() => {
      // 1. Update Request table
      let resolvedAtSql = matchStatus === 'Completed' ? "datetime('now')" : "resolved_at";
      db.prepare(`
        UPDATE maintenance_requests
        SET status = ?, updated_at = datetime('now'), resolved_at = ${resolvedAtSql}
        WHERE id = ?
      `).run(matchStatus, id);

      // 2. Append to Status History
      db.prepare(`
        INSERT INTO request_status_history (
          id, request_id, status, changed_by_user_id, notes, photos_json, parts_used, cost, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        uuidv4(), id, matchStatus, req.user?.id || null, notes || '',
        photos ? JSON.stringify(photos) : '[]',
        parts_used || '', cost ? Number(cost) : 0
      );

      // 3. If Completed:
      if (status === 'Completed') {
        // Reset room status back to Available or Cleaning if it was under maintenance
        const openReqs = db.prepare(`
          SELECT COUNT(*) as cnt FROM maintenance_requests
          WHERE room_id = ? AND id != ? AND status NOT IN ('Completed', 'Cancelled')
        `).get(request.room_id, id) as any;

        if (openReqs.cnt === 0) {
          db.prepare(`UPDATE rooms SET room_status = 'Available' WHERE id = ?`).run(request.room_id);
        }

        // Reset repaired item assignments to 'Working'
        const reqItems = db.prepare(`SELECT room_item_assignment_id FROM maintenance_request_items WHERE request_id = ?`).all(id) as any[];
        for (const item of reqItems) {
          if (item.room_item_assignment_id) {
            db.prepare(`
              UPDATE room_item_assignments
              SET condition_status = 'Working', last_maintenance_date = date('now'), updated_at = datetime('now')
              WHERE id = ?
            `).run(item.room_item_assignment_id);
          }
        }

        // Update staff assignment record to Completed
        db.prepare(`
          UPDATE staff_assignments
          SET status = 'Completed', completed_at = datetime('now')
          WHERE request_id = ? AND status != 'Cancelled'
        `).run(id);

        // Notify Front Office
        db.prepare(`
          INSERT INTO notifications (id, hotel_id, target_role, title, message, type, link, created_at)
          VALUES (?, ?, 'Front Office Staff', ?, ?, 'success', '/admin/maintenance', datetime('now'))
        `).run(
          uuidv4(), request.hotel_id,
          `Maintenance Completed: Room ${request.room_number}`,
          `Room ${request.room_number} ${request.request_code} marked as completed by ${req.user?.full_name}.`
        );
      }
    })();

    // Broadcast SSE to Front Office and Guest Tracking
    sseService.broadcast('REQUEST_STATUS_CHANGED', {
      requestId: id,
      requestCode: request.request_code,
      status: matchStatus,
      roomNumber: request.room_number,
      updatedBy: req.user?.full_name
    });

    sseService.broadcastToTrackingToken(request.tracking_token, 'STATUS_UPDATED', {
      status: matchStatus,
      notes,
      updatedAt: new Date().toISOString()
    });

    recordAuditLog({
      hotelId: request.hotel_id,
      userId: req.user?.id,
      userName: req.user?.full_name,
      action: 'STATUS_TRANSITION',
      entity: 'maintenance_request',
      entityId: id,
      details: { status: matchStatus, cost, parts_used }
    });

    res.json({ success: true, status: matchStatus, message: `Status updated to ${matchStatus}.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/requests/services/list & /api/requests/services - Front office guest services listing
router.get(['/services/list', '/services'], authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const services = db.prepare(`
      SELECT gsr.*, r.room_number, r.name as room_name, b.name as building_name
      FROM guest_service_requests gsr
      JOIN rooms r ON gsr.room_id = r.id
      LEFT JOIN buildings b ON r.building_id = b.id
      ORDER BY gsr.created_at DESC
    `).all();
    res.json({ services, requests: services });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/requests/services/:id/status - Update guest service status
router.put('/services/:id/status', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    db.prepare(`
      UPDATE guest_service_requests
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, id);

    res.json({ success: true, message: `Service request status updated to ${status}.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/requests - Front Office / Admin creates maintenance request
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { room_id, room_number, category, priority, description, guest_name } = req.body;
    const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;

    let room: any = null;
    if (room_id) {
      room = db.prepare(`SELECT id, room_number FROM rooms WHERE id = ?`).get(room_id);
    }
    if (!room && room_number) {
      room = db.prepare(`SELECT id, room_number FROM rooms WHERE TRIM(LOWER(room_number)) = TRIM(LOWER(?))`).get(room_number);
    }
    if (!room) {
      return res.status(400).json({ error: 'Valid room is required.' });
    }

    const requestId = uuidv4();
    const trackingToken = uuidv4().replace(/-/g, '').substring(0, 16);

    const lastReq = db.prepare(`SELECT request_code FROM maintenance_requests ORDER BY created_at DESC LIMIT 1`).get() as any;
    let nextNum = 1001;
    if (lastReq && lastReq.request_code.startsWith('RM-')) {
      const parsed = parseInt(lastReq.request_code.replace('RM-', ''), 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }
    const requestCode = `RM-${nextNum}`;

    db.prepare(`
      INSERT INTO maintenance_requests (
        id, request_code, hotel_id, room_id, tracking_token, priority,
        status, description, guest_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'Submitted', ?, ?, datetime('now'), datetime('now'))
    `).run(
      requestId, requestCode, hotel.id, room.id, trackingToken,
      priority || 'Normal', description || `${category || 'Issue'} reported`, guest_name || 'Front Desk Walk-In'
    );

    sseService.broadcast('NEW_MAINTENANCE_REQUEST', {
      requestId,
      requestCode,
      roomNumber: room.room_number,
      priority: priority || 'Normal',
      category: category || 'Maintenance',
      description: description || 'Issue reported',
      guestName: guest_name || 'Front Desk Walk-In',
      type: 'maintenance',
      createdAt: new Date().toISOString()
    });

    res.status(201).json({ success: true, requestId, requestCode, trackingToken });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/requests/services - Front Office / Admin creates service request
router.post('/services', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { room_id, room_number, service_type, priority, special_instructions, guest_name } = req.body;
    const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;

    let room: any = null;
    if (room_id) {
      room = db.prepare(`SELECT id, room_number FROM rooms WHERE id = ?`).get(room_id);
    }
    if (!room && room_number) {
      room = db.prepare(`SELECT id, room_number FROM rooms WHERE TRIM(LOWER(room_number)) = TRIM(LOWER(?))`).get(room_number);
    }
    if (!room) {
      return res.status(400).json({ error: 'Valid room is required.' });
    }

    const requestId = uuidv4();
    const trackingToken = uuidv4().replace(/-/g, '').substring(0, 16);

    const lastReq = db.prepare(`SELECT request_code FROM guest_service_requests ORDER BY created_at DESC LIMIT 1`).get() as any;
    let nextNum = 3015;
    if (lastReq && lastReq.request_code.startsWith('GS-')) {
      const parsed = parseInt(lastReq.request_code.replace('GS-', ''), 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }
    const requestCode = `GS-${nextNum}`;

    db.prepare(`
      INSERT INTO guest_service_requests (
        id, request_code, hotel_id, room_id, tracking_token, guest_name,
        service_type, quantity, notes, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 'Submitted', datetime('now'), datetime('now'))
    `).run(
      requestId, requestCode, hotel.id, room.id, trackingToken,
      guest_name || 'Front Desk Walk-In', service_type || 'Amenities', special_instructions || ''
    );

    sseService.broadcast('NEW_GUEST_SERVICE_REQUEST', {
      requestId,
      requestCode,
      roomNumber: room.room_number,
      serviceType: service_type || 'Amenities',
      category: service_type || 'Amenities',
      description: special_instructions || `Requested ${service_type}`,
      guestName: guest_name || 'Front Desk Walk-In',
      type: 'service',
      priority: priority || 'medium',
      createdAt: new Date().toISOString()
    });

    res.status(201).json({ success: true, requestId, requestCode, trackingToken });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST/PUT /api/requests/services/:id/assign - Assign staff to guest service request
router.all(['/services/:id/assign'], authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { staff_id, staffId } = req.body;
    const effectiveStaffId = staff_id || staffId;

    if (!effectiveStaffId) {
      return res.status(400).json({ error: 'Staff member selection is required.' });
    }

    const request = db.prepare(`
      SELECT gsr.*, r.room_number 
      FROM guest_service_requests gsr 
      LEFT JOIN rooms r ON gsr.room_id = r.id 
      WHERE gsr.id = ?
    `).get(id) as any;

    if (!request) {
      return res.status(404).json({ error: 'Service request not found.' });
    }

    const staff = db.prepare(`
      SELECT sp.*, u.full_name, u.id as user_id FROM staff_profiles sp JOIN users u ON sp.user_id = u.id WHERE sp.id = ?
    `).get(effectiveStaffId) as any;

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }

    db.prepare(`
      UPDATE guest_service_requests
      SET status = 'Assigned', updated_at = datetime('now')
      WHERE id = ?
    `).run(id);

    // Revoke old tokens
    JobTokenService.revokeTokensForRequest(id, 'Job reassigned');

    // Generate fresh secure job link
    const jobToken = JobTokenService.createJobToken({
      requestId: id,
      staffId: effectiveStaffId,
      hotelId: request.hotel_id,
      roomId: request.room_id
    });

    // Dispatch SMS / WhatsApp notification to technician's mobile phone
    const notifResult = await NotificationService.sendJobAssigned({
      requestId: id,
      staffId: effectiveStaffId,
      jobToken: jobToken.token,
      jobUrl: jobToken.jobUrl,
      assignedByUserId: req.user?.id
    });

    sseService.broadcastToUser(staff.user_id, 'TASK_ASSIGNED', {
      requestId: id,
      requestCode: request.request_code,
      roomNumber: request.room_number,
      priority: request.priority || 'Normal',
      jobUrl: jobToken.jobUrl
    });

    res.json({
      success: true,
      message: `Service request assigned to ${staff.full_name}.`,
      jobToken: jobToken.token,
      jobUrl: jobToken.jobUrl,
      notification: notifResult
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/requests/:id - Securely delete maintenance or service request
router.delete('/:id', authenticateToken, requireRole(['Hotel Admin', 'Super Admin', 'Maintenance Manager']), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    let reqRecord = db.prepare(`SELECT mr.*, r.room_number FROM maintenance_requests mr JOIN rooms r ON mr.room_id = r.id WHERE mr.id = ?`).get(id) as any;
    let isService = false;
    if (!reqRecord) {
      reqRecord = db.prepare(`SELECT gsr.*, r.room_number FROM guest_service_requests gsr JOIN rooms r ON gsr.room_id = r.id WHERE gsr.id = ?`).get(id) as any;
      if (reqRecord) isService = true;
    }

    if (!reqRecord) {
      return res.status(404).json({ error: 'Request not found.' });
    }

    db.transaction(() => {
      if (isService) {
        db.prepare(`DELETE FROM job_tokens WHERE request_id = ?`).run(id);
        db.prepare(`DELETE FROM notification_logs WHERE job_id = ?`).run(id);
        db.prepare(`DELETE FROM guest_service_requests WHERE id = ?`).run(id);
      } else {
        db.prepare(`DELETE FROM maintenance_request_items WHERE request_id = ?`).run(id);
        db.prepare(`DELETE FROM request_status_history WHERE request_id = ?`).run(id);
        db.prepare(`DELETE FROM staff_assignments WHERE request_id = ?`).run(id);
        db.prepare(`DELETE FROM job_tokens WHERE request_id = ?`).run(id);
        db.prepare(`DELETE FROM notification_logs WHERE job_id = ?`).run(id);
        db.prepare(`DELETE FROM maintenance_requests WHERE id = ?`).run(id);
      }
    })();

    recordAuditLog({
      hotelId: reqRecord.hotel_id,
      userId: req.user?.id,
      userName: req.user?.full_name,
      action: 'REQUEST_DELETED',
      entity: isService ? 'guest_service_request' : 'maintenance_request',
      entityId: id,
      details: { requestCode: reqRecord.request_code, room: reqRecord.room_number }
    });

    sseService.broadcast('REQUEST_STATUS_CHANGED', {
      requestId: id,
      requestCode: reqRecord.request_code,
      status: 'Deleted',
      roomNumber: reqRecord.room_number,
      updatedBy: req.user?.full_name
    });

    res.json({ success: true, message: `Request ${reqRecord.request_code} deleted successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/requests/services/:id - Securely delete guest service request
router.delete('/services/:id', authenticateToken, requireRole(['Hotel Admin', 'Super Admin', 'Front Office Staff']), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reqRecord = db.prepare(`SELECT gsr.*, r.room_number FROM guest_service_requests gsr JOIN rooms r ON gsr.room_id = r.id WHERE gsr.id = ?`).get(id) as any;
    if (!reqRecord) return res.status(404).json({ error: 'Service request not found.' });

    db.transaction(() => {
      db.prepare(`DELETE FROM job_tokens WHERE request_id = ?`).run(id);
      db.prepare(`DELETE FROM notification_logs WHERE job_id = ?`).run(id);
      db.prepare(`DELETE FROM guest_service_requests WHERE id = ?`).run(id);
    })();

    recordAuditLog({
      hotelId: reqRecord.hotel_id,
      userId: req.user?.id,
      userName: req.user?.full_name,
      action: 'SERVICE_REQUEST_DELETED',
      entity: 'guest_service_request',
      entityId: id,
      details: { requestCode: reqRecord.request_code, room: reqRecord.room_number }
    });

    sseService.broadcast('REQUEST_STATUS_CHANGED', {
      requestId: id,
      requestCode: reqRecord.request_code,
      status: 'Deleted',
      roomNumber: reqRecord.room_number,
      updatedBy: req.user?.full_name
    });

    res.json({ success: true, message: `Service request ${reqRecord.request_code} deleted successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
