-- Enum types, created first so every later table can reference them.
-- The old set defined these mid-way and left 00001 referencing types that did
-- not exist yet; keep all type creation here.

-- Panel access level. Admin actions run through the service role, which
-- bypasses RLS; this column only drives UI routing.
create type public.user_role as enum ('user', 'admin');

-- Registration state. Read by the public site's club roster.
create type public.user_status as enum ('waiting', 'accepted');

-- Kayıt dönemi. Ids are contractual: the public site's period bar reads them.
create type public.pricing_type as enum ('early_bird', 'round_1', 'round_2');

-- There is deliberately no member_type enum. The fork carried one (Başkan,
-- Asbaşkan, … , 'Rotary', 'Interact') shaped for a Rotaract conference, where
-- it meant "your post in your Rotaract club, or the other body you came from".
-- Nine of its eleven values duplicate a duty in profiles.gorev, so asking both
-- would put the same question to the registrant twice. Görev is the field.

create type public.gender as enum ('Erkek', 'Kadın');

create type public.installment_status as enum ('pending', 'accepted');

create type public.invitation_status as enum ('pending', 'accepted', 'rejected', 'cancelled');

-- Reusable updated_at trigger function, used by every table below.
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
