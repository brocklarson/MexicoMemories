-- Edit suggestions and deletion requests. Run once in the Supabase SQL Editor.
--
-- Any member can ask for a memory to be edited or deleted. Only the admin sees the
-- requests and approves or denies them. Approving applies the change.

create table public.requests (
  id           uuid primary key default gen_random_uuid(),
  memory_id    uuid not null references public.memories (id) on delete cascade,
  requester_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind         text not null check (kind in ('edit', 'delete')),
  new_text     text,   -- the suggested wording (edit requests only)
  reason       text check (char_length(reason) <= 300),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  check (
    (kind = 'edit'   and char_length(btrim(new_text)) between 1 and 1000) or
    (kind = 'delete' and new_text is null)
  )
);
-- One open request of each kind per person per memory.
create unique index requests_one_pending
  on public.requests (memory_id, requester_id, kind) where status = 'pending';
create index requests_pending_idx on public.requests (created_at) where status = 'pending';

-- At most 20 open requests per person.
create function public.enforce_request_limits()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.requests
        where requester_id = new.requester_id and status = 'pending') >= 20 then
    raise exception 'You have too many open requests. Wait for the admin to review them.';
  end if;
  return new;
end;
$$;

create trigger requests_limits
before insert on public.requests
for each row execute function public.enforce_request_limits();

-- Approve or deny a request (admin only). Approving an edit replaces the memory's
-- text; approving a deletion deletes the memory (and any other open requests for it).
create function public.resolve_request(request_id uuid, approve boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.requests;
begin
  if not public.is_admin() then
    raise exception 'Only the admin can review requests.' using errcode = '42501';
  end if;

  select * into r from public.requests where id = request_id and status = 'pending' for update;
  if not found then
    raise exception 'This request was already handled.';
  end if;

  if approve and r.kind = 'edit' then
    update public.memories set body = btrim(r.new_text) where id = r.memory_id;
  elsif approve then
    delete from public.memories where id = r.memory_id;
  end if;

  update public.requests
  set status = case when approve then 'approved' else 'denied' end, resolved_at = now()
  where id = request_id;
end;
$$;

revoke execute on function public.enforce_request_limits()     from public, anon, authenticated;
revoke execute on function public.resolve_request(uuid, boolean) from public, anon;
grant  execute on function public.resolve_request(uuid, boolean) to authenticated;

alter table public.requests enable row level security;
revoke all on public.requests from anon, authenticated;
grant select on public.requests to authenticated;
grant insert (memory_id, kind, new_text, reason) on public.requests to authenticated;

create policy "see own requests, admin sees all" on public.requests
  for select to authenticated
  using (requester_id = (select auth.uid()) or public.is_admin());
create policy "members make their own requests" on public.requests
  for insert to authenticated
  with check (requester_id = (select auth.uid()));
