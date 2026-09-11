-- Paketler ve kayıt dönemleri.
--
-- The id is contractual: the public site links in with /kayit?paket=<id> using
-- exactly these nine ASCII strings. It is NOT a uuid — a uuid will never arrive
-- in the URL.
--
-- The three axes are konaklama (nights/capacity), tören (ceremony) and gala.
-- There is no after_party axis; the old column of that name is gone.

create table public.packages (
  id text primary key
    check (id in (
      '1k-3g', '2k-3g', '3k-3g',
      '1k-2g', '2k-2g', '3k-2g',
      'gala-toren', 'toren', 'gala'
    )),

  -- The district's own name, shown verbatim on both properties. Never
  -- shortened or prettified: someone who picked a package on the public site
  -- must recognise it in the panel's summary.
  name text not null,

  -- "group" is a reserved word and must be quoted in SQL. The name is
  -- contractual (§5 of the brief), so it stays.
  "group" text not null check ("group" in ('konaklamalı', 'konaklamasız')),

  -- Occupancy of the room, not a headcount for the registration.
  capacity integer not null check (capacity between 1 and 3),
  nights integer not null default 0 check (nights between 0 and 3),
  ceremony boolean not null,
  gala boolean not null,

  -- Nights-major display order (1/2/3 kişi across, 3 gece then 2 gece down),
  -- then the three konaklamasız packages. Panel-owned: the public site holds
  -- the same order in code. Needed because prices are null and therefore
  -- cannot order the list.
  sort_order integer not null unique,

  -- Ücretler açıklanmadı. Every price is nullable until the district issues
  -- figures; nothing may assume a number is present.
  early_bird_price integer,
  early_bird_installment_price integer,
  round_1_price integer,
  round_1_installment_price integer,
  round_2_price integer,
  round_2_installment_price integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.packages enable row level security;

create policy "Anyone can read packages"
  on public.packages for select
  using (true);

create trigger set_packages_updated_at
  before update on public.packages
  for each row execute function public.update_updated_at_column();

-- The nine packages. Fixed reference data issued by the district, so they are
-- seeded here rather than left to a seed script. Prices are deliberately null.
insert into public.packages (id, name, "group", capacity, nights, ceremony, gala, sort_order) values
  ('1k-3g',      '1 Kişi • 3 Gece Konaklama',        'konaklamalı',  1, 3, true,  true,  1),
  ('2k-3g',      '2 Kişi • 3 Gece Konaklama',        'konaklamalı',  2, 3, true,  true,  2),
  ('3k-3g',      '3 Kişi • 3 Gece Konaklama',        'konaklamalı',  3, 3, true,  true,  3),
  ('1k-2g',      '1 Kişi • 2 Gece Konaklama',        'konaklamalı',  1, 2, true,  true,  4),
  ('2k-2g',      '2 Kişi • 2 Gece Konaklama',        'konaklamalı',  2, 2, true,  true,  5),
  ('3k-2g',      '3 Kişi • 2 Gece Konaklama',        'konaklamalı',  3, 2, true,  true,  6),
  ('gala-toren', 'Gala + Tören • Konaklama Hariç',   'konaklamasız', 1, 0, true,  true,  7),
  ('toren',      'Tören • Konaklama ve Gala Hariç',  'konaklamasız', 1, 0, true,  false, 8),
  ('gala',       'Gala • Konaklama ve Tören Hariç',  'konaklamasız', 1, 0, false, true,  9);

-- Kayıt dönemleri. The public site's period bar reads this table: the active
-- window is the row whose starts_at/ends_at contains now(). Keep the windows
-- contiguous and non-overlapping — a gap shows no active period on the public
-- site, an overlap makes it pick the first match.
--
-- Deliberately left EMPTY. The district has not issued registration dates and
-- inventing them would put a wrong window on the public site. Note that
-- lib/actions/auth.ts refuses signup while no period is active, so signup stays
-- closed until real dates are inserted.
create table public.pricing_periods (
  id public.pricing_type primary key,
  label text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check (ends_at > starts_at)
);

alter table public.pricing_periods enable row level security;

create policy "Anyone can read pricing periods"
  on public.pricing_periods for select
  using (true);
