import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { recordAuditLog } from '../middleware/audit';

const router = Router();

// GET /api/room-types
router.get('/', (req, res: Response) => {
  const roomTypes = db.prepare(`SELECT * FROM room_types ORDER BY name ASC`).all();
  res.json({ roomTypes });
});

// POST /api/room-types
router.post('/', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), (req: AuthRequest, res: Response) => {
  try {
    const { name, code, description, max_guests, bed_count, bed_type, room_size_sqm, base_price, image_url, status } = req.body;
    const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;
    const id = `rt-${uuidv4().substring(0, 8)}`;

    db.prepare(`
      INSERT INTO room_types (
        id, hotel_id, name, code, description, max_guests, bed_count,
        bed_type, room_size_sqm, base_price, image_url, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, hotel.id, name, code, description || '', max_guests || 2,
      bed_count || 1, bed_type || 'King', room_size_sqm || 30,
      base_price || 150, image_url || '', status || 'active'
    );

    recordAuditLog({
      hotelId: hotel.id,
      userId: req.user?.id,
      userName: req.user?.full_name,
      action: 'ROOM_TYPE_CREATED',
      entity: 'room_type',
      entityId: id,
      details: { name, code }
    });

    const created = db.prepare(`SELECT * FROM room_types WHERE id = ?`).get(id);
    res.status(201).json({ roomType: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/room-types/:id
router.put('/:id', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, description, max_guests, bed_count, bed_type, room_size_sqm, base_price, image_url, status } = req.body;

    db.prepare(`
      UPDATE room_types
      SET name = ?, code = ?, description = ?, max_guests = ?, bed_count = ?,
          bed_type = ?, room_size_sqm = ?, base_price = ?, image_url = ?, status = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name, code, description, max_guests, bed_count,
      bed_type, room_size_sqm, base_price, image_url, status, id
    );

    const updated = db.prepare(`SELECT * FROM room_types WHERE id = ?`).get(id);
    res.json({ roomType: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/room-types/:id
router.delete('/:id', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    // Check if rooms exist with this type
    const roomCount = db.prepare(`SELECT COUNT(*) as count FROM rooms WHERE room_type_id = ?`).get(id) as any;
    if (roomCount.count > 0) {
      return res.status(400).json({
        error: `Cannot delete room type: ${roomCount.count} rooms are assigned to it. Please reassign or deactivate the room type instead.`
      });
    }

    db.prepare(`DELETE FROM room_types WHERE id = ?`).run(id);
    res.json({ success: true, message: 'Room type deleted.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
