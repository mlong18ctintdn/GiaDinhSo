// Usage: npm run seed:genz   (reads .env.local)
// Upserts src/data/genz.json into genz_dictionary. Existing words are skipped, new ones added.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
const words = JSON.parse(readFileSync(new URL('../src/data/genz.json', import.meta.url), 'utf8'));

for (let i = 0; i < words.length; i += 50) {
  const { error } = await sb
    .from('genz_dictionary')
    .upsert(words.slice(i, i + 50), { onConflict: 'word', ignoreDuplicates: true });
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
}
console.log(`Seeded ${words.length} Gen Z words.`);
