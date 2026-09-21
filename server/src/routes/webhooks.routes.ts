import { Router, Request, Response } from 'express';
import { db } from '../db/database';
import { sseService } from '../services/sse';

const router = Router();

// POST /api/webhooks/twilio/status - Webhook callback for Twilio SMS & WhatsApp delivery status
router.post('/twilio/status', (req: Request, res: Response) => {
  try {
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage, To } = req.body;

    if (!MessageSid) {
      return res.status(400).send('Missing MessageSid');
    }

    // Map Twilio status to our status
    let status = 'SENT';
    if (MessageStatus === 'delivered') status = 'DELIVERED';
    else if (MessageStatus === 'read') status = 'READ';
    else if (MessageStatus === 'failed' || MessageStatus === 'undelivered') status = 'FAILED';
    else if (MessageStatus === 'sending' || MessageStatus === 'queued') status = 'SENDING';

    const logRecord = db.prepare(`
      SELECT * FROM notification_logs WHERE provider_message_id = ?
    `).get(MessageSid) as any;

    if (logRecord) {
      db.prepare(`
        UPDATE notification_logs
        SET status = ?,
            delivered_at = CASE WHEN ? IN ('DELIVERED', 'READ') THEN datetime('now') ELSE delivered_at END,
            failed_at = CASE WHEN ? = 'FAILED' THEN datetime('now') ELSE failed_at END,
            error_code = COALESCE(?, error_code),
            error_message = COALESCE(?, error_message)
        WHERE id = ?
      `).run(
        status,
        status,
        status,
        ErrorCode || null,
        ErrorMessage || null,
        logRecord.id
      );

      // Broadcast real-time delivery update to Front Office
      sseService.broadcast('NOTIFICATION_STATUS_UPDATED', {
        logId: logRecord.id,
        jobId: logRecord.job_id,
        channel: logRecord.channel,
        status,
        recipient: To || logRecord.recipient
      });

      // Return 200 OK TwiML or text
      res.type('text/xml').send('<Response></Response>');
    } else {
      res.type('text/xml').send('<Response></Response>');
    }
  } catch (err: any) {
    console.error('Twilio webhook processing error:', err);
    res.status(500).send('Webhook processing error');
  }
});

// GET /api/webhooks/whatsapp - Meta WhatsApp Cloud API Webhook verification
router.get('/whatsapp', (req: Request, res: Response) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const row = db.prepare(`SELECT value_json FROM settings WHERE category = 'notifications' AND key = 'providers' LIMIT 1`).get() as any;
    let expectedToken = 'resortcare_webhook_secret_2026';
    if (row && row.value_json) {
      try {
        const p = JSON.parse(row.value_json);
        if (p.whatsapp?.meta?.verifyToken) expectedToken = p.whatsapp.meta.verifyToken;
      } catch (e) {}
    }

    if (mode === 'subscribe' && token === expectedToken) {
      return res.status(200).send(challenge);
    }
    res.status(403).send('Forbidden: Token mismatch');
  } catch (err: any) {
    res.status(500).send('Webhook verification error');
  }
});

// POST /api/webhooks/whatsapp - Meta WhatsApp Cloud API status callback
router.post('/whatsapp', (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;
          if (value?.statuses) {
            for (const st of value.statuses) {
              const messageId = st.id;
              const metaStatus = st.status; // 'sent', 'delivered', 'read', 'failed'
              let status = 'SENT';
              if (metaStatus === 'delivered') status = 'DELIVERED';
              else if (metaStatus === 'read') status = 'READ';
              else if (metaStatus === 'failed') status = 'FAILED';

              const logRecord = db.prepare(`
                SELECT * FROM notification_logs WHERE provider_message_id = ?
              `).get(messageId) as any;

              if (logRecord) {
                db.prepare(`
                  UPDATE notification_logs
                  SET status = ?,
                      delivered_at = CASE WHEN ? IN ('DELIVERED', 'READ') THEN datetime('now') ELSE delivered_at END,
                      failed_at = CASE WHEN ? = 'FAILED' THEN datetime('now') ELSE failed_at END,
                      error_message = CASE WHEN ? = 'FAILED' THEN ? ELSE error_message END
                  WHERE id = ?
                `).run(status, status, status, status, st.errors?.[0]?.message || 'Meta WhatsApp delivery error', logRecord.id);

                sseService.broadcast('NOTIFICATION_STATUS_UPDATED', {
                  logId: logRecord.id,
                  jobId: logRecord.job_id,
                  channel: 'WhatsApp',
                  status,
                  recipient: st.recipient_id || logRecord.recipient
                });
              }
            }
          }
        }
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } catch (err: any) {
    console.error('Meta WhatsApp webhook error:', err);
    res.status(500).send('Webhook error');
  }
});

export default router;
