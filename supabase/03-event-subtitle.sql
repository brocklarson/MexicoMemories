-- Adds the optional subtitle ("family") shown under an event's name.
-- Run once in the Supabase SQL Editor.
alter table public.events
  add column if not exists family text check (char_length(family) <= 200);
