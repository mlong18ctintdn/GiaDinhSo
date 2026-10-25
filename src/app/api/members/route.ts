import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { broadcast } from '@/lib/supabase/broadcast';
import { normCode } from '@/lib/family';
import { canManage } from '@/lib/auth';
import { route } from '@/lib/route';

export const dynamic = 'force-dynamic';
const ROLES = ['grandparent', 'parent', 'teen', 'child'];
const THEMES = ['default', 'neon', 'pastel', 'cyber'];
const FONTS = ['sans', 'round', 'grotesk'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST = route(async (req: Request) => {
  const b = await req.json().catch(() => null);
  const code = normCode(b?.code);
  const name = String(b?.name ?? '').trim().slice(0, 40);
  if (!code || !name || !ROLES.includes(b?.role)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const sb = supabaseAdmin();
  const { count } = await sb.from('members').select('id', { count: 'exact', head: true }).eq('family_code', code);
  if ((count ?? 0) >= 20) return NextResponse.json({ error: 'too_many_members' }, { status: 400 });
  const { data, error } = await sb
    .from('members')
    .insert({ family_code: code, name, role: b.role, avatar: String(b.avatar ?? '').slice(0, 8) || null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: 'db', detail: error.message }, { status: 500 });
  await broadcast(code, 'members');
  return NextResponse.json({ member: data });
});

/**
 * Update a member. Choosing your own look (custom_theme) is open to everyone.
 * Changing name, avatar or role needs manage rights (open family, or the signed-in owner).
 */
export const PATCH = route(async (req: Request) => {
  const b = await req.json().catch(() => null);
  const code = normCode(b?.code);
  if (!code || !UUID.test(String(b?.id))) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (b.custom_theme !== undefined) {
    const t = b.custom_theme;
    if (!THEMES.includes(t?.theme) || !FONTS.includes(t?.font)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
    patch.custom_theme = { theme: t.theme, font: t.font };
  }
  const profile = b.name !== undefined || b.avatar !== undefined || b.role !== undefined;
  if (profile) {
    if (!(await canManage(req, code))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    if (b.name !== undefined) {
      const name = String(b.name).trim().slice(0, 40);
      if (!name) return NextResponse.json({ error: 'invalid' }, { status: 400 });
      patch.name = name;
    }
    if (b.avatar !== undefined) patch.avatar = String(b.avatar).slice(0, 8) || null;
    if (b.role !== undefined) {
      if (!ROLES.includes(b.role)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
      patch.role = b.role;
    }
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const { error } = await supabaseAdmin().from('members').update(patch).eq('id', b.id).eq('family_code', code);
  if (error) return NextResponse.json({ error: 'db', detail: error.message }, { status: 500 });
  await broadcast(code, 'members');
  return NextResponse.json({ ok: true });
});

export const DELETE = route(async (req: Request) => {
  const p = new URL(req.url).searchParams;
  const code = normCode(p.get('code'));
  const id = p.get('id') ?? '';
  if (!code || !UUID.test(id)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  if (!(await canManage(req, code))) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { error } = await supabaseAdmin().from('members').delete().eq('id', id).eq('family_code', code);
  if (error) return NextResponse.json({ error: 'db', detail: error.message }, { status: 500 });
  await broadcast(code, 'members');
  return NextResponse.json({ ok: true });
});
