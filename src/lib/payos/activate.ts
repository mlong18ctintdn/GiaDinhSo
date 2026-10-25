import { supabaseAdmin } from '../supabase/server';
import { broadcast } from '../supabase/broadcast';

/**
 * Payment received -> family becomes PRO. One atomic SQL function (activate_payment) does the whole step,
 * so a webhook retry, a double webhook, or the status poll racing the webhook can never add time twice.
 */
export async function activatePayment(orderCode: number, paidAmount: number) {
  const { data, error } = await supabaseAdmin().rpc('activate_payment', { p_order_code: orderCode, p_paid_amount: paidAmount });
  if (error) throw new Error(`activate_payment: ${error.message}. Run supabase/migration_v3.sql`);
  if (data?.ok && !data.already && data.family_code) {
    await broadcast(data.family_code, 'family'); // every open screen lifts the paywall at once
  }
  return data as { ok: boolean; already?: boolean; reason?: string; family_code?: string; expires_at?: string };
}
