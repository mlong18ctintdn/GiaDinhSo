import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { normCode } from '@/lib/family';
import { userFrom } from '@/lib/auth';
import { route } from '@/lib/route';

export const dynamic = 'force-dynamic';

export const GET = route(async (req: Request, { params }: { params: { code: string } }) => {
  const code = normCode(params.code);
  if (!code) return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  const sb = supabaseAdmin();
  const { data } = await sb.from('families').select('*').eq('family_code', code).maybeSingle();
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const { owner_id, ...family } = data; // never send the owner's user id to the browser
  const { data: members } = await sb.from('members').select('*').eq('family_code', code).order('created_at', { ascending: true });
  const isOwner = !!owner_id && (await userFrom(req))?.id === owner_id;
  return NextResponse.json({ family, members: members ?? [], owned: !!owner_id, isOwner });
});
