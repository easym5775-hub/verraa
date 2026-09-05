-- ================================================================
-- FORGE — Add day, time, notes columns to meals table
-- for 7-day nutrition plan support
-- ================================================================

alter table public.meals
add column if not exists day integer not null default 1,
add column if not exists "time" text null,
add column if not exists notes text null;

-- Add index for faster day-based queries
create index if not exists idx_meals_client_day on public.meals (client_id, day);

-- Add check constraint for valid day values (1-7)
alter table public.meals
add constraint meals_day_check check (day >= 1 and day <= 7);
