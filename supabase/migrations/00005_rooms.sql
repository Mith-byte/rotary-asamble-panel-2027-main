-- Oda planlama. A room is created when someone registers with a multi-occupancy
-- package, and its creator invites the other occupants.
--
-- OPEN QUESTION: whether a multi-occupancy package registers one person (who
-- then invites others, as modelled here) or several at once is a district
-- decision that has not been made. If it turns out to be several, this table
-- and room_invitations change shape. A konaklamasız package carries no room and
-- must never reach this table.

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  capacity integer not null check (capacity between 2 and 3),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rooms enable row level security;

-- Readable by any signed-in user: needed to browse and join.
create policy "Anyone can read rooms"
  on public.rooms for select using (true);

create policy "Users can create rooms"
  on public.rooms for insert
  with check (auth.uid() = created_by);

create trigger set_rooms_updated_at
  before update on public.rooms
  for each row execute function public.update_updated_at_column();

-- Added here rather than on the profiles table itself: rooms.created_by
-- already references profiles, so the two tables are mutually dependent and
-- one side has to come second.
alter table public.profiles
  add column room_id uuid references public.rooms(id) on delete set null;

create table public.room_invitations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete cascade not null,
  invited_by uuid references public.profiles(id) on delete cascade not null,
  invited_user_id uuid references public.profiles(id) on delete cascade not null,
  status public.invitation_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One pending invitation per user per room.
create unique index idx_unique_pending_invitation
  on public.room_invitations (room_id, invited_user_id) where (status = 'pending');

alter table public.room_invitations enable row level security;

create policy "Users can read own invitations"
  on public.room_invitations for select
  using (auth.uid() = invited_by or auth.uid() = invited_user_id);

create policy "Users can insert invitations"
  on public.room_invitations for insert
  with check (auth.uid() = invited_by);

-- Both parties update: the receiver accepts or rejects, the sender cancels.
create policy "Users can update own invitations"
  on public.room_invitations for update
  using (auth.uid() = invited_by or auth.uid() = invited_user_id);

create trigger set_room_invitations_updated_at
  before update on public.room_invitations
  for each row execute function public.update_updated_at_column();
