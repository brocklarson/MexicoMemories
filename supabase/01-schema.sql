-- Who can do what (members = signed-in users):
--   Members read everything, add their own memories, and edit their own display name.
--   Only the admin creates events and changes or deletes anything else.
--   People who aren't signed in get no access to any table.
-- New accounts require the invite code (see 02-invite-code.sql).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per account. Created automatically at sign-up (see handle_new_user below).
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- The id is a short URL name like 'moab-road-trip' (used in the page address).
create table public.events (
  id             text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name           text not null check (char_length(btrim(name)) between 1 and 100),
  start_date     date not null,
  end_date       date not null,
  album_url      text check (album_url is null or album_url ~* '^https?://'),
  location_label text check (char_length(location_label) <= 100),
  lat            double precision check (lat between -90 and 90),
  lng            double precision check (lng between -180 and 180),
  created_at     timestamptz not null default now(),
  check (end_date >= start_date),
  check ((lat is null) = (lng is null))  -- a pin needs both coordinates
);
create unique index events_name_unique on public.events (lower(name));

-- author_id becomes null when the author deletes their account, so the memory stays
-- and the site shows "[deleted]".
create table public.memories (
  id         uuid primary key default gen_random_uuid(),
  event_id   text not null references public.events (id) on delete cascade,
  author_id  uuid default auth.uid() references public.profiles (id) on delete set null,
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index memories_event_idx on public.memories (event_id, created_at desc);

-- Small private settings (the invite code). Nobody can reach this from the website.
create table public.app_settings (
  key   text primary key,
  value text not null
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

-- Limits: 200 memories per event, 20 per person per event.
create function public.enforce_memory_limits()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.memories where event_id = new.event_id) >= 200 then
    raise exception 'This event has reached its memory limit.';
  end if;
  if (select count(*) from public.memories
        where event_id = new.event_id and author_id = new.author_id) >= 20 then
    raise exception 'You have reached the limit of 20 memories for this event.';
  end if;
  return new;
end;
$$;

create trigger memories_limits
before insert on public.memories
for each row execute function public.enforce_memory_limits();

-- Runs after every sign-up: checks the invite code, then creates the profile.
-- If anything is wrong it raises an error, which cancels the sign-up.
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  expected text;
  given    text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
  name     text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  select lower(btrim(value)) into expected
  from public.app_settings where key = 'invite_code';

  if expected is null or given <> expected then
    raise exception 'Invalid invite code';
  end if;
  if char_length(name) not between 1 and 40 then
    raise exception 'Display name must be 1 to 40 characters';
  end if;

  insert into public.profiles (id, display_name) values (new.id, name);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Search memory text and author names. Every word must match; matching is
-- case-insensitive and works on part of a word. Newest first, at most 200 results.
create function public.search_memories(search_query text, in_event_id text default null)
returns table (id uuid, event_id text, author_name text, created_at timestamptz, body text)
language sql stable set search_path = ''
as $$
  select m.id, m.event_id, p.display_name, m.created_at, m.body
  from public.memories m
  left join public.profiles p on p.id = m.author_id
  where char_length(btrim(search_query)) >= 1
    and (in_event_id is null or m.event_id = in_event_id)
    and not exists (
      select 1
      from unnest(regexp_split_to_array(btrim(search_query), '\s+')) as term
      where term <> ''
        and (m.body || ' ' || coalesce(p.display_name, ''))
            not ilike '%' || replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  order by m.created_at desc
  limit 200;
$$;

-- Only the database itself runs these trigger functions, not the website.
revoke execute on function public.handle_new_user()        from public, anon, authenticated;
revoke execute on function public.enforce_memory_limits()  from public, anon, authenticated;
-- Members can call these.
revoke execute on function public.is_admin()                        from public, anon;
revoke execute on function public.search_memories(text, text)       from public, anon;
grant  execute on function public.is_admin()                        to authenticated;
grant  execute on function public.search_memories(text, text)       to authenticated;

-- ---------------------------------------------------------------------------
-- Permissions: table access, then row-level rules
-- ---------------------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.events       enable row level security;
alter table public.memories     enable row level security;
alter table public.app_settings enable row level security;

-- Start from nothing, then grant only what members need.
revoke all on public.profiles, public.events, public.memories, public.app_settings
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated; -- not is_admin
grant select, insert, update, delete on public.events   to authenticated;
grant select, insert, update, delete on public.memories to authenticated;
-- app_settings: no grants, no policies. Only the dashboard can read it.

-- profiles: members see names (they appear on memories); you edit only your own.
create policy "members read profiles" on public.profiles
  for select to authenticated using (true);
create policy "edit own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- events: members read; only the admin changes them.
create policy "members read events" on public.events
  for select to authenticated using (true);
create policy "admin adds events" on public.events
  for insert to authenticated with check (public.is_admin());
create policy "admin edits events" on public.events
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes events" on public.events
  for delete to authenticated using (public.is_admin());

-- memories: members read and add their own; only the admin edits or deletes.
create policy "members read memories" on public.memories
  for select to authenticated using (true);
create policy "members add own memories" on public.memories
  for insert to authenticated with check (author_id = (select auth.uid()));
create policy "admin edits memories" on public.memories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes memories" on public.memories
  for delete to authenticated using (public.is_admin());
