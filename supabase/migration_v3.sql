-- Gia Đình Số v3. Run once in Supabase SQL Editor. Safe to run again.
-- (Everything here is also at the end of schema.sql for brand-new projects.)

-- 1) USAGE COUNTER FIX ---------------------------------------------------------------
-- Older databases created families.usage_count as NULLABLE. NULL + 1 stays NULL, so the
-- counter never moved and the banner showed "5 left" forever. Repair it, then lock it.
update public.families set usage_count = 0 where usage_count is null;
alter table public.families alter column usage_count set default 0;
alter table public.families alter column usage_count set not null;

create or replace function public.consume_usage(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare f public.families%rowtype; v_limit constant int := 5;
begin
  select * into f from public.families where family_code = p_code for update;
  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'not_found');
  end if;
  if f.is_premium and (f.premium_expires_at is null or f.premium_expires_at > now()) then
    return jsonb_build_object('allowed', true, 'premium', true, 'usage_count', coalesce(f.usage_count, 0), 'limit', v_limit);
  end if;
  if coalesce(f.usage_count, 0) >= v_limit then
    return jsonb_build_object('allowed', false, 'reason', 'paywall', 'premium', false, 'usage_count', coalesce(f.usage_count, 0), 'limit', v_limit);
  end if;
  update public.families set usage_count = coalesce(usage_count, 0) + 1 where id = f.id;
  return jsonb_build_object('allowed', true, 'premium', false, 'usage_count', coalesce(f.usage_count, 0) + 1, 'limit', v_limit);
end $$;

create or replace function public.refund_usage(p_code text)
returns void language sql security definer set search_path = public as $$
  update public.families set usage_count = greatest(coalesce(usage_count, 0) - 1, 0)
  where family_code = p_code and not (is_premium and (premium_expires_at is null or premium_expires_at > now()));
$$;

-- 2) STORIES: fast tree --------------------------------------------------------------
create index if not exists stories_family_year_created_idx on public.stories(family_code, year, created_at desc);

-- One small row per family instead of downloading every story just to draw the tree.
create or replace function public.story_summary(p_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'years', coalesce((select jsonb_agg(jsonb_build_object('year', y.year, 'count', y.c) order by y.year)
                       from (select year, count(*)::int c from public.stories where family_code = p_code group by year) y), '[]'::jsonb),
    'authors', coalesce((select jsonb_object_agg(a.author_name, a.c)
                         from (select author_name, count(*)::int c from public.stories where family_code = p_code group by author_name) a), '{}'::jsonb)
  );
$$;

-- 3) PAYMENTS: one atomic "payment received -> PRO" step ------------------------------
create index if not exists payments_family_idx on public.payments(family_code);

create or replace function public.activate_payment(p_order_code bigint, p_paid_amount integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pay public.payments%rowtype; fam public.families%rowtype; v_days int; v_base timestamptz; v_expires timestamptz;
begin
  select * into pay from public.payments where order_code = p_order_code for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if pay.status = 'paid' then
    return jsonb_build_object('ok', true, 'already', true, 'family_code', pay.family_code);
  end if;
  if p_paid_amount < pay.amount then
    return jsonb_build_object('ok', false, 'reason', 'amount_mismatch', 'family_code', pay.family_code);
  end if;
  select * into fam from public.families where family_code = pay.family_code for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'family_missing'); end if;
  v_days := case pay.plan when 'yearly' then 365 else 30 end;
  v_base := case when fam.premium_expires_at is not null and fam.premium_expires_at > now() then fam.premium_expires_at else now() end;
  v_expires := v_base + make_interval(days => v_days);
  update public.payments set status = 'paid', paid_at = now() where order_code = p_order_code;
  update public.families set is_premium = true, plan_type = pay.plan, premium_expires_at = v_expires where id = fam.id;
  return jsonb_build_object('ok', true, 'family_code', pay.family_code, 'plan', pay.plan, 'expires_at', v_expires);
end $$;

-- 4) PERMISSIONS ---------------------------------------------------------------------
revoke execute on function public.consume_usage(text) from public, anon, authenticated;
revoke execute on function public.refund_usage(text) from public, anon, authenticated;
revoke execute on function public.story_summary(text) from public, anon, authenticated;
revoke execute on function public.activate_payment(bigint, integer) from public, anon, authenticated;
grant execute on function public.consume_usage(text) to service_role;
grant execute on function public.refund_usage(text) to service_role;
grant execute on function public.story_summary(text) to service_role;
grant execute on function public.activate_payment(bigint, integer) to service_role;

notify pgrst, 'reload schema';
