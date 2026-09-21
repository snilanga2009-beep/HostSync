import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { QRCodeService } from '../services/qrcode';
import { recordAuditLog } from '../middleware/audit';

const router = Router();

// GET /api/rooms - List all rooms with filter options
router.get('/', (req, res: Response) => {
  try {
    const { building_id, floor_id, room_status, occupancy_status, search } = req.query;

    let query = `
      SELECT r.*,
             rt.name as room_type_name, rt.code as room_type_code, rt.base_price,
             b.name as building_name,
             f.floor_number, f.name as floor_name,
             q.token as qr_token, q.qr_data_url, q.scans_count as qr_scans, q.is_active as qr_active,
             (SELECT COUNT(*) FROM room_item_assignments WHERE room_id = r.id) as total_items,
             (SELECT COUNT(*) FROM room_item_assignments WHERE room_id = r.id AND condition_status != 'Working') as damaged_items,
             (SELECT COUNT(*) FROM maintenance_requests WHERE room_id = r.id AND status NOT IN ('Completed', 'Cancelled')) as open_requests
      FROM rooms r
      LEFT JOIN room_types rt ON r.room_type_id = rt.id
      LEFT JOIN buildings b ON r.building_id = b.id
      LEFT JOIN floors f ON r.floor_id = f.id
      LEFT JOIN qr_codes q ON q.room_id = r.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (building_id) {
      query += ` AND r.building_id = ?`;
      params.push(building_id);
    }
    if (floor_id) {
      query += ` AND r.floor_id = ?`;
      params.push(floor_id);
    }
    if (room_status) {
      query += ` AND r.room_status = ?`;
      params.push(room_status);
    }
    if (occupancy_status) {
      query += ` AND r.occupancy_status = ?`;
      params.push(occupancy_status);
    }
    if (search) {
      query += ` AND (r.room_number LIKE ? OR r.name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY r.room_number ASC`;

    const rooms = db.prepare(query).all(...params);
    res.json({ rooms });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rooms/qr/printable-sheet - Returns all rooms with QR and hotel metadata for batch printing
router.get('/qr/printable-sheet', async (req, res: Response) => {
  try {
    const hotel = db.prepare(`SELECT * FROM hotels LIMIT 1`).get() as any;
    const rooms = db.prepare(`
      SELECT r.id, r.room_number, r.name as room_name,
             rt.name as room_type_name,
             b.name as building_name,
             f.name as floor_name,
             q.token as qr_token, q.qr_data_url
      FROM rooms r
      LEFT JOIN room_types rt ON r.room_type_id = rt.id
      LEFT JOIN buildings b ON r.building_id = b.id
      LEFT JOIN floors f ON r.floor_id = f.id
      LEFT JOIN qr_codes q ON q.room_id = r.id
      WHERE q.is_active = 1
      ORDER BY r.room_number ASC
    `).all();

    res.json({
      hotel,
      rooms,
      instructions: "Scan for Guest Services & Maintenance",
      subInstructions: "Need assistance? Point your smartphone camera at the QR code."
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rooms/:id/qr.png - Stream room QR code directly as PNG image
router.get('/:id/qr.png', async (req, res: Response) => {
  try {
    const { id } = req.params;
    const room = db.prepare(`
      SELECT r.id, r.room_number, r.qr_token, q.qr_data_url
      FROM rooms r
      LEFT JOIN qr_codes q ON q.room_id = r.id
      WHERE r.id = ?
    `).get(id) as any;

    if (!room) {
      return res.status(404).send('Room not found');
    }

    let qrDataUrl = room.qr_data_url;
    let token = room.qr_token;

    if (!token) {
      token = QRCodeService.generateSecureToken();
      db.prepare(`UPDATE rooms SET qr_token = ? WHERE id = ?`).run(token, id);
    }

    if (!qrDataUrl) {
      qrDataUrl = await QRCodeService.generateDataUrl(token);
      db.prepare(`
        INSERT INTO qr_codes (id, room_id, token, qr_data_url, scans_count, is_active, created_at)
        VALUES (?, ?, ?, ?, 0, 1, datetime('now'))
        ON CONFLICT(room_id) DO UPDATE SET qr_data_url = excluded.qr_data_url, token = excluded.token
      `).run(uuidv4(), id, token, qrDataUrl);
    }

    const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '');
    const imgBuffer = Buffer.from(base64Data, 'base64');

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', imgBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(imgBuffer);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

// GET /api/rooms/:id - Details of a single room with items & history
router.get('/:id', (req, res: Response) => {
  try {
    const { id } = req.params;

    const room = db.prepare(`
      SELECT r.*,
             rt.name as room_type_name, rt.code as room_type_code, rt.base_price,
             b.name as building_name,
             f.floor_number, f.name as floor_name,
             q.token as qr_token, q.qr_data_url, q.scans_count, q.is_active as qr_active
      FROM rooms r
      LEFT JOIN room_types rt ON r.room_type_id = rt.id
      LEFT JOIN buildings b ON r.building_id = b.id
      LEFT JOIN floors f ON r.floor_id = f.id
      LEFT JOIN qr_codes q ON q.room_id = r.id
      WHERE r.id = ?
    `).get(id) as any;

    if (!room) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    // Get assigned items
    const items = db.prepare(`
      SELECT ria.*,
             ri.name as item_name, ri.category as item_category, ri.icon as item_icon
      FROM room_item_assignments ria
      JOIN room_items ri ON ria.room_item_id = ri.id
      WHERE ria.room_id = ?
      ORDER BY ri.category, ri.name ASC
    `).all(id);

    // Get active/recent maintenance requests
    const requests = db.prepare(`
      SELECT mr.*,
             (SELECT full_name FROM staff_profiles sp JOIN users u ON sp.user_id = u.id JOIN staff_assignments sa ON sa.staff_id = sp.id WHERE sa.request_id = mr.id ORDER BY sa.assigned_at DESC LIMIT 1) as assigned_staff_name
      FROM maintenance_requests mr
      WHERE mr.room_id = ?
      ORDER BY mr.created_at DESC
      LIMIT 10
    `).all(id);

    res.json({ room, items, requests });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to resolve or auto-create building and floor records
function resolveBuildingAndFloor(
  hotelId: string,
  buildingInput?: string | null,
  floorInput?: string | null
): { buildingId: string | null; floorId: string | null } {
  let buildingId: string | null = null;
  let floorId: string | null = null;

  if (buildingInput && buildingInput.trim()) {
    const rawBldg = buildingInput.trim();
    // 1. Check if it's already an existing building ID
    const byId = db.prepare(`SELECT id FROM buildings WHERE id = ?`).get(rawBldg) as any;
    if (byId) {
      buildingId = byId.id;
    } else {
      // 2. Check if an existing building matches the name (case-insensitive)
      const byName = db.prepare(`
        SELECT id FROM buildings WHERE hotel_id = ? AND TRIM(LOWER(name)) = TRIM(LOWER(?))
      `).get(hotelId, rawBldg) as any;
      if (byName) {
        buildingId = byName.id;
      } else {
        // 3. Create new building automatically
        const newBldgId = `bldg-${uuidv4().substring(0, 8)}`;
        db.prepare(`INSERT INTO buildings (id, hotel_id, name, code) VALUES (?, ?, ?, ?)`).run(
          newBldgId, hotelId, rawBldg, ''
        );
        buildingId = newBldgId;
      }
    }
  }

  if (floorInput && floorInput.trim()) {
    const rawFloor = floorInput.trim();
    // 1. Check if it's already an existing floor ID
    const byId = db.prepare(`SELECT id, building_id FROM floors WHERE id = ?`).get(rawFloor) as any;
    if (byId) {
      floorId = byId.id;
      if (!buildingId && byId.building_id) {
        buildingId = byId.building_id;
      }
    } else if (buildingId) {
      // 2. Check if a floor exists for this building matching name
      const byName = db.prepare(`
        SELECT id FROM floors WHERE building_id = ? AND TRIM(LOWER(name)) = TRIM(LOWER(?))
      `).get(buildingId, rawFloor) as any;
      if (byName) {
        floorId = byName.id;
      } else {
        // 3. Create new floor automatically for this building
        const matchNum = rawFloor.match(/\d+/);
        let floorNum = matchNum ? parseInt(matchNum[0], 10) : 1;
        if (/ground/i.test(rawFloor)) floorNum = 0;
        if (/basement/i.test(rawFloor)) floorNum = -1;

        const newFloorId = `floor-${uuidv4().substring(0, 8)}`;
        db.prepare(`INSERT INTO floors (id, building_id, floor_number, name) VALUES (?, ?, ?, ?)`).run(
          newFloorId, buildingId, floorNum, rawFloor
        );
        floorId = newFloorId;
      }
    }
  }

  return { buildingId, floorId };
}

// POST /api/rooms - Create new room
router.post('/', authenticateToken, requireRole(['Hotel Admin', 'Super Admin', 'Front Office Staff']), async (req: AuthRequest, res: Response) => {
  try {
    const { room_number, name, room_type_id, room_status, occupancy_status, room_image, notes } = req.body;
    const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;

    const rawBuilding = req.body.building_id || req.body.building_name || req.body.building;
    const rawFloor = req.body.floor_id || req.body.floor_name || req.body.floor;
    const { buildingId, floorId } = resolveBuildingAndFloor(hotel.id, rawBuilding, rawFloor);

    // Check duplicate room number
    const existing = db.prepare(`SELECT id FROM rooms WHERE hotel_id = ? AND room_number = ?`).get(hotel.id, room_number);
    if (existing) {
      return res.status(400).json({ error: `Room ${room_number} already exists.` });
    }

    const roomId = `room-${room_number.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const qrToken = QRCodeService.generateSecureToken();
    const qrDataUrl = await QRCodeService.generateDataUrl(qrToken);

    db.transaction(() => {
      db.prepare(`
        INSERT INTO rooms (
          id, hotel_id, building_id, floor_id, room_type_id, room_number, name,
          room_status, occupancy_status, guest_status, qr_token, room_image, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'None', ?, ?, ?)
      `).run(
        roomId, hotel.id, buildingId || null, floorId || null, room_type_id || null,
        room_number, name || `Room ${room_number}`,
        room_status || 'Available', occupancy_status || 'Vacant',
        qrToken, room_image || '', notes || ''
      );

      db.prepare(`
        INSERT INTO qr_codes (id, room_id, token, qr_data_url, scans_count, is_active, created_at)
        VALUES (?, ?, ?, ?, 0, 1, datetime('now'))
      `).run(uuidv4(), roomId, qrToken, qrDataUrl);
    })();

    recordAuditLog({
      hotelId: hotel.id,
      userId: req.user?.id,
      userName: req.user?.full_name,
      action: 'ROOM_CREATED',
      entity: 'room',
      entityId: roomId,
      details: { room_number, name, buildingId, floorId }
    });

    res.status(201).json({ success: true, roomId, qrToken, buildingId, floorId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/rooms/:id - Update room
router.put('/:id', authenticateToken, requireRole(['Hotel Admin', 'Super Admin', 'Front Office Staff']), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { room_number, name, room_type_id, room_status, occupancy_status, room_image, notes } = req.body;
    const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;

    const rawBuilding = req.body.building_id || req.body.building_name || req.body.building;
    const rawFloor = req.body.floor_id || req.body.floor_name || req.body.floor;
    const { buildingId, floorId } = resolveBuildingAndFloor(hotel.id, rawBuilding, rawFloor);

    db.prepare(`
      UPDATE rooms
      SET room_number = ?, name = ?, room_type_id = ?, building_id = ?, floor_id = ?,
          room_status = ?, occupancy_status = ?, room_image = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      room_number, name, room_type_id, buildingId || null, floorId || null,
      room_status, occupancy_status, room_image, notes, id
    );

    recordAuditLog({
      hotelId: req.user?.hotel_id || 'hotel-ocean-pearl',
      userId: req.user?.id,
      userName: req.user?.full_name,
      action: 'ROOM_UPDATED',
      entity: 'room',
      entityId: id,
      details: { room_number, room_status, occupancy_status, buildingId, floorId }
    });

    res.json({ success: true, message: 'Room updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rooms/:id/regenerate-qr - Invalidate old token and create a brand new secure token
router.post('/:id/regenerate-qr', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const newToken = QRCodeService.generateSecureToken();
    const newQrDataUrl = await QRCodeService.generateDataUrl(newToken);

    db.transaction(() => {
      db.prepare(`UPDATE rooms SET qr_token = ? WHERE id = ?`).run(newToken, id);
      db.prepare(`
        UPDATE qr_codes
        SET token = ?, qr_data_url = ?, scans_count = 0, is_active = 1, created_at = datetime('now')
        WHERE room_id = ?
      `).run(newToken, newQrDataUrl, id);
    })();

    recordAuditLog({
      hotelId: req.user?.hotel_id || 'hotel-ocean-pearl',
      userId: req.user?.id,
      userName: req.user?.full_name,
      action: 'QR_REGENERATED',
      entity: 'room',
      entityId: id,
      details: { newToken }
    });

    res.json({ success: true, qrToken: newToken, qrDataUrl: newQrDataUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rooms/:id/toggle-qr - Enable / disable QR token
router.post('/:id/toggle-qr', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const current = db.prepare(`SELECT is_active FROM qr_codes WHERE room_id = ?`).get(id) as any;
    if (!current) {
      return res.status(404).json({ error: 'QR record not found.' });
    }

    const nextState = current.is_active === 1 ? 0 : 1;
    db.prepare(`UPDATE qr_codes SET is_active = ? WHERE room_id = ?`).run(nextState, id);

    res.json({ success: true, is_active: nextState });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/rooms/:id
router.delete('/:id', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const room = db.prepare(`SELECT * FROM rooms WHERE id = ?`).get(id) as any;
    if (!room) return res.status(404).json({ error: 'Room not found.' });

    db.transaction(() => {
      // 1. Clean up maintenance requests and children
      const mReqs = db.prepare(`SELECT id FROM maintenance_requests WHERE room_id = ?`).all(id) as any[];
      for (const req of mReqs) {
        db.prepare(`DELETE FROM maintenance_request_items WHERE request_id = ?`).run(req.id);
        db.prepare(`DELETE FROM staff_assignments WHERE request_id = ?`).run(req.id);
        db.prepare(`DELETE FROM request_status_history WHERE request_id = ?`).run(req.id);
        db.prepare(`DELETE FROM job_tokens WHERE request_id = ?`).run(req.id);
      }
      db.prepare(`DELETE FROM maintenance_requests WHERE room_id = ?`).run(id);

      // 2. Clean up guest service requests
      const sReqs = db.prepare(`SELECT id FROM guest_service_requests WHERE room_id = ?`).all(id) as any[];
      for (const req of sReqs) {
        db.prepare(`DELETE FROM job_tokens WHERE request_id = ?`).run(req.id);
      }
      db.prepare(`DELETE FROM guest_service_requests WHERE room_id = ?`).run(id);

      // 3. Clean up tips
      const rTips = db.prepare(`SELECT id FROM tips WHERE room_id = ?`).all(id) as any[];
      for (const tip of rTips) {
        db.prepare(`DELETE FROM tip_distributions WHERE tip_id = ?`).run(tip.id);
        db.prepare(`DELETE FROM payments WHERE tip_id = ?`).run(tip.id);
      }
      db.prepare(`DELETE FROM tips WHERE room_id = ?`).run(id);

      // 4. QR codes & item assignments
      if (room.qr_token) {
        db.prepare(`DELETE FROM qr_codes WHERE token = ?`).run(room.qr_token);
      }
      db.prepare(`DELETE FROM qr_codes WHERE room_id = ?`).run(id);
      db.prepare(`DELETE FROM room_item_assignments WHERE room_id = ?`).run(id);
      db.prepare(`DELETE FROM job_tokens WHERE room_id = ?`).run(id);
      db.prepare(`DELETE FROM rooms WHERE id = ?`).run(id);
    })();

    recordAuditLog({
      hotelId: room.hotel_id,
      userId: req.user?.id,
      userName: req.user?.full_name,
      action: 'ROOM_DELETED',
      entity: 'rooms',
      entityId: id,
      details: { roomNumber: room.room_number }
    });

    res.json({ success: true, message: `Room ${room.room_number} deleted successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
