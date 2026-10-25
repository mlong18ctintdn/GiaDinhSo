import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { normCode } from '@/lib/family';
import { userFrom } from '@/lib/auth';
import { route } from '@/lib/route';

export const dynamic = 'force-dynamic';

/** A signed-in person claims a family nobody owns yet. */
export const POST = route(async (req: Request) => {
  const user = await userFrom(req);
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
  const code = normCode((await req.json().catch(() => null))?.code);
  if (!code) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const { data, error } = await supabaseAdmin()
    .from('families')
    .update({ owner_id: user.id })
    .eq('family_code', code)
    .is('owner_id', null)
    .select('family_code');
  if (error) return NextResponse.json({ error: 'db', detail: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: 'already_owned' }, { status: 409 });
  return NextResponse.json({ ok: true });
});
