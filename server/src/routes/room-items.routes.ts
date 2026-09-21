import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/room-items - Master catalog of items
router.get('/', (req, res: Response) => {
  try {
    const items = db.prepare(`
      SELECT ri.*,
             (SELECT COUNT(*) FROM room_item_assignments WHERE room_item_id = ri.id) as assigned_rooms_count,
             (SELECT COUNT(*) FROM room_item_assignments WHERE room_item_id = ri.id AND condition_status != 'Working') as maintenance_needed_count
      FROM room_items ri
      ORDER BY ri.category, ri.name ASC
    `).all();
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/room-items - Add custom item to catalog
router.post('/', authenticateToken, requireRole(['Hotel Admin', 'Super Admin', 'Maintenance Manager']), (req: AuthRequest, res: Response) => {
  try {
    const { name, category, icon, default_description } = req.body;
    const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;
    const id = `item-${uuidv4().substring(0, 8)}`;

    db.prepare(`
      INSERT INTO room_items (id, hotel_id, name, category, icon, default_description)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, hotel.id, name, category, icon || 'wrench', default_description || '');

    const created = db.prepare(`SELECT * FROM room_items WHERE id = ?`).get(id);
    res.status(201).json({ item: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/room-items/:id - Update catalog item
router.put('/:id', authenticateToken, requireRole(['Hotel Admin', 'Super Admin', 'Maintenance Manager']), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, category, icon, default_description } = req.body;

    db.prepare(`
      UPDATE room_items
      SET name = ?, category = ?, icon = ?, default_description = ?
      WHERE id = ?
    `).run(name, category, icon, default_description, id);

    const updated = db.prepare(`SELECT * FROM room_items WHERE id = ?`).get(id);
    res.json({ item: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/room-items/:id - Delete catalog item safely
router.delete('/:id', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const item = db.prepare(`SELECT * FROM room_items WHERE id = ?`).get(id) as any;
    if (!item) return res.status(404).json({ error: 'Item not found in catalog.' });

    db.transaction(() => {
      // Find all room assignments of this catalog item
      const assignments = db.prepare(`SELECT id FROM room_item_assignments WHERE room_item_id = ?`).all(id) as any[];
      for (const a of assignments) {
        db.prepare(`UPDATE maintenance_request_items SET room_item_assignment_id = NULL WHERE room_item_assignment_id = ?`).run(a.id);
      }
      db.prepare(`DELETE FROM room_item_assignments WHERE room_item_id = ?`).run(id);
      db.prepare(`DELETE FROM room_items WHERE id = ?`).run(id);
    })();

    res.json({ success: true, message: `Equipment "${item.name}" deleted from master catalog.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/room-items/assign - Assign an item to a specific room
router.post('/assign', authenticateToken, requireRole(['Hotel Admin', 'Super Admin', 'Front Office Staff', 'Maintenance Manager']), (req: AuthRequest, res: Response) => {
  try {
    const { room_id, room_item_id, condition_status, serial_number, install_date, warranty_date, notes } = req.body;

    // Check if room and item exist
    const room = db.prepare(`SELECT id FROM rooms WHERE id = ?`).get(room_id);
    const item = db.prepare(`SELECT id FROM room_items WHERE id = ?`).get(room_item_id);

    if (!room || !item) {
      return res.status(404).json({ error: 'Room or Item catalog entry not found.' });
    }

    const assignmentId = uuidv4();
    db.prepare(`
      INSERT INTO room_item_assignments (
        id, room_id, room_item_id, condition_status, serial_number,
        install_date, warranty_date, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      assignmentId, room_id, room_item_id, condition_status || 'Working',
      serial_number || '', install_date || null, warranty_date || null, notes || ''
    );

    res.status(201).json({ success: true, assignmentId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/room-items/assignments/:id - Update item condition status, notes, warranty
router.put('/assignments/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { condition_status, serial_number, install_date, warranty_date, last_maintenance_date, next_maintenance_date, notes, photos_json } = req.body;

    db.prepare(`
      UPDATE room_item_assignments
      SET condition_status = ?, serial_number = ?, install_date = ?, warranty_date = ?,
          last_maintenance_date = ?, next_maintenance_date = ?, notes = ?, photos_json = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      condition_status, serial_number, install_date, warranty_date,
      last_maintenance_date, next_maintenance_date, notes,
      photos_json ? (typeof photos_json === 'string' ? photos_json : JSON.stringify(photos_json)) : '[]',
      id
    );

    res.json({ success: true, message: 'Item condition updated.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/room-items/assignments/:id - Unassign item from room
router.delete('/assignments/:id', authenticateToken, requireRole(['Hotel Admin', 'Super Admin', 'Maintenance Manager']), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    db.prepare(`DELETE FROM room_item_assignments WHERE id = ?`).run(id);
    res.json({ success: true, message: 'Item removed from room.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
