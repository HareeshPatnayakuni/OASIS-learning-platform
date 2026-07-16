import Razorpay from 'razorpay';
import { validatePaymentVerification } from 'razorpay/dist/utils/razorpay-utils';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * Mirrors lib/r2.ts's pattern exactly: build the client lazily from env
 * vars that are `.optional()` at the schema level (so the app can boot
 * without Razorpay configured, same as it can boot without R2), and
 * throw a clear, dedicated error at the point of use if a caller actually
 * needs it and it isn't configured — rather than crashing at startup for
 * every developer who doesn't have live-yet Razorpay test keys.
 */
function buildClient(): Razorpay | null {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    return null;
  }
  return new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
}

const client = buildClient();

export class RazorpayNotConfiguredError extends Error {
  constructor() {
    super(
      'Razorpay credentials are not configured (RAZORPAY_KEY_ID / ' +
        'RAZORPAY_KEY_SECRET). Paid course checkout cannot be started until these are set.',
    );
    this.name = 'RazorpayNotConfiguredError';
  }
}

export interface CreatedOrder {
  razorpayOrderId: string;
  amount: number; // paise, as returned by Razorpay
  currency: string;
  keyId: string;
}

/**
 * `amountInRupees` matches `Course.price`/`Payment.amount`'s convention
 * (a `Decimal(10,2)` rupee value) — Razorpay itself requires the amount
 * in the currency's smallest subunit (paise for INR), so the ×100
 * conversion happens here, once, at the one place that talks to
 * Razorpay, rather than asking every caller to remember it.
 */
export async function createOrder(amountInRupees: number, receipt: string): Promise<CreatedOrder> {
  if (!client) {
    logger.error('Attempted to create a Razorpay order without credentials configured');
    throw new RazorpayNotConfiguredError();
  }

  const order = await client.orders.create({
    amount: Math.round(amountInRupees * 100),
    currency: 'INR',
    receipt,
  });

  return {
    razorpayOrderId: order.id,
    amount: typeof order.amount === 'string' ? parseInt(order.amount, 10) : order.amount,
    currency: order.currency,
    // Safe: only reachable past the `!client` guard above, which itself
    // requires RAZORPAY_KEY_ID to be set.
    keyId: env.RAZORPAY_KEY_ID as string,
  };
}

/**
 * Checkout signature verification (not webhook verification — a
 * different Razorpay mechanism/helper with a different HMAC input
 * shape). Uses the SDK's own `validatePaymentVerification` rather than
 * hand-rolling the HMAC-SHA256 comparison, since this is exactly the
 * kind of security-critical code where reusing the vendor's tested
 * implementation is safer than reimplementing it.
 */
export function verifyCheckoutSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): boolean {
  if (!env.RAZORPAY_KEY_SECRET) {
    logger.error('Attempted to verify a Razorpay payment signature without RAZORPAY_KEY_SECRET configured');
    throw new RazorpayNotConfiguredError();
  }

  return validatePaymentVerification(
    { order_id: params.razorpayOrderId, payment_id: params.razorpayPaymentId },
    params.razorpaySignature,
    env.RAZORPAY_KEY_SECRET,
  );
}
