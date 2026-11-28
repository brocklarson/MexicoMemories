-- Removes the start and end dates from events (dropping the columns also drops the
-- check that compared them). Run once in the Supabase SQL Editor, AFTER the new
-- version of the site is live. Existing events, memories and requests are untouched.
alter table public.events
  drop column if exists start_date,
  drop column if exists end_date;
