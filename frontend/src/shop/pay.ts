/**
 * Razorpay checkout for the storefront. Amounts are never computed here: the API creates the
 * Razorpay order from the order's server-side total (POST /store/me/orders or
 * /store/me/orders/:id/retry-payment) and this only opens the window it returned.
 * Verification happens on the server (/payments/verify, plus the webhook as a fallback).
 */
import { shopApi } from './api';

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, cb: (r: unknown) => void) => void };
  }
}

export interface RazorpayStart {
  keyId: string;
  orderId: string;
  amount: number;
  currency?: string;
}

export function loadRazorpay() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

/** Resolves 'paid' (verified or left to the webhook), 'dismissed', 'failed' or 'unavailable'. */
export async function openRazorpay(
  rzp: RazorpayStart,
  order: { _id: string; orderNumber: string },
  prefill: { email?: string; phone?: string },
): Promise<'paid' | 'dismissed' | 'failed' | 'unavailable'> {
  if (!(await loadRazorpay()) || !window.Razorpay) return 'unavailable';
  return new Promise((resolve) => {
    let failed = false;
    const r = new window.Razorpay!({
      key: rzp.keyId,
      order_id: rzp.orderId,
      amount: rzp.amount,
      currency: rzp.currency ?? 'INR',
      name: 'VSR',
      description: `Order #${order.orderNumber}`,
      prefill: { email: prefill.email ?? '', contact: prefill.phone ?? '' },
      theme: { color: '#0B3D2E' },
      handler: async (res: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        // The webhook reconciles if this verification is late or fails
        await shopApi
          .post('/store/me/payments/verify', { razorpayOrderId: res.razorpay_order_id, razorpayPaymentId: res.razorpay_payment_id, razorpaySignature: res.razorpay_signature })
          .catch(() => undefined);
        resolve('paid');
      },
      modal: {
        ondismiss: () => {
          void shopApi.post('/store/me/payments/abandon', { orderId: order._id, reason: failed ? 'failed' : 'cancelled' }).catch(() => undefined);
          resolve(failed ? 'failed' : 'dismissed');
        },
      },
    });
    r.on('payment.failed', () => {
      failed = true;
    });
    r.open();
  });
}

/** Pay again for an unpaid online order; the server re-creates the gateway order from its own total. */
export async function retryPayment(order: { _id: string; orderNumber: string }, prefill: { email?: string; phone?: string }) {
  const { data } = await shopApi.post<{ razorpay: RazorpayStart }>(`/store/me/orders/${order._id}/retry-payment`);
  return openRazorpay(data.razorpay, order, prefill);
}

/** An online order that can still be paid (the backend enforces the same rule). */
export const canRetryPayment = (o: { status: string; paymentMethod: string; paymentStatus: string }) =>
  o.status === 'placed' && o.paymentMethod !== 'cod' && o.paymentStatus !== 'paid';
