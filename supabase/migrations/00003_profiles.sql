-- Kayıt kaydı. One row per authenticated user, created by trigger on signup.
--
-- first_name, last_name, club and status are contractual: the public site's
-- club roster reads them directly and breaks silently if they are renamed or
-- dropped. It anonymises names to "Be*** An***" and shows only accepted and
-- waiting registrants.

create table public.profiles (
  id uuid references auth.users(id) on delete cascade not null primary key,

  email text,
  phone text,
  first_name text,
  last_name text,
  club text,
  gender public.gender,

  -- Görev: the duty this person registers for, one of the district's 26. This
  -- is the only field describing what someone is here as — see 00001 on why
  -- the fork's member_type is gone.
  -- Arrives from the public site as /kayit?gorev=<id>. Null until chosen — an
  -- absent or unknown parameter is not an error, it just leaves the field
  -- unset. Labels, group headings and display order live in code alongside
  -- this list; the id is what is stored.
  gorev text
    check (gorev is null or gorev in (
      -- Kulüp
      'baskan-2627', 'gecmis-baskan', 'baskan-2728', 'sekreter', 'sayman',
      'vakif-komite-bsk', 'uyelik-komite-bsk', 'komite-bsk', 'uye',
      -- Bölge
      'guvernor', 'gecmis-guvernor', 'gelecek-guvernor', 'guvernor-adayi',
      'bolge-gorevlisi', 'bolge-komite-uyesi',
      -- Rotaract
      'rotaractor', 'brt', 'brt-gelecek', 'brt-gecmis', 'bolge-gorevlisi-rotaract',
      -- Interact
      'interactor', 'bit', 'bit-gelecek', 'bit-gecmis', 'bolge-gorevlisi-interact',
      -- Misafir
      'misafir'
    )),

  -- Paket. Text, matching the nine contractual ids — not a uuid.
  package_id text references public.packages(id),

  -- The kayıt dönemi in force when the registration was completed. Set
  -- server-side from the active pricing_periods row, never client-supplied.
  pricing_type public.pricing_type,

  dekont_url text,
  status public.user_status not null default 'waiting',
  role public.user_role not null default 'user',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_role on public.profiles(role);
create index idx_profiles_status on public.profiles(status);
create index idx_profiles_gorev on public.profiles(gorev);

-- Auto-create a profile row when a new user signs up via auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'user')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- RLS. A registrant sees and edits only their own row. District staff read
-- through the service role (lib/supabase/admin.ts), which bypasses RLS —
-- there is deliberately no admin policy here.
alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
