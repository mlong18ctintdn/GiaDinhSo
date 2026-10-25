import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { generateCode } from '@/lib/family';
import { userFrom } from '@/lib/auth';
import { route } from '@/lib/route';

export const dynamic = 'force-dynamic';

/** Create a new household with a fresh family code. */
export const POST = route(async (req: Request) => {
  const sb = supabaseAdmin();
  const owner = await userFrom(req); // signed-in creators become the owner
  for (let i = 0; i < 5; i++) {
    const { data, error } = await sb.from('families').insert({ family_code: generateCode(), owner_id: owner?.id ?? null }).select().single();
    if (!error) return NextResponse.json({ family: data });
    if (error.code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ error: 'code_generation_failed' }, { status: 500 });
});
