-- Lets a signed-in person delete their own account from the website.
-- Run once in the Supabase SQL Editor.
--
-- Deleting the account removes their profile too, and the database then sets the
-- author of each memory they wrote to "none" (the site shows "[deleted]").
-- The memories themselves are kept.
--
-- The last remaining admin can't delete their account, so the site is never left
-- without an admin.

create function public.delete_my_account()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'You are not signed in.';
  end if;

  if coalesce((select p.is_admin from public.profiles p where p.id = uid), false)
     and not exists (select 1 from public.profiles p where p.is_admin and p.id <> uid) then
    raise exception 'You are the only admin. Make someone else an admin before deleting your account.';
  end if;

  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant  execute on function public.delete_my_account() to authenticated;
