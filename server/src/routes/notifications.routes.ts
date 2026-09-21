import { Router, Response } from 'express';
import { db } from '../db/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/notifications - List user's notifications
router.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const notifications = db.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ? OR target_role = ? OR target_role = 'All'
      ORDER BY created_at DESC
      LIMIT 30
    `).all(userId, userRole);

    const unreadCount = db.prepare(`
      SELECT COUNT(*) as count FROM notifications
      WHERE (user_id = ? OR target_role = ? OR target_role = 'All') AND is_read = 0
    `).get(userId, userRole) as any;

    res.json({ notifications, unreadCount: unreadCount.count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ?`).run(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/mark-all-read
router.put('/read/all', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    db.prepare(`
      UPDATE notifications SET is_read = 1
      WHERE user_id = ? OR target_role = ? OR target_role = 'All'
    `).run(userId, userRole);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/center/stats - Summary metrics for Notification Center
router.get('/center/stats', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const totalRow = db.prepare(`SELECT COUNT(*) as count FROM notification_logs`).get() as any;
    const smsRow = db.prepare(`SELECT COUNT(*) as count FROM notification_logs WHERE channel = 'SMS'`).get() as any;
    const waRow = db.prepare(`SELECT COUNT(*) as count FROM notification_logs WHERE channel = 'WhatsApp'`).get() as any;
    const deliveredRow = db.prepare(`SELECT COUNT(*) as count FROM notification_logs WHERE status IN ('DELIVERED', 'READ')`).get() as any;
    const failedRow = db.prepare(`SELECT COUNT(*) as count FROM notification_logs WHERE status = 'FAILED'`).get() as any;
    const fallbackRow = db.prepare(`SELECT COUNT(*) as count FROM notification_logs WHERE fallback_used = 1`).get() as any;

    res.json({
      stats: {
        total: totalRow?.count || 0,
        smsSent: smsRow?.count || 0,
        whatsappSent: waRow?.count || 0,
        delivered: deliveredRow?.count || 0,
        failed: failedRow?.count || 0,
        fallbackUsed: fallbackRow?.count || 0
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications/center/logs - Filterable notification delivery logs
router.get('/center/logs', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { channel, status, staff_id, date, limit = '50' } = req.query;

    let query = `
      SELECT nl.*,
             u.full_name as staff_name,
             sp.job_title,
             mr.request_code,
             r.room_number
      FROM notification_logs nl
      LEFT JOIN staff_profiles sp ON nl.staff_id = sp.id
      LEFT JOIN users u ON sp.user_id = u.id
      LEFT JOIN maintenance_requests mr ON nl.job_id = mr.id
      LEFT JOIN rooms r ON mr.room_id = r.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (channel && channel !== 'All') {
      query += ` AND nl.channel = ?`;
      params.push(channel);
    }
    if (status && status !== 'All') {
      query += ` AND nl.status = ?`;
      params.push(status);
    }
    if (staff_id && staff_id !== 'All') {
      query += ` AND nl.staff_id = ?`;
      params.push(staff_id);
    }
    if (date) {
      query += ` AND date(nl.created_at) = date(?)`;
      params.push(date);
    }

    query += ` ORDER BY nl.created_at DESC LIMIT ?`;
    params.push(parseInt(limit as string, 10) || 50);

    const logs = db.prepare(query).all(...params);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/test - Trigger test SMS or WhatsApp notification to staff
router.post('/test', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { staffId, channel } = req.body;
    if (!staffId || !channel) {
      return res.status(400).json({ error: 'staffId and channel (SMS or WhatsApp) are required.' });
    }

    const hotel = db.prepare(`SELECT id FROM hotels LIMIT 1`).get() as any;
    const { NotificationService } = await import('../services/notification/notification.service');

    const result = await NotificationService.sendTestNotification({
      hotelId: hotel?.id || 'hotel-ocean-pearl',
      staffId,
      channel: channel as 'SMS' | 'WhatsApp'
    });

    res.json({ success: result.success, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/guest-consent - Guest updates in-room update preferences
router.post('/guest-consent', (req: AuthRequest, res: Response) => {
  try {
    const { trackingToken, roomId, phone, whatsappNumber, preferredChannel, smsEnabled, whatsappEnabled } = req.body;

    if (!trackingToken) {
      return res.status(400).json({ error: 'trackingToken is required' });
    }

    const id = `gpref-${trackingToken}`;
    db.prepare(`
      INSERT INTO guest_notification_preferences (
        id, tracking_token, room_id, phone, whatsapp_number, preferred_channel,
        sms_enabled, whatsapp_enabled, consent_timestamp, consent_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'guest_in_room_web')
      ON CONFLICT(id) DO UPDATE SET
        phone = excluded.phone,
        whatsapp_number = excluded.whatsapp_number,
        preferred_channel = excluded.preferred_channel,
        sms_enabled = excluded.sms_enabled,
        whatsapp_enabled = excluded.whatsapp_enabled,
        consent_timestamp = datetime('now')
    `).run(
      id,
      trackingToken,
      roomId || '',
      phone || null,
      whatsappNumber || null,
      preferredChannel || 'none',
      smsEnabled ? 1 : 0,
      whatsappEnabled ? 1 : 0
    );

    res.json({ success: true, message: 'Notification preferences saved.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

