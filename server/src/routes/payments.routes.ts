import { Router, Response, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { PaymentService } from '../services/payment';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { sseService } from '../services/sse';

const router = Router();

// GET /api/payments/status/:transactionId - Check current status of a payment
router.get('/status/:transactionId', (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;

    const payment = db.prepare(`
      SELECT p.*, t.room_id, t.staff_id, t.guest_name, t.guest_message,
             r.room_number,
             u.full_name as staff_name, sp.job_title as staff_title, sp.avatar_url as staff_avatar
      FROM payments p
      JOIN tips t ON p.tip_id = t.id
      JOIN rooms r ON t.room_id = r.id
      JOIN staff_profiles sp ON t.staff_id = sp.id
      JOIN users u ON sp.user_id = u.id
      WHERE p.transaction_id = ?
    `).get(transactionId) as any;

    if (!payment) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    res.json({ payment });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments/simulate-sandbox - Test Sandbox payment execution
router.post('/simulate-sandbox', (req: Request, res: Response) => {
  try {
    const { transactionId, status, paymentMethod } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID is required.' });
    }

    if (status === 'FAILURE') {
      const result = PaymentService.processPaymentFailure(transactionId, 'Simulated test card decline');
      return res.json(result);
    }

    const result = PaymentService.processPaymentSuccess(
      transactionId,
      paymentMethod || 'Square Sandbox Visa',
      `sq_tok_${uuidv4().substring(0, 10)}`
    );

    if (result.success) {
      // Fire SSE notification to Front Office & Staff
      sseService.broadcast('PAYMENT_CONFIRMED', {
        transactionId,
        message: 'Tip payment confirmed successfully!'
      });
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payments/webhook - Webhook confirmation endpoint
router.post('/webhook', (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-square-hmacsha256-signature'] as string;
    const payload = req.body;
    const eventType = payload.type || 'payment.updated';
    const eventId = payload.event_id || uuidv4();

    // Log incoming raw webhook
    db.prepare(`
      INSERT INTO payment_webhooks (id, provider, event_id, event_type, payload_json, signature, status, processed_at)
      VALUES (?, 'square', ?, ?, ?, ?, 'processed', datetime('now'))
    `).run(uuidv4(), eventId, eventType, JSON.stringify(payload), signature || '');

    // If payment.updated or payment.created and status is COMPLETED
    if (payload.data && payload.data.object && payload.data.object.payment) {
      const pData = payload.data.object.payment;
      const externalTxnId = pData.reference_id || pData.id;
      if (pData.status === 'COMPLETED') {
        PaymentService.processPaymentSuccess(externalTxnId, 'Square Webhook', pData.id);
      } else if (pData.status === 'FAILED' || pData.status === 'CANCELED') {
        PaymentService.processPaymentFailure(externalTxnId, `Square status: ${pData.status}`);
      }
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed.' });
  }
});

// GET /api/payments/transactions - List all transactions
router.get('/transactions', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const { status, provider } = req.query;

    let query = `
      SELECT p.*,
             t.amount as tip_amount, t.guest_name,
             r.room_number,
             u.full_name as staff_name, sp.job_title as staff_title
      FROM payments p
      JOIN tips t ON p.tip_id = t.id
      JOIN rooms r ON t.room_id = r.id
      JOIN staff_profiles sp ON t.staff_id = sp.id
      JOIN users u ON sp.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      query += ` AND p.status = ?`;
      params.push(status);
    }
    if (provider) {
      query += ` AND p.provider = ?`;
      params.push(provider);
    }

    query += ` ORDER BY p.created_at DESC`;

    const transactions = db.prepare(query).all(...params);
    res.json({ transactions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
