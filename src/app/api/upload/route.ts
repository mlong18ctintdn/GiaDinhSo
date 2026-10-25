import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/server';
import { normCode } from '@/lib/family';
import { route } from '@/lib/route';

export const dynamic = 'force-dynamic';

const EXT: [string, string][] = [
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['audio/webm', 'webm'],
  ['audio/mp4', 'm4a'],
  ['audio/ogg', 'ogg'],
  ['audio/mpeg', 'mp3'],
];

/** Upload a photo or voice note for a story. Returns its public URL. */
export const POST = route(async (req: Request) => {
  const form = await req.formData().catch(() => null);
  const code = normCode(form?.get('code'));
  const file = form?.get('file');
  if (!code || !(file instanceof File)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const ext = EXT.find(([t]) => file.type.startsWith(t))?.[1];
  if (!ext) return NextResponse.json({ error: 'unsupported_type' }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'too_large' }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: fam } = await sb.from('families').select('id').eq('family_code', code).maybeSingle();
  if (!fam) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const path = `${code}/${randomUUID()}.${ext}`;
  const { error } = await sb.storage
    .from('family-media')
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type.split(';')[0] });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data } = sb.storage.from('family-media').getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
});
