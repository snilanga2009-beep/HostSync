import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { recordAuditLog } from '../middleware/audit';

const router = Router();

// GET /api/users - List all users in the hotel
router.get('/', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), (req: AuthRequest, res: Response) => {
  try {
    const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;
    const hotelId = hotel?.id || 'hotel-ocean-pearl';

    const users = db.prepare(`
      SELECT u.id, u.hotel_id, u.email, u.full_name, u.role, u.status, u.phone, u.created_at,
             sp.id as staff_id, sp.employee_id, sp.department, sp.job_title, sp.avatar_url, sp.rating
      FROM users u
      LEFT JOIN staff_profiles sp ON sp.user_id = u.id
      WHERE u.hotel_id = ?
      ORDER BY u.created_at DESC
    `).all(hotelId);

    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users - Create a new user (Admin, Front Office, etc.)
router.post('/', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { full_name, email, password, role, phone, department, job_title } = req.body;

    if (!full_name || !email || !password || !role) {
      return res.status(400).json({ error: 'Full name, email, password, and role are required.' });
    }

    const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;
    const hotelId = hotel?.id || 'hotel-ocean-pearl';

    const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
    if (existing) {
      return res.status(400).json({ error: 'A user with this email address already exists.' });
    }

    const userId = `usr-${uuidv4().substring(0, 8)}`;
    const passwordHash = await bcrypt.hash(password, 10);
    const empId = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
    const staffId = `staff-${empId.toLowerCase()}`;

    // Determine default department based on role
    let dept = department;
    let title = job_title;
    if (!dept) {
      if (role === 'Front Office Staff') dept = 'Front Desk';
      else if (role === 'Hotel Admin' || role === 'Super Admin') dept = 'Administration';
      else if (role === 'Maintenance Manager' || role === 'Technician') dept = 'Maintenance';
      else if (role === 'Housekeeping Staff') dept = 'Housekeeping';
      else if (role === 'Room Service Boy') dept = 'Room Service';
      else dept = 'Front Desk';
    }
    if (!title) {
      if (role === 'Front Office Staff') title = 'Front Desk Executive';
      else if (role === 'Hotel Admin') title = 'Hotel Operations Admin';
      else if (role === 'Super Admin') title = 'System Administrator';
      else title = role;
    }

    db.transaction(() => {
      // 1. Insert User
      db.prepare(`
        INSERT INTO users (id, hotel_id, email, password_hash, full_name, role, status, phone, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?, datetime('now'), datetime('now'))
      `).run(userId, hotelId, email, passwordHash, full_name, role, phone || '');

      // 2. Create Staff Profile
      db.prepare(`
        INSERT INTO staff_profiles (
          id, user_id, employee_id, department, job_title, phone, country_code,
          whatsapp_number, preferred_channel, sms_enabled, whatsapp_enabled,
          fallback_enabled, pin_code, skills_json, avatar_url, status, working_hours, rating, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, '+1',
          ?, 'whatsapp', 1, 1,
          1, '1234', '[]', '', 'available', '08:00 - 17:00', 5.0, datetime('now'), datetime('now')
        )
      `).run(staffId, userId, empId, dept, title, phone || '', phone || '');
    })();

    recordAuditLog({
      hotelId,
      userId: req.user?.id,
      userName: req.user?.full_name,
      action: 'USER_CREATED',
      entity: 'users',
      entityId: userId,
      details: { email, full_name, role, department: dept }
    });

    res.status(201).json({
      success: true,
      user: {
        id: userId,
        email,
        full_name,
        role,
        department: dept,
        job_title: title,
        employee_id: empId
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id/status - Toggle status
router.put('/:id/status', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Status must be active or inactive.' });
    }

    if (id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own user account.' });
    }

    db.prepare(`UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id);

    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id/reset-password - Admin reset user password
router.put('/:id/reset-password', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(passwordHash, id);

    res.json({ success: true, message: 'Password reset successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot delete your own user account.' });
    }

    db.transaction(() => {
      db.prepare(`DELETE FROM staff_profiles WHERE user_id = ?`).run(id);
      db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
    })();

    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
