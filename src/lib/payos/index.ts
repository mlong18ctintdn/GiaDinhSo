import crypto from 'crypto';

const hmac = (data: string) =>
  crypto.createHmac('sha256', process.env.PAYOS_CHECKSUM_KEY!).update(data).digest('hex');

export interface PayosLink {
  checkoutUrl: string;
  qrCode: string; // VietQR payload, render it as a QR code
  paymentLinkId: string;
  orderCode: number;
  accountNumber?: string;
  accountName?: string;
}

export async function createPaymentLink(p: {
  orderCode: number;
  amount: number;
  description: string; // PayOS allows max 25 chars: FAMILY_K9P3RZ_MONTHLY = 21
  returnUrl: string;
  cancelUrl: string;
  expiredAt?: number; // unix seconds; not part of the signature
}): Promise<PayosLink> {
  const signature = hmac(
    `amount=${p.amount}&cancelUrl=${p.cancelUrl}&description=${p.description}&orderCode=${p.orderCode}&returnUrl=${p.returnUrl}`,
  );
  const r = await fetch('https://api-merchant.payos.vn/v2/payment-requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': process.env.PAYOS_CLIENT_ID!,
      'x-api-key': process.env.PAYOS_API_KEY!,
    },
    body: JSON.stringify({ ...p, signature }),
    signal: AbortSignal.timeout(15_000),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.code !== '00' || !j.data) throw new Error(j?.desc || `payos_${r.status}`);
  return j.data as PayosLink;
}

/** Verify the HMAC-SHA256 signature of a PayOS webhook body. */
export function verifyWebhook(body: { data: Record<string, unknown>; signature: string }): boolean {
  const str = Object.keys(body.data)
    .sort()
    .map((k) => {
      const v = body.data[k];
      return `${k}=${v === null || v === undefined || v === 'null' || v === 'undefined' ? '' : v}`;
    })
    .join('&');
  const a = Buffer.from(hmac(str));
  const b = Buffer.from(String(body.signature ?? ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Ask PayOS directly whether an order was paid (backup for a late or missing webhook). */
export async function getPaymentStatus(orderCode: number): Promise<{ status: string; amountPaid: number } | null> {
  try {
    const r = await fetch(`https://api-merchant.payos.vn/v2/payment-requests/${orderCode}`, {
      headers: { 'x-client-id': process.env.PAYOS_CLIENT_ID!, 'x-api-key': process.env.PAYOS_API_KEY! },
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || j.code !== '00' || !j.data) return null;
    return { status: String(j.data.status), amountPaid: Number(j.data.amountPaid ?? j.data.amount ?? 0) };
  } catch {
    return null;
  }
}
