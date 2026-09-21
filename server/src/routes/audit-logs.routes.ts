import { Router, Response } from 'express';
import { db } from '../db/database';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/audit-logs - View audit trail
router.get('/', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), (req: AuthRequest, res: Response) => {
  try {
    const { action, entity, search } = req.query;

    let query = `SELECT * FROM audit_logs WHERE 1=1`;
    const params: any[] = [];

    if (action) {
      query += ` AND action = ?`;
      params.push(action);
    }
    if (entity) {
      query += ` AND entity = ?`;
      params.push(entity);
    }
    if (search) {
      query += ` AND (action LIKE ? OR entity LIKE ? OR user_name LIKE ? OR details_json LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT 100`;

    const logs = db.prepare(query).all(...params);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
