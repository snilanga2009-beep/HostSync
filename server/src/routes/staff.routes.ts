import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { db } from '../db/database';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { recordAuditLog } from '../middleware/audit';

const router = Router();

// Helper to query single staff
function getStaffMember(staffId: string) {
  return db.prepare(`
    SELECT sp.*, u.full_name, u.email, u.role, u.status as user_status,
           (SELECT COUNT(*) FROM staff_assignments sa WHERE sa.staff_id = sp.id AND sa.status IN ('Assigned', 'Accepted', 'In Progress')) as active_tasks_count,
           (SELECT COALESCE(SUM(td.staff_amount), 0) FROM tip_distributions td WHERE td.staff_id = sp.id) as total_tips_earned
    FROM staff_profiles sp
    JOIN users u ON sp.user_id = u.id
    WHERE sp.id = ?
  `).get(staffId) as any;
}

// GET /api/staff - List all staff
router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { department, status } = req.query;

    let query = `
      SELECT sp.*, u.full_name, u.email, u.role, u.status as user_status,
             (SELECT COUNT(*) FROM staff_assignments sa WHERE sa.staff_id = sp.id AND sa.status IN ('Assigned', 'Accepted', 'In Progress')) as active_tasks_count,
             (SELECT COALESCE(SUM(td.staff_amount), 0) FROM tip_distributions td WHERE td.staff_id = sp.id) as total_tips_earned
      FROM staff_profiles sp
      JOIN users u ON sp.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (department) {
      query += ` AND sp.department = ?`;
      params.push(department);
    }
    if (status) {
      query += ` AND sp.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY u.full_name ASC`;

    const staff = db.prepare(query).all(...params);
    res.json({ staff });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/staff/:id - Single staff member
router.get('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const staff = getStaffMember(req.params.id);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    res.json({ staff });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/staff/:id/tasks - Get tasks assigned to specific staff member (Technician mobile dashboard)
router.get('/:id/tasks', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const tasks = db.prepare(`
      SELECT mr.*,
             r.room_number, r.name as room_name,
             b.name as building_name,
             f.name as floor_name,
             sa.id as assignment_id, sa.status as assignment_status, sa.assigned_at,
             (SELECT u.full_name FROM users u WHERE u.id = sa.assigned_by_user_id) as assigned_by_name,
             (SELECT GROUP_CONCAT(mri.item_name || ' (' || mri.problem_type || ')', ', ')
              FROM maintenance_request_items mri WHERE mri.request_id = mr.id) as items_summary
      FROM staff_assignments sa
      JOIN maintenance_requests mr ON sa.request_id = mr.id
      JOIN rooms r ON mr.room_id = r.id
      LEFT JOIN buildings b ON r.building_id = b.id
      LEFT JOIN floors f ON r.floor_id = f.id
      WHERE sa.staff_id = ?
      ORDER BY
        CASE mr.priority
          WHEN 'Emergency' THEN 1
          WHEN 'High' THEN 2
          ELSE 3
        END,
        mr.created_at DESC
    `).all(id);

    res.json({ tasks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/staff/:id/tips - Tip earnings summary & history
router.get('/:id/tips', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Aggregates
    const todayRow = db.prepare(`
      SELECT COALESCE(SUM(td.staff_amount), 0) as total
      FROM tip_distributions td
      JOIN tips t ON td.tip_id = t.id
      WHERE td.staff_id = ? AND t.status = 'Paid' AND date(t.created_at) = date('now')
    `).get(id) as any;

    const weekRow = db.prepare(`
      SELECT COALESCE(SUM(td.staff_amount), 0) as total
      FROM tip_distributions td
      JOIN tips t ON td.tip_id = t.id
      WHERE td.staff_id = ? AND t.status = 'Paid' AND date(t.created_at) >= date('now', '-7 days')
    `).get(id) as any;

    const monthRow = db.prepare(`
      SELECT COALESCE(SUM(td.staff_amount), 0) as total
      FROM tip_distributions td
      JOIN tips t ON td.tip_id = t.id
      WHERE td.staff_id = ? AND t.status = 'Paid' AND strftime('%Y-%m', t.created_at) = strftime('%Y-%m', 'now')
    `).get(id) as any;

    const totalRow = db.prepare(`
      SELECT COALESCE(SUM(td.staff_amount), 0) as total
      FROM tip_distributions td
      JOIN tips t ON td.tip_id = t.id
      WHERE td.staff_id = ? AND t.status = 'Paid'
    `).get(id) as any;

    // Transactions list
    const transactions = db.prepare(`
      SELECT t.*, td.staff_amount, td.hotel_pool_amount,
             r.room_number, mr.request_code
      FROM tips t
      JOIN tip_distributions td ON td.tip_id = t.id
      JOIN rooms r ON t.room_id = r.id
      LEFT JOIN maintenance_requests mr ON t.request_id = mr.id
      WHERE td.staff_id = ?
      ORDER BY t.created_at DESC
    `).all(id);

    res.json({
      summary: {
        today: todayRow.total,
        week: weekRow.total,
        month: monthRow.total,
        total: totalRow.total
      },
      transactions
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/staff - Add new staff member
router.post('/', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), async (req: AuthRequest, res: Response) => {
  try {
    const {
      full_name,
      email,
      password,
      role,
      department,
      job_title,
      phone,
      country_code,
      whatsapp_number,
      preferred_channel,
      sms_enabled,
      whatsapp_enabled,
      fallback_enabled,
      pin_code,
      skills,
      working_hours,
      avatar_url
    } = req.body;

    if (!full_name || !email) {
      return res.status(400).json({ error: 'Full name and email are required.' });
    }

    const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;
    if (!hotel) {
      return res.status(400).json({ error: 'Hotel context not found.' });
    }

    const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists.' });
    }

    const userId = `usr-${uuidv4().substring(0, 8)}`;
    const empId = `EMP-${Math.floor(100 + Math.random() * 900)}`;
    const staffId = `staff-${empId.toLowerCase()}`;
    const passwordHash = await bcrypt.hash(password || 'password123', 10);

    db.transaction(() => {
      db.prepare(`
        INSERT INTO users (id, hotel_id, email, password_hash, full_name, role, status, phone)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
      `).run(userId, hotel.id, email, passwordHash, full_name, role || 'Technician', phone || '');

      db.prepare(`
        INSERT INTO staff_profiles (
          id, user_id, employee_id, department, job_title, phone, country_code,
          whatsapp_number, preferred_channel, sms_enabled, whatsapp_enabled,
          fallback_enabled, pin_code, skills_json, avatar_url, status, working_hours, rating
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, 5.0)
      `).run(
        staffId, userId, empId, department || 'Maintenance', job_title || 'Staff',
        phone || '', country_code || '+1',
        whatsapp_number || phone || '', preferred_channel || 'whatsapp',
        sms_enabled !== undefined ? (sms_enabled ? 1 : 0) : 1,
        whatsapp_enabled !== undefined ? (whatsapp_enabled ? 1 : 0) : 1,
        fallback_enabled !== undefined ? (fallback_enabled ? 1 : 0) : 1,
        pin_code || '1234',
        skills ? JSON.stringify(skills) : '[]', avatar_url || '',
        working_hours || '08:00 - 17:00'
      );
    })();

    recordAuditLog({
      hotelId: hotel.id,
      userId: req.user?.id,
      userName: req.user?.full_name,
      action: 'STAFF_CREATED',
      entity: 'staff_profiles',
      entityId: staffId,
      details: { full_name, email, role, department, employee_id: empId }
    });

    res.status(201).json({ success: true, staffId, employeeId: empId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/staff/:id - Update staff profile
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = getStaffMember(id);
    if (!existing) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Permission check: Admin or the user themselves
    const isAdmin = ['Super Admin', 'Hotel Admin', 'Front Office Staff'].includes(req.user?.role || '');
    const isSelf = req.user?.id === existing.user_id || req.user?.staff_id === id;
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: 'Unauthorized to update this staff member profile.' });
    }

    const {
      full_name,
      email,
      role,
      department,
      job_title,
      phone,
      country_code,
      whatsapp_number,
      preferred_channel,
      sms_enabled,
      whatsapp_enabled,
      fallback_enabled,
      pin_code,
      skills,
      working_hours,
      avatar_url,
      status
    } = req.body;

    db.transaction(() => {
      // Update users table
      db.prepare(`
        UPDATE users
        SET full_name = COALESCE(?, full_name),
            email = COALESCE(?, email),
            role = COALESCE(?, role),
            phone = COALESCE(?, phone),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        full_name ?? null,
        email ?? null,
        isAdmin ? (role ?? null) : null, // only admin can change role
        phone ?? null,
        existing.user_id
      );

      // Update staff_profiles table
      db.prepare(`
        UPDATE staff_profiles
        SET department = COALESCE(?, department),
            job_title = COALESCE(?, job_title),
            phone = COALESCE(?, phone),
            country_code = COALESCE(?, country_code),
            whatsapp_number = COALESCE(?, whatsapp_number),
            preferred_channel = COALESCE(?, preferred_channel),
            sms_enabled = COALESCE(?, sms_enabled),
            whatsapp_enabled = COALESCE(?, whatsapp_enabled),
            fallback_enabled = COALESCE(?, fallback_enabled),
            pin_code = COALESCE(?, pin_code),
            skills_json = COALESCE(?, skills_json),
            avatar_url = COALESCE(?, avatar_url),
            status = COALESCE(?, status),
            working_hours = COALESCE(?, working_hours),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        department ?? null,
        job_title ?? null,
        phone ?? null,
        country_code ?? null,
        whatsapp_number ?? null,
        preferred_channel ?? null,
        sms_enabled !== undefined ? (sms_enabled ? 1 : 0) : null,
        whatsapp_enabled !== undefined ? (whatsapp_enabled ? 1 : 0) : null,
        fallback_enabled !== undefined ? (fallback_enabled ? 1 : 0) : null,
        pin_code ?? null,
        skills !== undefined ? (typeof skills === 'string' ? skills : JSON.stringify(skills)) : null,
        avatar_url ?? null,
        status ?? null,
        working_hours ?? null,
        id
      );
    })();

    const updated = getStaffMember(id);

    const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;
    recordAuditLog({
      hotelId: hotel?.id || 'hotel-ocean-pearl',
      userId: req.user?.id,
      userName: req.user?.full_name,
      action: 'STAFF_PROFILE_UPDATED',
      entity: 'staff_profiles',
      entityId: id,
      details: { full_name: updated.full_name, avatar_url: updated.avatar_url, department: updated.department }
    });

    res.json({ success: true, staff: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/staff/:id/avatar - Upload profile image or update avatar URL
router.post('/:id/avatar', authenticateToken, upload.single('photo'), (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const existing = getStaffMember(id);
    if (!existing) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const isAdmin = ['Super Admin', 'Hotel Admin', 'Front Office Staff'].includes(req.user?.role || '');
    const isSelf = req.user?.id === existing.user_id || req.user?.staff_id === id;
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: 'Unauthorized to update avatar' });
    }

    let avatarUrl = '';
    if (req.file) {
      avatarUrl = `/uploads/${req.file.filename}`;

      // Also register file in file_uploads
      const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;
      db.prepare(`
        INSERT INTO file_uploads (
          id, hotel_id, original_name, stored_filename, file_path, file_size, mime_type, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        uuidv4(),
        hotel?.id || 'hotel-ocean-pearl',
        req.file.originalname,
        req.file.filename,
        req.file.path,
        req.file.size,
        req.file.mimetype
      );
    } else if (req.body?.avatar_url) {
      avatarUrl = req.body.avatar_url;
    } else {
      return res.status(400).json({ error: 'No image file or avatar_url provided.' });
    }

    // Update staff profile avatar_url
    db.prepare(`
      UPDATE staff_profiles
      SET avatar_url = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(avatarUrl, id);

    const updated = getStaffMember(id);

    const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;
    recordAuditLog({
      hotelId: hotel?.id || 'hotel-ocean-pearl',
      userId: req.user?.id,
      userName: req.user?.full_name,
      action: 'STAFF_AVATAR_UPDATED',
      entity: 'staff_profiles',
      entityId: id,
      details: { employee_id: existing.employee_id, avatar_url: avatarUrl }
    });

    res.json({
      success: true,
      avatar_url: avatarUrl,
      staff: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update avatar' });
  }
});

// PATCH /api/staff/:id/status - Quick toggle status (available, busy, off_duty)
router.patch('/:id/status', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['available', 'busy', 'off_duty'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be available, busy, or off_duty' });
    }

    db.prepare(`
      UPDATE staff_profiles
      SET status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, id);

    const updated = getStaffMember(id);
    res.json({ success: true, status, staff: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/staff/:id - Securely delete staff profile
router.delete('/:id', authenticateToken, requireRole(['Hotel Admin', 'Super Admin']), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const staff = db.prepare(`SELECT sp.*, u.full_name FROM staff_profiles sp JOIN users u ON sp.user_id = u.id WHERE sp.id = ?`).get(id) as any;
    if (!staff) return res.status(404).json({ error: 'Staff member not found.' });

    db.transaction(() => {
      const staffTips = db.prepare(`SELECT id FROM tips WHERE staff_id = ?`).all(id) as any[];
      for (const t of staffTips) {
        db.prepare(`DELETE FROM tip_distributions WHERE tip_id = ?`).run(t.id);
        db.prepare(`DELETE FROM payments WHERE tip_id = ?`).run(t.id);
      }
      db.prepare(`DELETE FROM tip_distributions WHERE staff_id = ?`).run(id);
      db.prepare(`DELETE FROM tips WHERE staff_id = ?`).run(id);
      db.prepare(`DELETE FROM staff_assignments WHERE staff_id = ?`).run(id);
      db.prepare(`DELETE FROM job_tokens WHERE staff_id = ?`).run(id);
      db.prepare(`DELETE FROM staff_profiles WHERE id = ?`).run(id);
    })();

    const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;
    recordAuditLog({
      hotelId: hotel?.id || 'hotel-ocean-pearl',
      userId: req.user?.id,
      userName: req.user?.full_name,
      action: 'STAFF_DELETED',
      entity: 'staff_profiles',
      entityId: id,
      details: { staffName: staff.full_name, employeeId: staff.employee_id }
    });

    res.json({ success: true, message: `Staff profile for ${staff.full_name} deleted successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

