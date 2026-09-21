import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/database';
import { generateToken, authenticateToken, AuthRequest } from '../middleware/auth';
import { recordAuditLog } from '../middleware/audit';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = db.prepare(`
      SELECT u.id, u.hotel_id, u.email, u.password_hash, u.full_name, u.role, u.status,
             sp.id as staff_id, sp.department, sp.job_title, sp.avatar_url
      FROM users u
      LEFT JOIN staff_profiles sp ON sp.user_id = u.id
      WHERE u.email = ?
    `).get(email) as any;

    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken({
      id: user.id,
      hotel_id: user.hotel_id,
      email: user.email,
      role: user.role,
      full_name: user.full_name
    });

    recordAuditLog({
      hotelId: user.hotel_id,
      userId: user.id,
      userName: user.full_name,
      action: 'USER_LOGIN',
      entity: 'auth',
      entityId: user.id,
      details: { role: user.role }
    });

    res.json({
      token,
      user: {
        id: user.id,
        hotel_id: user.hotel_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        staff_id: user.staff_id,
        department: user.department,
        job_title: user.job_title,
        avatar_url: user.avatar_url
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login failed.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const user = db.prepare(`
      SELECT u.id, u.hotel_id, u.email, u.full_name, u.role, u.status, u.phone,
             sp.id as staff_id, sp.employee_id, sp.department, sp.job_title, sp.avatar_url, sp.rating
      FROM users u
      LEFT JOIN staff_profiles sp ON sp.user_id = u.id
      WHERE u.id = ?
    `).get(req.user!.id) as any;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch user' });
  }
});

export default router;
