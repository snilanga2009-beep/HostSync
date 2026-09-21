import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database';
import { CONFIG } from '../config';

export interface CreateCheckoutParams {
  hotelId: string;
  roomId: string;
  staffId: string;
  requestId?: string;
  amount: number;
  currency: string;
  guestName?: string;
  guestMessage?: string;
  customAmount?: boolean;
}

export class PaymentService {
  /**
   * Retrieves active payment settings for a hotel
   */
  static getPaymentConfig(hotelId: string) {
    const row = db.prepare(`SELECT value_json FROM settings WHERE hotel_id = ? AND category = 'payments' AND key = 'gateway'`).get(hotelId) as any;
    if (row) {
      try {
        return JSON.parse(row.value_json);
      } catch (e) {
        // Fallback
      }
    }
    return {
      provider: 'square',
      environment: CONFIG.SQUARE.ENVIRONMENT,
      applicationId: CONFIG.SQUARE.APPLICATION_ID,
      accessToken: CONFIG.SQUARE.ACCESS_TOKEN,
      locationId: CONFIG.SQUARE.LOCATION_ID,
      currency: 'USD',
      sandboxSimulatorEnabled: true
    };
  }

  /**
   * Retrieves tip distribution rule for a hotel
   */
  static getTipDistributionRule(hotelId: string) {
    const row = db.prepare(`SELECT value_json FROM settings WHERE hotel_id = ? AND category = 'tips' AND key = 'distribution'`).get(hotelId) as any;
    if (row) {
      try {
        return JSON.parse(row.value_json);
      } catch (e) {
        // Fallback
      }
    }
    return {
      rule: '100_staff', // '100_staff' or 'split_ratio'
      staffPercent: 100,
      hotelPoolPercent: 0
    };
  }

  /**
   * Creates a tip record and payment session
   */
  static async createPaymentSession(params: CreateCheckoutParams): Promise<{
    tipId: string;
    paymentId: string;
    transactionId: string;
    checkoutUrl: string;
    amount: number;
    currency: string;
    provider: string;
    isSandbox: boolean;
  }> {
    const tipId = uuidv4();
    const paymentId = uuidv4();
    const transactionId = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const idempotencyKey = uuidv4();

    const config = this.getPaymentConfig(params.hotelId);
    const provider = config.provider || 'square';
    const currency = params.currency || config.currency || 'USD';

    // Insert Tip record in Pending status
    db.prepare(`
      INSERT INTO tips (
        id, hotel_id, room_id, staff_id, request_id, amount, currency, custom_amount,
        status, guest_name, guest_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, datetime('now'))
    `).run(
      tipId,
      params.hotelId,
      params.roomId,
      params.staffId,
      params.requestId || null,
      params.amount,
      currency,
      params.customAmount ? 1 : 0,
      params.guestName || 'Valued Guest',
      params.guestMessage || ''
    );

    // Generate Hosted Checkout URL
    // If Square credentials are configured in live/sandbox, we would call the official Square Checkout API
    // (POST https://connect.squareup.com/v2/online-checkout/payment-links)
    // For both Square Checkout and the built-in Sandbox Simulator:
    const isSandbox = config.environment === 'sandbox' || !config.accessToken;
    let checkoutUrl = `${CONFIG.BASE_URL}/guest/checkout/${transactionId}`;

    // Record Payment record with status Pending
    db.prepare(`
      INSERT INTO payments (
        id, transaction_id, provider, tip_id, amount, currency, status,
        idempotency_key, checkout_url, raw_response, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, datetime('now'))
    `).run(
      paymentId,
      transactionId,
      provider,
      tipId,
      params.amount,
      currency,
      idempotencyKey,
      checkoutUrl,
      JSON.stringify({ note: 'Payment session created', provider, idempotencyKey })
    );

    return {
      tipId,
      paymentId,
      transactionId,
      checkoutUrl,
      amount: params.amount,
      currency,
      provider,
      isSandbox
    };
  }

  /**
   * Finalize and confirm a payment (called upon webhook or simulator verification)
   */
  static processPaymentSuccess(transactionId: string, paymentMethod = 'Card', externalReference = ''): { success: boolean; message: string } {
    const payment = db.prepare(`SELECT * FROM payments WHERE transaction_id = ?`).get(transactionId) as any;
    if (!payment) {
      return { success: false, message: 'Transaction not found' };
    }

    if (payment.status === 'Paid') {
      return { success: true, message: 'Payment was already processed' };
    }

    const tip = db.prepare(`SELECT * FROM tips WHERE id = ?`).get(payment.tip_id) as any;
    if (!tip) {
      return { success: false, message: 'Associated tip not found' };
    }

    // Begin atomic transaction
    const updateTransaction = db.transaction(() => {
      // 1. Update Payment record to Paid
      db.prepare(`
        UPDATE payments
        SET status = 'Paid',
            payment_token = ?,
            completed_at = datetime('now'),
            raw_response = ?
        WHERE id = ?
      `).run(
        externalReference || `tok_${uuidv4().substring(0, 12)}`,
        JSON.stringify({ confirmedAt: new Date().toISOString(), paymentMethod }),
        payment.id
      );

      // 2. Update Tip record to Paid
      db.prepare(`
        UPDATE tips
        SET status = 'Paid',
            completed_at = datetime('now')
        WHERE id = ?
      `).run(tip.id);

      // 3. Compute Tip Distribution according to Hotel Policy
      const distRule = this.getTipDistributionRule(tip.hotel_id);
      let staffAmount = tip.amount;
      let hotelPoolAmount = 0;

      if (distRule.rule === 'split_ratio' && distRule.staffPercent < 100) {
        staffAmount = Number(((tip.amount * distRule.staffPercent) / 100).toFixed(2));
        hotelPoolAmount = Number((tip.amount - staffAmount).toFixed(2));
      }

      db.prepare(`
        INSERT INTO tip_distributions (
          id, tip_id, staff_id, staff_amount, hotel_pool_amount, distribution_rule, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        uuidv4(),
        tip.id,
        tip.staff_id,
        staffAmount,
        hotelPoolAmount,
        distRule.rule === 'split_ratio' ? `${distRule.staffPercent}_staff_${distRule.hotelPoolPercent}_hotel` : '100_staff'
      );

      // 4. Create Notification for staff member and admin
      const staffUser = db.prepare(`
        SELECT u.id, u.full_name FROM staff_profiles sp JOIN users u ON sp.user_id = u.id WHERE sp.id = ?
      `).get(tip.staff_id) as any;

      if (staffUser) {
        db.prepare(`
          INSERT INTO notifications (id, hotel_id, user_id, target_role, title, message, type, link, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'success', '/staff/tips', datetime('now'))
        `).run(
          uuidv4(),
          tip.hotel_id,
          staffUser.id,
          'Technician',
          'Tip Received!',
          `You received a ${tip.currency} ${tip.amount.toFixed(2)} tip from Room!`
        );
      }

      // Record in Audit Log
      db.prepare(`
        INSERT INTO audit_logs (id, hotel_id, user_name, action, entity, entity_id, details_json, created_at)
        VALUES (?, ?, 'Payment Gateway', 'TIP_PAID', 'tip', ?, ?, datetime('now'))
      `).run(
        uuidv4(),
        tip.hotel_id,
        tip.id,
        JSON.stringify({ transactionId, amount: tip.amount, currency: tip.currency, staffId: tip.staff_id })
      );
    });

    updateTransaction();
    return { success: true, message: 'Payment confirmed successfully' };
  }

  /**
   * Process payment failure
   */
  static processPaymentFailure(transactionId: string, reason: string): { success: boolean; message: string } {
    const payment = db.prepare(`SELECT * FROM payments WHERE transaction_id = ?`).get(transactionId) as any;
    if (!payment) {
      return { success: false, message: 'Transaction not found' };
    }

    db.prepare(`
      UPDATE payments SET status = 'Failed', raw_response = ? WHERE id = ?
    `).run(JSON.stringify({ failedAt: new Date().toISOString(), reason }), payment.id);

    db.prepare(`
      UPDATE tips SET status = 'Failed' WHERE id = ?
    `).run(payment.tip_id);

    return { success: true, message: 'Payment marked as failed' };
  }
}
