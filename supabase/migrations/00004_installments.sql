-- Taksitler. Up to three, the count depending on the kayıt dönemi the
-- registration was made in (see getInstallmentCount in lib/utils.ts).

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  installment_number integer not null check (installment_number between 1 and 3),
  amount integer not null,
  -- Path inside the "dekontlar" storage bucket, always <user_id>/...
  dekont_url text,
  status public.installment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, installment_number)
);

alter table public.installments enable row level security;

create policy "Users can read own installments"
  on public.installments for select
  using (auth.uid() = user_id);

create policy "Users can update own installments"
  on public.installments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can insert own installments"
  on public.installments for insert
  with check (auth.uid() = user_id);

create trigger set_installments_updated_at
  before update on public.installments
  for each row execute function public.update_updated_at_column();
