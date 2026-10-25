import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase/server';

/** The signed-in family owner, if the request carries a valid Supabase session token. */
export async function userFrom(req: Request): Promise<User | null> {
  const h = req.headers.get('authorization');
  const token = h?.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!token) return null;
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  return error ? null : data.user;
}

/**
 * Who may edit or delete members? A family nobody has claimed yet stays open (like before).
 * Once an owner has claimed it, only that signed-in owner can.
 */
export async function canManage(req: Request, code: string): Promise<boolean> {
  const { data } = await supabaseAdmin().from('families').select('owner_id').eq('family_code', code).maybeSingle();
  if (!data) return false;
  if (!data.owner_id) return true;
  return (await userFrom(req))?.id === data.owner_id;
}
