import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { sseService } from '../services/sse';
import { PaymentService } from '../services/payment';
import { recordAuditLog } from '../middleware/audit';

const router = Router();

// GET /api/guest/room/:token - Public room resolution by secure QR token
router.get('/room/:token', (req, res: Response) => {
  try {
    const { token } = req.params;

    // Check QR code validity
    const qrRecord = db.prepare(`SELECT * FROM qr_codes WHERE token = ?`).get(token) as any;
    if (!qrRecord) {
      return res.status(404).json({
        error: 'Invalid QR Code. This room QR code does not exist or has expired.',
        code: 'QR_INVALID'
      });
    }

    if (qrRecord.is_active !== 1) {
      return res.status(403).json({
        error: 'This room QR code has been temporarily disabled by hotel management.',
        code: 'QR_DISABLED'
      });
    }

    // Increment scan count
    db.prepare(`
      UPDATE qr_codes
      SET scans_count = scans_count + 1, last_scanned_at = datetime('now')
      WHERE token = ?
    `).run(token);

    // Fetch Room and Hotel Info (Sanitized for public guest consumption)
    const room = db.prepare(`
      SELECT r.id as room_id, r.room_number, r.name as room_name,
             rt.name as room_type_name, rt.bed_type, rt.description as room_type_desc,
             b.name as building_name,
             f.name as floor_name, f.floor_number,
             h.id as hotel_id, h.name as hotel_name, h.resort_name, h.logo_url,
             h.phone as hotel_phone, h.emergency_contact, h.guest_service_contact,
             h.currency
      FROM rooms r
      JOIN hotels h ON r.hotel_id = h.id
      LEFT JOIN room_types rt ON r.room_type_id = rt.id
      LEFT JOIN buildings b ON r.building_id = b.id
      LEFT JOIN floors f ON r.floor_id = f.id
      WHERE r.qr_token = ?
    `).get(token) as any;

    if (!room) {
      return res.status(404).json({ error: 'Room details not found for this token.' });
    }

    // Fetch items specifically assigned to this room
    const items = db.prepare(`
      SELECT ria.id as assignment_id, ri.id as item_id, ri.name as item_name,
             ri.category, ri.icon, ria.condition_status
      FROM room_item_assignments ria
      JOIN room_items ri ON ria.room_item_id = ri.id
      WHERE ria.room_id = ?
      ORDER BY ri.category, ri.name ASC
    `).all(room.room_id) as any[];

    // Fetch all active staff profiles, prioritizing staff members who recently worked in or were assigned to this room
    const staff = db.prepare(`
      SELECT 
        sp.id as staff_id,
        u.full_name as staff_name,
        sp.job_title,
        sp.department,
        sp.avatar_url,
        sp.rating,
        CASE
          WHEN rw.staff_id IS NOT NULL THEN 1
          ELSE 0
        END as worked_in_room,
        rw.service_reason,
        COALESCE(rw.last_work_time, '1970-01-01') as last_service_time
      FROM staff_profiles sp
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN (
        SELECT staff_id, service_reason, MAX(work_time) as last_work_time FROM (
          SELECT sa.staff_id, 'Assigned Technician' as service_reason, COALESCE(sa.completed_at, sa.assigned_at) as work_time
          FROM staff_assignments sa
          JOIN maintenance_requests mr ON sa.request_id = mr.id
          WHERE mr.room_id = ?
          UNION ALL
          SELECT mr.completed_by_staff_id as staff_id, 'Completed Room Service' as service_reason, COALESCE(mr.resolved_at, mr.updated_at) as work_time
          FROM maintenance_requests mr
          WHERE mr.room_id = ? AND mr.completed_by_staff_id IS NOT NULL
          UNION ALL
          SELECT jt.staff_id, 'Dispatched Staff' as service_reason, jt.created_at as work_time
          FROM job_tokens jt
          WHERE jt.room_id = ?
        ) GROUP BY staff_id
      ) rw ON rw.staff_id = sp.id
      WHERE (u.status = 'active' OR u.status IS NULL OR u.status != 'inactive')
      ORDER BY worked_in_room DESC, last_service_time DESC, sp.rating DESC, u.full_name ASC
    `).all(room.room_id, room.room_id, room.room_id) as any[];

    res.json({
      success: true,
      roomToken: token,
      hotel: {
        id: room.hotel_id,
        name: room.hotel_name,
        resortName: room.resort_name,
        logoUrl: room.logo_url,
        phone: room.hotel_phone,
        emergencyContact: room.emergency_contact,
        guestServiceContact: room.guest_service_contact,
        currency: room.currency || 'USD'
      },
      room: {
        id: room.room_id,
        number: room.room_number,
        name: room.room_name,
        type: room.room_type_name,
        building: room.building_name,
        floor: room.floor_name
      },
      facilities: items,
      serviceStaff: staff
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/guest/maintenance-request - Submit maintenance request from room
router.post('/maintenance-request', (req, res: Response) => {
  try {
    const { roomToken, items, description, urgency, guestName, guestPhone, photos } = req.body;

    if (!roomToken) {
      return res.status(400).json({ error: 'Room token is required.' });
    }

    const room = db.prepare(`
      SELECT r.id, r.room_number, r.hotel_id, h.name as hotel_name
      FROM rooms r
      JOIN hotels h ON r.hotel_id = h.id
      WHERE r.qr_token = ?
    `).get(roomToken) as any;

    if (!room) {
      return res.status(404).json({ error: 'Room not found for provided token.' });
    }

    const requestId = uuidv4();
    const trackingToken = uuidv4().replace(/-/g, '').substring(0, 16);
    
    // Generate sequential request code e.g. RM-1025
    const lastReq = db.prepare(`SELECT request_code FROM maintenance_requests ORDER BY created_at DESC LIMIT 1`).get() as any;
    let nextNum = 1025;
    if (lastReq && lastReq.request_code.startsWith('RM-')) {
      const parsed = parseInt(lastReq.request_code.replace('RM-', ''), 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }
    const requestCode = `RM-${nextNum}`;

    const priority = urgency === 'Emergency' ? 'Emergency' : (urgency === 'High' ? 'High' : 'Normal');

    db.transaction(() => {
      // 1. Insert Request
      db.prepare(`
        INSERT INTO maintenance_requests (
          id, request_code, hotel_id, room_id, tracking_token, guest_name, guest_phone,
          priority, urgency, status, description, photos_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', ?, ?, datetime('now'), datetime('now'))
      `).run(
        requestId, requestCode, room.hotel_id, room.id, trackingToken,
        guestName || 'Guest', guestPhone || '', priority, urgency || 'Normal',
        description || '', photos ? JSON.stringify(photos) : '[]'
      );

      // 2. Insert items reported
      if (Array.isArray(items) && items.length > 0) {
        const itemStmt = db.prepare(`
          INSERT INTO maintenance_request_items (id, request_id, room_item_assignment_id, item_name, problem_type, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const item of items) {
          itemStmt.run(
            uuidv4(),
            requestId,
            item.assignmentId || null,
            item.itemName || 'Equipment',
            item.problemType || 'Not working',
            item.notes || ''
          );

          // If item assignment ID exists, update condition status to "Needs Inspection"
          if (item.assignmentId) {
            db.prepare(`
              UPDATE room_item_assignments
              SET condition_status = 'Needs Inspection', updated_at = datetime('now')
              WHERE id = ?
            `).run(item.assignmentId);
          }
        }
      }

      // 3. Insert Initial Timeline Status
      db.prepare(`
        INSERT INTO request_status_history (id, request_id, status, notes, created_at)
        VALUES (?, ?, 'Submitted', 'Guest submitted maintenance request via in-room QR code', datetime('now'))
      `).run(uuidv4(), requestId);

      // 4. Update room status to Maintenance if High or Emergency
      if (priority === 'High' || priority === 'Emergency') {
        db.prepare(`UPDATE rooms SET room_status = 'Maintenance' WHERE id = ?`).run(room.id);
      }

      // 5. Create Front Office In-App Notification
      const notifId = uuidv4();
      const firstItem = items && items[0] ? items[0].itemName : 'Room Item';
      const notifTitle = `New Maintenance Request - Room ${room.room_number}`;
      const notifMsg = `${room.room_number}: ${firstItem} (${priority} priority)`;

      db.prepare(`
        INSERT INTO notifications (id, hotel_id, target_role, title, message, type, link, created_at)
        VALUES (?, ?, 'Front Office Staff', ?, ?, ?, '/admin/maintenance', datetime('now'))
      `).run(notifId, room.hotel_id, notifTitle, notifMsg, priority === 'Emergency' ? 'urgent' : 'warning');
    })();

    // Fire Real-Time SSE Notification to Front Office & Technicians
    sseService.broadcast('NEW_MAINTENANCE_REQUEST', {
      requestId,
      requestCode,
      roomNumber: room.room_number,
      priority,
      category: items && items[0] ? items[0].itemName : 'Maintenance',
      description: description || (items && items[0] ? `${items[0].itemName} (${items[0].problemType || 'Issue'})` : 'Maintenance reported'),
      items: items || [],
      guestName: guestName || 'In-Room Guest',
      guestPhone: guestPhone || '',
      type: 'maintenance',
      createdAt: new Date().toISOString()
    });

    recordAuditLog({
      hotelId: room.hotel_id,
      userName: guestName || `Guest (Room ${room.room_number})`,
      action: 'GUEST_MAINTENANCE_REQUEST',
      entity: 'maintenance_request',
      entityId: requestId,
      details: { requestCode, room: room.room_number, itemsCount: items?.length }
    });

    res.status(201).json({
      success: true,
      requestId,
      requestCode,
      trackingToken,
      trackingUrl: `/guest/track/${trackingToken}`,
      message: 'Maintenance request received. Our team is being notified immediately.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/guest/service-request - Guest supplies & room service request
router.post('/service-request', (req, res: Response) => {
  try {
    const { roomToken, serviceType, quantity, notes, guestName, guestPhone } = req.body;

    if (!roomToken || !serviceType) {
      return res.status(400).json({ error: 'Room token and service type are required.' });
    }

    const room = db.prepare(`SELECT id, room_number, hotel_id FROM rooms WHERE qr_token = ?`).get(roomToken) as any;
    if (!room) {
      return res.status(404).json({ error: 'Room not found.' });
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
        guest_phone, service_type, quantity, notes, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', datetime('now'), datetime('now'))
    `).run(
      requestId, requestCode, room.hotel_id, room.id, trackingToken,
      guestName || 'Guest', guestPhone || '', serviceType, quantity || 1, notes || ''
    );

    // Front office notification
    db.prepare(`
      INSERT INTO notifications (id, hotel_id, target_role, title, message, type, link, created_at)
      VALUES (?, ?, 'Front Office Staff', ?, ?, 'info', '/admin/guest-requests', datetime('now'))
    `).run(
      uuidv4(), room.hotel_id,
      `Guest Request: Room ${room.room_number}`,
      `Requested ${quantity || 1}x ${serviceType}`
    );

    sseService.broadcast('NEW_GUEST_SERVICE_REQUEST', {
      requestId,
      requestCode,
      roomNumber: room.room_number,
      serviceType,
      quantity,
      category: serviceType,
      description: `Requested ${quantity || 1}x ${serviceType}${notes ? ` - ${notes}` : ''}`,
      guestName: guestName || 'In-Room Guest',
      guestPhone: guestPhone || '',
      type: 'service',
      priority: 'medium',
      createdAt: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      requestCode,
      trackingToken,
      trackingUrl: `/guest/track/${trackingToken}`,
      message: 'Service request dispatched to hotel staff.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/guest/track/:token - Public request tracking by secure tracking token
router.get('/track/:token', (req, res: Response) => {
  try {
    const { token } = req.params;

    // Check maintenance request
    const maintReq = db.prepare(`
      SELECT mr.*,
             r.id as room_id, r.room_number, r.qr_token, r.name as room_name,
             h.name as hotel_name, h.logo_url, h.phone as hotel_phone
      FROM maintenance_requests mr
      JOIN rooms r ON mr.room_id = r.id
      JOIN hotels h ON mr.hotel_id = h.id
      WHERE mr.tracking_token = ?
    `).get(token) as any;

    if (maintReq) {
      // Get items
      const items = db.prepare(`
        SELECT item_name, problem_type, notes FROM maintenance_request_items WHERE request_id = ?
      `).all(maintReq.id);

      // Get status timeline
      const timeline = db.prepare(`
        SELECT status, notes, created_at FROM request_status_history WHERE request_id = ? ORDER BY created_at ASC
      `).all(maintReq.id);

      // Get assigned technician
      let assignedStaff = db.prepare(`
        SELECT sp.id as staff_id, u.full_name as staff_name, sp.job_title, sp.department, sp.avatar_url, sp.rating
        FROM staff_assignments sa
        JOIN staff_profiles sp ON sa.staff_id = sp.id
        JOIN users u ON sp.user_id = u.id
        WHERE sa.request_id = ?
        ORDER BY sa.assigned_at DESC LIMIT 1
      `).get(maintReq.id) as any;

      // If job is completed or assignment was archived, lookup completed_by_staff_id
      if (!assignedStaff && maintReq.completed_by_staff_id) {
        assignedStaff = db.prepare(`
          SELECT sp.id as staff_id, u.full_name as staff_name, sp.job_title, sp.department, sp.avatar_url, sp.rating
          FROM staff_profiles sp
          JOIN users u ON sp.user_id = u.id
          WHERE sp.id = ?
        `).get(maintReq.completed_by_staff_id) as any;
      }

      // Fallback: active maintenance staff
      if (!assignedStaff) {
        assignedStaff = db.prepare(`
          SELECT sp.id as staff_id, u.full_name as staff_name, sp.job_title, sp.department, sp.avatar_url, sp.rating
          FROM staff_profiles sp
          JOIN users u ON sp.user_id = u.id
          WHERE sp.department = 'Maintenance' OR sp.job_title LIKE '%Technician%'
          ORDER BY sp.rating DESC LIMIT 1
        `).get() as any;
      }

      // Fetch all staff members, prioritizing the assigned/room technician at the very top
      const allStaff = db.prepare(`
        SELECT 
          sp.id as staff_id,
          u.full_name as staff_name,
          sp.job_title,
          sp.department,
          sp.avatar_url,
          sp.rating,
          CASE
            WHEN sp.id = ? THEN 1
            WHEN rw.staff_id IS NOT NULL THEN 1
            ELSE 0
          END as worked_in_room,
          CASE
            WHEN sp.id = ? THEN 'Assigned Technician'
            ELSE rw.service_reason
          END as service_reason,
          COALESCE(rw.last_work_time, '1970-01-01') as last_service_time
        FROM staff_profiles sp
        JOIN users u ON sp.user_id = u.id
        LEFT JOIN (
          SELECT staff_id, service_reason, MAX(work_time) as last_work_time FROM (
            SELECT sa.staff_id, 'Assigned Technician' as service_reason, COALESCE(sa.completed_at, sa.assigned_at) as work_time
            FROM staff_assignments sa
            JOIN maintenance_requests mr ON sa.request_id = mr.id
            WHERE mr.room_id = ?
            UNION ALL
            SELECT mr.completed_by_staff_id as staff_id, 'Completed Room Service' as service_reason, COALESCE(mr.resolved_at, mr.updated_at) as work_time
            FROM maintenance_requests mr
            WHERE mr.room_id = ? AND mr.completed_by_staff_id IS NOT NULL
            UNION ALL
            SELECT jt.staff_id, 'Dispatched Staff' as service_reason, jt.created_at as work_time
            FROM job_tokens jt
            WHERE jt.room_id = ?
          ) GROUP BY staff_id
        ) rw ON rw.staff_id = sp.id
        WHERE (u.status = 'active' OR u.status IS NULL OR u.status != 'inactive')
        ORDER BY worked_in_room DESC, last_service_time DESC, sp.rating DESC, u.full_name ASC
      `).all(
        assignedStaff?.staff_id || '',
        assignedStaff?.staff_id || '',
        maintReq.room_id,
        maintReq.room_id,
        maintReq.room_id
      ) as any[];

      if (assignedStaff) {
        assignedStaff.worked_in_room = 1;
        assignedStaff.service_reason = 'Assigned Technician';
      }

      return res.json({
        type: 'maintenance',
        requestId: maintReq.id,
        roomId: maintReq.room_id,
        roomToken: maintReq.qr_token,
        requestCode: maintReq.request_code,
        status: maintReq.status,
        roomNumber: maintReq.room_number,
        hotelName: maintReq.hotel_name,
        hotelLogo: maintReq.logo_url,
        hotelPhone: maintReq.hotel_phone,
        priority: maintReq.priority,
        description: maintReq.description,
        items,
        timeline,
        assignedStaff,
        allStaff,
        createdAt: maintReq.created_at,
        resolvedAt: maintReq.resolved_at
      });
    }

    // Check guest service request
    const serviceReq = db.prepare(`
      SELECT gsr.*, r.id as room_id, r.room_number, r.qr_token, h.name as hotel_name, h.logo_url, h.phone as hotel_phone
      FROM guest_service_requests gsr
      JOIN rooms r ON gsr.room_id = r.id
      JOIN hotels h ON gsr.hotel_id = h.id
      WHERE gsr.tracking_token = ?
    `).get(token) as any;

    if (serviceReq) {
      let assignedStaff = db.prepare(`
        SELECT sp.id as staff_id, u.full_name as staff_name, sp.job_title, sp.department, sp.avatar_url, sp.rating
        FROM staff_profiles sp
        JOIN users u ON sp.user_id = u.id
        WHERE sp.department IN ('Room Service', 'Housekeeping')
        ORDER BY sp.rating DESC LIMIT 1
      `).get() as any;

      const allStaff = db.prepare(`
        SELECT 
          sp.id as staff_id,
          u.full_name as staff_name,
          sp.job_title,
          sp.department,
          sp.avatar_url,
          sp.rating,
          CASE
            WHEN sp.id = ? THEN 1
            WHEN rw.staff_id IS NOT NULL THEN 1
            ELSE 0
          END as worked_in_room,
          CASE
            WHEN sp.id = ? THEN 'Assigned Staff'
            ELSE rw.service_reason
          END as service_reason,
          COALESCE(rw.last_work_time, '1970-01-01') as last_service_time
        FROM staff_profiles sp
        JOIN users u ON sp.user_id = u.id
        LEFT JOIN (
          SELECT staff_id, service_reason, MAX(work_time) as last_work_time FROM (
            SELECT sa.staff_id, 'Assigned Staff' as service_reason, COALESCE(sa.completed_at, sa.assigned_at) as work_time
            FROM staff_assignments sa
            JOIN maintenance_requests mr ON sa.request_id = mr.id
            WHERE mr.room_id = ?
            UNION ALL
            SELECT mr.completed_by_staff_id as staff_id, 'Completed Room Service' as service_reason, COALESCE(mr.resolved_at, mr.updated_at) as work_time
            FROM maintenance_requests mr
            WHERE mr.room_id = ? AND mr.completed_by_staff_id IS NOT NULL
            UNION ALL
            SELECT jt.staff_id, 'Dispatched Staff' as service_reason, jt.created_at as work_time
            FROM job_tokens jt
            WHERE jt.room_id = ?
          ) GROUP BY staff_id
        ) rw ON rw.staff_id = sp.id
        WHERE (u.status = 'active' OR u.status IS NULL OR u.status != 'inactive')
        ORDER BY worked_in_room DESC, last_service_time DESC, sp.rating DESC, u.full_name ASC
      `).all(
        assignedStaff?.staff_id || '',
        assignedStaff?.staff_id || '',
        serviceReq.room_id,
        serviceReq.room_id,
        serviceReq.room_id
      ) as any[];

      if (assignedStaff) {
        assignedStaff.worked_in_room = 1;
        assignedStaff.service_reason = 'Assigned Staff';
      }

      return res.json({
        type: 'service',
        requestId: serviceReq.id,
        roomId: serviceReq.room_id,
        roomToken: serviceReq.qr_token,
        requestCode: serviceReq.request_code,
        status: serviceReq.status,
        roomNumber: serviceReq.room_number,
        hotelName: serviceReq.hotel_name,
        hotelLogo: serviceReq.logo_url,
        serviceType: serviceReq.service_type,
        quantity: serviceReq.quantity,
        notes: serviceReq.notes,
        assignedStaff,
        allStaff,
        createdAt: serviceReq.created_at
      });
    }

    return res.status(404).json({ error: 'Request tracking token not found.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/guest/tip - Submit tip and initialize payment session
router.post('/tip', async (req, res: Response) => {
  try {
    const effectiveStaffId = req.body.staffId || req.body.staff_id;
    const effectiveAmount = req.body.amount || req.body.customAmount;
    const effectiveRoomToken = req.body.roomToken || req.body.room_token || req.body.tracking_token;
    const effectiveRoomId = req.body.roomId || req.body.room_id;
    const effectiveRoomNumber = req.body.roomNumber || req.body.room_number;
    let effectiveRequestId = req.body.requestId || req.body.request_id;
    const effectiveGuestName = req.body.guestName || req.body.guest_name;
    const effectiveGuestMessage = req.body.guestMessage || req.body.guest_message || req.body.comment;
    const customAmount = req.body.customAmount;

    if (!effectiveStaffId || !effectiveAmount || Number(effectiveAmount) <= 0) {
      return res.status(400).json({ error: 'Staff member and valid tip amount are required.' });
    }

    // Resolve room using resilient fallback strategies
    let room: any = null;

    // 1. By roomToken (could be qr_token, or tracking_token, or room id)
    if (effectiveRoomToken) {
      room = db.prepare(`SELECT id, hotel_id, room_number FROM rooms WHERE qr_token = ?`).get(effectiveRoomToken);

      if (!room) {
        // Maybe roomToken is actually a maintenance tracking token
        const mReq = db.prepare(`
          SELECT r.id, r.hotel_id, r.room_number, mr.id as req_id
          FROM maintenance_requests mr
          JOIN rooms r ON mr.room_id = r.id
          WHERE mr.tracking_token = ?
        `).get(effectiveRoomToken) as any;
        if (mReq) {
          room = mReq;
          if (!effectiveRequestId) effectiveRequestId = mReq.req_id;
        }
      }

      if (!room) {
        // Maybe roomToken is actually a service tracking token
        const sReq = db.prepare(`
          SELECT r.id, r.hotel_id, r.room_number, gsr.id as req_id
          FROM guest_service_requests gsr
          JOIN rooms r ON gsr.room_id = r.id
          WHERE gsr.tracking_token = ?
        `).get(effectiveRoomToken) as any;
        if (sReq) {
          room = sReq;
          if (!effectiveRequestId) effectiveRequestId = sReq.req_id;
        }
      }

      if (!room) {
        // Maybe roomToken was actually the room ID
        room = db.prepare(`SELECT id, hotel_id, room_number FROM rooms WHERE id = ?`).get(effectiveRoomToken);
      }
    }

    // 2. If room not found yet, check by requestId (if requestId is an ID or tracking token)
    if (!room && effectiveRequestId) {
      const mReq = db.prepare(`
        SELECT r.id, r.hotel_id, r.room_number, mr.id as req_id
        FROM maintenance_requests mr
        JOIN rooms r ON mr.room_id = r.id
        WHERE mr.id = ? OR mr.tracking_token = ?
      `).get(effectiveRequestId, effectiveRequestId) as any;
      if (mReq) {
        room = mReq;
        effectiveRequestId = mReq.req_id;
      } else {
        const sReq = db.prepare(`
          SELECT r.id, r.hotel_id, r.room_number, gsr.id as req_id
          FROM guest_service_requests gsr
          JOIN rooms r ON gsr.room_id = r.id
          WHERE gsr.id = ? OR gsr.tracking_token = ?
        `).get(effectiveRequestId, effectiveRequestId) as any;
        if (sReq) {
          room = sReq;
          effectiveRequestId = sReq.req_id;
        }
      }
    }

    // 3. If room not found yet, check by roomId
    if (!room && effectiveRoomId) {
      room = db.prepare(`SELECT id, hotel_id, room_number FROM rooms WHERE id = ?`).get(effectiveRoomId);
    }

    // 4. If room not found yet, check by roomNumber (case-insensitive and trimmed)
    if (!room && effectiveRoomNumber) {
      room = db.prepare(`SELECT id, hotel_id, room_number FROM rooms WHERE TRIM(LOWER(room_number)) = TRIM(LOWER(?))`).get(effectiveRoomNumber);
    }

    // 5. Final fail-safe fallback: match room by staff member's hotel or default room
    if (!room) {
      if (effectiveStaffId) {
        const staffHotel = db.prepare(`
          SELECT u.hotel_id FROM staff_profiles sp JOIN users u ON sp.user_id = u.id WHERE sp.id = ?
        `).get(effectiveStaffId) as any;
        if (staffHotel?.hotel_id) {
          room = db.prepare(`SELECT id, hotel_id, room_number FROM rooms WHERE hotel_id = ? ORDER BY room_number ASC LIMIT 1`).get(staffHotel.hotel_id);
        }
      }
      if (!room) {
        room = db.prepare(`SELECT id, hotel_id, room_number FROM rooms ORDER BY room_number ASC LIMIT 1`).get();
      }
    }

    if (!room) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    const staff = db.prepare(`
      SELECT sp.id, u.full_name, sp.department, sp.job_title
      FROM staff_profiles sp JOIN users u ON sp.user_id = u.id WHERE sp.id = ?
    `).get(effectiveStaffId) as any;

    if (!staff) {
      return res.status(404).json({ error: 'Staff profile not found.' });
    }

    const session = await PaymentService.createPaymentSession({
      hotelId: room.hotel_id,
      roomId: room.id,
      staffId: staff.id,
      requestId: effectiveRequestId || undefined,
      amount: Number(effectiveAmount),
      currency: 'USD',
      customAmount: !!customAmount,
      guestName: effectiveGuestName || `Guest (Room ${room.room_number})`,
      guestMessage: effectiveGuestMessage || ''
    });

    res.status(201).json({
      success: true,
      ...session,
      staff: {
        id: staff.id,
        name: staff.full_name,
        jobTitle: staff.job_title
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
