import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { userFrom } from '@/lib/auth';
import { route } from '@/lib/route';

export const dynamic = 'force-dynamic';

/** Families owned by the signed-in person, so they can reopen them on any device. */
export const GET = route(async (req: Request) => {
  const user = await userFrom(req);
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
  const { data, error } = await supabaseAdmin()
    .from('families')
    .select('family_code,created_at,is_premium,premium_expires_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'db', detail: error.message }, { status: 500 });
  return NextResponse.json({ families: data ?? [] });
});
