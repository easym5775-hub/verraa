-- Per-coach billing currency (USD or EGP). Applies to client subscription
-- prices, payments and revenue. Platform plan prices stay in USD.
alter table public.coaches add column if not exists currency text not null default 'EGP';
alter table public.coaches drop constraint if exists coaches_currency_check;
alter table public.coaches add constraint coaches_currency_check check (currency in ('USD', 'EGP'));

-- Currency of the signed-in coach, or of the signed-in client's coach.
create or replace function public.my_currency() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select c.currency from public.coaches c where c.id = auth.uid()),
    (select c.currency from public.clients cl join public.coaches c on c.id = cl.coach_id where cl.id = auth.uid()),
    'EGP'
  )
$$;
grant execute on function public.my_currency() to authenticated;
