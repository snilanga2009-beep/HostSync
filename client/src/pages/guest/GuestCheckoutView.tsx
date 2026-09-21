import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import confetti from 'canvas-confetti';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Sparkles,
  ArrowLeft,
  Smartphone
} from 'lucide-react';

interface PaymentDetail {
  id: string;
  transaction_id: string;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  room_number: string;
  staff_name: string;
  staff_title: string;
  staff_avatar?: string;
  guest_name?: string;
  guest_message?: string;
}

export const GuestCheckoutView: React.FC = () => {
  const { transactionId } = useParams<{ transactionId: string }>();
  const navigate = useNavigate();

  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Card form state
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [expiry, setExpiry] = useState('12/28');
  const [cvv, setCvv] = useState('888');
  const [cardholder, setCardholder] = useState('');

  const fetchStatus = async () => {
    if (!transactionId) return;
    try {
      const res = await api.get<{ payment: PaymentDetail }>(`/payments/status/${transactionId}`);
      setPayment(res.payment);
      if (res.payment.status === 'Paid') {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'Payment transaction not found.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [transactionId]);

  const handleSimulatePayment = async (status: 'SUCCESS' | 'FAILURE') => {
    setProcessing(true);
    setError(null);

    try {
      const res = await api.post<{ success: boolean; message: string }>('/payments/simulate-sandbox', {
        transactionId,
        status,
        paymentMethod: 'Square Hosted Checkout (Sandbox)'
      });

      if (status === 'SUCCESS' && res.success) {
        setSuccess(true);
        // Confetti celebration
        try {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });
        } catch (e) {}
        await fetchStatus();
      } else {
        setError(res.message || 'Payment was declined by card issuer.');
      }
    } catch (err: any) {
      setError(err.message || 'Payment failed.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 text-brand-400 animate-spin mb-4" />
        <h3 className="text-sm font-bold">Opening secure checkout...</h3>
      </div>
    );
  }

  if (error && !payment) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Transaction Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white text-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-scaleUp">
        {/* Top Header */}
        <div className="bg-slate-950 text-white p-6 border-b border-slate-800 text-center relative">
          <span className="text-[10px] uppercase font-bold tracking-widest text-brand-400">
            Secure Payment Gateway
          </span>
          <h2 className="text-xl font-extrabold mt-1">
            ${payment?.amount.toFixed(2)} {payment?.currency}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Gratuity for <strong className="text-white">{payment?.staff_name}</strong> ({payment?.staff_title})
          </p>

          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-[11px] text-slate-300 font-mono">
            <Lock className="w-3 h-3 text-emerald-400" /> {transactionId}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-100 animate-bounceIn">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Payment Successful!</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Your gratuity of ${payment?.amount.toFixed(2)} was securely processed and credited to {payment?.staff_name}.
                </p>
              </div>

              {/* Staff Appreciation Card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3 text-left">
                <img
                  src={payment?.staff_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(payment?.staff_name || 'Staff')}&background=e11d48&color=fff`}
                  alt={payment?.staff_name}
                  className="w-12 h-12 rounded-xl object-cover"
                />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{payment?.staff_name}</h4>
                  <p className="text-[11px] text-slate-500">{payment?.staff_title}</p>
                  <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Tip recorded & verified</p>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href="/guest/r/ocean101token"
                  className="block w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors text-center"
                >
                  Return to Room Services
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Digital Wallets Header */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSimulatePayment('SUCCESS')}
                  disabled={processing}
                  className="py-2.5 px-3 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                >
                  <span> Pay</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulatePayment('SUCCESS')}
                  disabled={processing}
                  className="py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                >
                  <span>G Pay</span>
                </button>
              </div>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 absolute">OR CREDIT CARD</span>
              </div>

              {/* Card Form */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Card Number
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="4242 4242 4242 4242"
                      className="w-full text-xs font-mono p-2.5 pl-9 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                    <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Expiry
                    </label>
                    <input
                      type="text"
                      value={expiry}
                      onChange={(e) => setExpiry(e.target.value)}
                      placeholder="MM/YY"
                      className="w-full text-xs font-mono p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      CVV
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value)}
                      placeholder="•••"
                      className="w-full text-xs font-mono p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Interactive Simulator Bar */}
              <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200/80">
                <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Square Payment Sandbox Simulator</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed mb-3">
                  Test the complete payment confirmation & webhook workflow without live credit card charges.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSimulatePayment('SUCCESS')}
                    disabled={processing}
                    className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1"
                  >
                    {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    <span>Confirm & Pay</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSimulatePayment('FAILURE')}
                    disabled={processing}
                    className="py-2 px-3 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold shadow-sm transition-colors"
                  >
                    Simulate Decline
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Encrypted with 256-bit SSL • Square Payment API</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
