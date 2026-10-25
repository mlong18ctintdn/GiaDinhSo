import { NextResponse } from 'next/server';
import { route } from '@/lib/route';
import { supabaseAdmin, ConfigError } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface Check {
  name: string;
  ok: boolean;
  fix?: string;
  detail?: string;
}

const has = (n: string) => !!process.env[n]?.trim();

/** Which Supabase role a key belongs to. Reads only the public "role" claim, never prints the key. */
function keyRole(key?: string): 'service_role' | 'anon' | 'unknown' {
  const k = key?.trim();
  if (!k) return 'unknown';
  if (k.startsWith('sb_secret_')) return 'service_role';
  if (k.startsWith('sb_publishable_')) return 'anon';
  try {
    const role = JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString('utf8')).role;
    return role === 'service_role' ? 'service_role' : role === 'anon' ? 'anon' : 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Translate a Supabase/PostgREST error into the one thing the owner should do about it. */
function explain(error: { code?: string; message?: string; status?: number } | null): string | undefined {
  if (!error) return undefined;
  const m = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  if (m.includes('invalid api key') || m.includes('jwt') || error.status === 401) {
    return 'SUPABASE_SERVICE_ROLE_KEY is wrong (use the service_role / secret key, not the anon key) or belongs to another project.';
  }
  if (m.includes('pgrst205') || m.includes('42p01') || m.includes('schema cache') || m.includes('does not exist')) {
    return 'Table or function is missing. Run supabase/schema.sql in the Supabase SQL Editor, then run it again if you just created tables.';
  }
  if (m.includes('42703') || m.includes('column')) {
    return 'The table exists but has different columns (an older project?). Run supabase/schema.sql: its upgrade section adds the missing columns.';
  }
  if (m.includes('fetch failed') || m.includes('enotfound')) {
    return 'NEXT_PUBLIC_SUPABASE_URL is wrong or unreachable. It looks like https://xxxx.supabase.co';
  }
  return undefined;
}

/**
 * Open /api/health after every deploy. It tells you which environment variable is missing,
 * whether the database tables exist, and whether the usage function and storage bucket are there.
 */
export const GET = route(async (req: Request) => {
  const checks: Check[] = [];
  const need = (name: string, fix: string) => checks.push({ name, ok: has(name), fix: has(name) ? undefined : fix });

  need('NEXT_PUBLIC_SUPABASE_URL', 'Add it in Vercel > Settings > Environment Variables, then Redeploy (NEXT_PUBLIC_ values are fixed at build time).');
  need('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'Add the anon/publishable key, then Redeploy.');
  need('SUPABASE_SERVICE_ROLE_KEY', 'Add the service_role/secret key (server only), then Redeploy.');
  const svc = keyRole(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (has('SUPABASE_SERVICE_ROLE_KEY')) {
    checks.push({
      name: 'SUPABASE_SERVICE_ROLE_KEY really is a service_role key',
      ok: svc === 'service_role',
      fix: svc === 'service_role' ? undefined : 'This variable holds a different key (probably the anon/publishable one). In Supabase > Project Settings > API, copy the service_role (secret) key into SUPABASE_SERVICE_ROLE_KEY, then Redeploy. A wrong key here causes "permission denied" and failed inserts.',
      detail: `role of the key: ${svc}`,
    });
  }
  if (keyRole(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) === 'service_role') {
    checks.push({
      name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY must NOT be the secret key',
      ok: false,
      fix: 'SECURITY: the secret key is exposed to every visitor. Put the anon/publishable key here, then rotate the service_role key in Supabase.',
    });
  }
  checks.push({
    name: 'AI key (GEMINI_API_KEY or OPENAI_API_KEY)',
    ok: has('GEMINI_API_KEY') || has('OPENAI_API_KEY'),
    fix: 'Needed for the AI decoder and game hints. The rest of the app works without it.',
  });
  const payos = ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY'].filter((n) => !has(n));
  checks.push({ name: 'PayOS keys', ok: payos.length === 0, fix: payos.length ? `Missing: ${payos.join(', ')}` : undefined });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  checks.push({
    name: 'NEXT_PUBLIC_APP_URL',
    ok: !appUrl || /^https?:\/\//.test(appUrl),
    fix: appUrl && !/^https?:\/\//.test(appUrl) ? 'Must start with https:// (for example https://your-app.vercel.app)' : undefined,
  });

  const supabaseReady = checks.slice(0, 3).every((c) => c.ok);
  if (supabaseReady) {
    try {
      const sb = supabaseAdmin();
      const tables: [string, string][] = [
        ['families', 'family_code,usage_count,is_premium,plan_type,premium_expires_at'],
        ['members', 'id,family_code,name,role,avatar,custom_theme'],
        ['stories', 'id,family_code,year,title,content,author_name,photo_url,audio_url,created_at'],
        ['genz_dictionary', 'word,definition,solution_for_parents,context_example'],
        ['payments', 'order_code,family_code,plan,amount,status,paid_at'],
      ];
      for (const [table, cols] of tables) {
        const { error, count } = await sb.from(table).select(cols, { count: 'exact', head: true });
        checks.push({
          name: `table ${table}`,
          ok: !error,
          fix: explain(error),
          detail: error ? error.message : table === 'genz_dictionary' ? `${count ?? 0} words (run npm run seed:genz if 0; the app falls back to the bundled list)` : undefined,
        });
      }
      // Real write tests on a throw-away family. These are the exact operations behind
      // "Tạo gia đình mới", adding a member, saving a story, saving a reminder and the free-use counter.
      const TEST = 'ZZHLTH';
      await sb.from('families').delete().eq('family_code', TEST); // clean leftovers from an earlier run
      const probe = await sb.from('families').insert({ family_code: TEST }).select('id').single();
      checks.push({
        name: 'can create a family (insert test)',
        ok: !probe.error,
        fix: probe.error ? explain(probe.error) ?? 'The insert was rejected. Read the detail line: usually an old table has an extra NOT NULL column or a constraint.' : undefined,
        detail: probe.error?.message,
      });
      if (!probe.error) {
        const writes: [string, PromiseLike<{ error: { message: string; code?: string } | null }>, string][] = [
          ['can add a member', sb.from('members').insert({ family_code: TEST, name: 'health', role: 'parent' }), 'members table problem. Run supabase/schema.sql again.'],
          ['can save a story', sb.from('stories').insert({ family_code: TEST, year: 2000, title: 'health', content: '', author_name: 'health' }), 'stories table problem (this is why "Lưu câu chuyện" fails). Run supabase/schema.sql again.'],
          ['can save a reminder', sb.from('reminders').insert({ family_code: TEST, text: 'health', remind_time: '08:00', repeat: 'daily' }), 'Run supabase/add_reminders.sql in the Supabase SQL Editor.'],
          ['can save a shared game (memory/wheel)', sb.from('family_games').upsert({ family_code: TEST, game: 'memory', state: {} }), 'Run supabase/add_v2.sql in the Supabase SQL Editor.'],
          ['can save a member look (colour/font)', sb.from('members').update({ custom_theme: { theme: 'neon', font: 'sans' } }).eq('family_code', TEST), 'members.custom_theme could not be saved: this is why a chosen look snaps back. Run supabase/schema.sql again.'],
          ['owner column exists', sb.from('families').select('owner_id').eq('family_code', TEST), 'Run supabase/add_v2.sql in the Supabase SQL Editor.'],
        ];
        for (const [name, op, hint] of writes) {
          const { error } = await op;
          checks.push({ name, ok: !error, fix: error ? explain(error) ?? hint : undefined, detail: error?.message });
        }
        const used = await sb.rpc('consume_usage', { p_code: TEST });
        checks.push({
          name: 'function consume_usage',
          ok: !used.error && used.data?.allowed === true,
          fix: used.error ? explain(used.error) : undefined,
          detail: used.error?.message,
        });
        await sb.from('families').delete().eq('family_code', TEST); // children go with it (cascade)
      }
      const bucket = await sb.storage.getBucket('family-media');
      checks.push({
        name: 'storage bucket family-media',
        ok: !bucket.error,
        fix: bucket.error ? 'Photos and voice notes need this bucket. schema.sql creates it; or create a public bucket named family-media.' : undefined,
      });
    } catch (e) {
      checks.push({
        name: 'supabase connection',
        ok: false,
        fix: e instanceof ConfigError ? e.message : explain({ message: e instanceof Error ? e.message : String(e) }),
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Is every API file really deployed? A missing file answers 404 (an existing one answers 400, 401 or 405).
  const origin = new URL(req.url).origin;
  const expected: [string, string][] = [
    ['/api/games', 'GET'], ['/api/games/start', 'GET'], ['/api/games/memory', 'GET'], ['/api/games/wheel', 'GET'],
    ['/api/reminders', 'GET'], ['/api/families/claim', 'GET'], ['/api/me/families', 'GET'], ['/api/dictionary', 'GET'],
  ];
  for (const [path] of expected) {
    let status = 0;
    try {
      status = (await fetch(`${origin}${path}`, { cache: 'no-store' })).status;
    } catch {
      status = 0;
    }
    if (status === 404) {
      checks.push({
        name: `route ${path} is deployed`,
        ok: false,
        fix: 'This file is missing on GitHub, so it was never deployed. Compare your repository with MANIFEST.txt (see HUONG_DAN.md, section "Lỗi 404").',
      });
    }
  }

  // Only the three Supabase variables and the database are required for the app to start.
  const core = checks.filter((c) => /SUPABASE|table|function|connection|insert|member|story|game|owner|route/.test(c.name));
  return NextResponse.json({ ok: core.every((c) => c.ok), checks });
});
