import { Router, Response } from 'express';
import { db } from '../db/database';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/tips - List all tips for management
router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { status, staff_id, date, room_number } = req.query;

    let query = `
      SELECT t.*,
             r.room_number,
             u.full_name as staff_name,
             sp.job_title as staff_title,
             sp.department as staff_department,
             p.transaction_id, p.provider as payment_provider, p.status as payment_status,
             td.staff_amount, td.hotel_pool_amount, td.distribution_rule
      FROM tips t
      JOIN rooms r ON t.room_id = r.id
      JOIN staff_profiles sp ON t.staff_id = sp.id
      JOIN users u ON sp.user_id = u.id
      LEFT JOIN payments p ON p.tip_id = t.id
      LEFT JOIN tip_distributions td ON td.tip_id = t.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      query += ` AND t.status = ?`;
      params.push(status);
    }
    if (staff_id) {
      query += ` AND t.staff_id = ?`;
      params.push(staff_id);
    }
    if (date) {
      query += ` AND date(t.created_at) = date(?)`;
      params.push(date);
    }
    if (room_number) {
      query += ` AND r.room_number = ?`;
      params.push(room_number);
    }

    query += ` ORDER BY t.created_at DESC`;

    const tips = db.prepare(query).all(...params);
    res.json({ tips });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tips/summary - Summary statistics
router.get('/summary', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const totalTips = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM tips WHERE status = 'Paid'`).get() as any;
    const pendingTips = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM tips WHERE status = 'Pending'`).get() as any;
    const failedTips = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM tips WHERE status = 'Failed'`).get() as any;
    const hotelPoolTotal = db.prepare(`SELECT COALESCE(SUM(hotel_pool_amount), 0) as total FROM tip_distributions`).get() as any;
    const staffPoolTotal = db.prepare(`SELECT COALESCE(SUM(staff_amount), 0) as total FROM tip_distributions`).get() as any;

    res.json({
      paid: { total: totalTips.total, count: totalTips.count },
      pending: { total: pendingTips.total, count: pendingTips.count },
      failed: { total: failedTips.total, count: failedTips.count },
      staffDisbursed: staffPoolTotal.total,
      hotelPoolRetained: hotelPoolTotal.total
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tips/distribution-settings - Update tip distribution rules
router.put('/distribution-settings', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), (req: AuthRequest, res: Response) => {
  try {
    const { rule, staffPercent, hotelPoolPercent, presets, allowCustom } = req.body;
    const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;

    const value = {
      rule: rule || '100_staff',
      staffPercent: staffPercent !== undefined ? Number(staffPercent) : 100,
      hotelPoolPercent: hotelPoolPercent !== undefined ? Number(hotelPoolPercent) : 0,
      presets: presets || [5, 10, 20, 50],
      allowCustom: allowCustom !== undefined ? !!allowCustom : true
    };

    db.prepare(`
      INSERT INTO settings (id, hotel_id, category, key, value_json, updated_at)
      VALUES (?, ?, 'tips', 'distribution', ?, datetime('now'))
      ON CONFLICT(hotel_id, category, key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = datetime('now')
    `).run(`set-tip-${hotel.id}`, hotel.id, JSON.stringify(value));

    res.json({ success: true, settings: value });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tips/:id - Securely delete / void tip transaction
router.delete('/:id', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tip = db.prepare(`SELECT * FROM tips WHERE id = ?`).get(id) as any;
    if (!tip) return res.status(404).json({ error: 'Tip record not found.' });

    db.transaction(() => {
      db.prepare(`DELETE FROM tip_distributions WHERE tip_id = ?`).run(id);
      db.prepare(`DELETE FROM payments WHERE tip_id = ?`).run(id);
      db.prepare(`DELETE FROM tips WHERE id = ?`).run(id);
    })();

    res.json({ success: true, message: 'Tip record deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
