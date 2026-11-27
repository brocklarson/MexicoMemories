// The ONLY module that reads or writes the database (Supabase). Everything else in the
// site asks for events and memories through these functions.
//
// Shapes returned to the rest of the site:
//   Event  { id, name, startDate, endDate, albumUrl|null, location: { label|null, lat, lng } | null }
//          label is null for a dropped pin with no place name; the UI shows coordinates instead.
//   Memory { id, eventId, authorName|null, createdAt, text }
//          authorName is null when the author's account was deleted.
//
// The database enforces the real rules (who can read or write, length and count limits).
// The checks here only give friendlier messages before a request is sent.

import { supabase } from './supabase.js';
import { slugify } from './util.js';

export const MAX_MEMORY_LENGTH = 1000; // keep in sync with supabase/01-schema.sql

const EVENT_COLUMNS = 'id, name, family, start_date, end_date, album_url, location_label, lat, lng';
const MEMORY_COLUMNS = 'id, event_id, body, created_at, author:profiles(display_name)';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

function toEvent(row) {
  return {
    id: row.id,
    name: row.name,
    family: row.family,
    startDate: row.start_date,
    endDate: row.end_date,
    albumUrl: row.album_url,
    location: row.lat == null ? null : { label: row.location_label, lat: row.lat, lng: row.lng },
  };
}

function toMemory(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    authorName: row.author?.display_name ?? null,
    createdAt: row.created_at,
    text: row.body,
  };
}

/** The signed-in person's profile: { displayName, isAdmin }. */
export async function getMyProfile(userId) {
  const row = unwrap(
    await supabase.from('profiles').select('display_name, is_admin').eq('id', userId).single(),
  );
  return { displayName: row.display_name, isAdmin: row.is_admin };
}

/**
 * Change your own display name. Memories show the author's current name, so every
 * memory you've added updates too. Returns the saved name.
 */
export async function updateMyDisplayName(userId, name) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Enter a display name.');
  if (trimmed.length > 40) throw new Error('Display names can be up to 40 characters.');

  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: trimmed })
    .eq('id', userId)
    .select('display_name');
  if (error || !data?.length) throw new Error('Couldn’t update your display name. Try again.');
  return data[0].display_name;
}

/** All events, newest first. */
export async function getEvents() {
  const rows = unwrap(
    await supabase.from('events').select(EVENT_COLUMNS).order('start_date', { ascending: false }),
  );
  return rows.map(toEvent);
}

/** One event by id, or null if it doesn't exist. */
export async function getEvent(id) {
  const row = unwrap(await supabase.from('events').select(EVENT_COLUMNS).eq('id', id).maybeSingle());
  return row ? toEvent(row) : null;
}

// ---- Events (only the admin can change these; the database enforces it) ----

// `fields` is { name, family|null, startDate, endDate, albumUrl|null, location: { label|null, lat, lng } | null }
function eventRow(fields) {
  return {
    name: fields.name,
    family: fields.family,
    start_date: fields.startDate,
    end_date: fields.endDate,
    album_url: fields.albumUrl,
    location_label: fields.location?.label ?? null,
    lat: fields.location?.lat ?? null,
    lng: fields.location?.lng ?? null,
  };
}

function eventError(error) {
  if (error.code === '42501') return new Error('Only the admin can add or edit events.');
  if (error.code === '23505') return new Error('An event with this name already exists.');
  if (error.code === '23514') return new Error('Check the name, dates, link and coordinates, then try again.');
  return new Error('Couldn’t save the event. Try again.');
}

/** Add an event. Its page address comes from the name. Returns the new event's id. */
export async function createEvent(fields) {
  const base = slugify(fields.name);
  if (!base) throw new Error('Use some letters or numbers in the event name.');

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const id = attempt === 1 ? base : `${base}-${attempt}`;
    const { error } = await supabase.from('events').insert({ id, ...eventRow(fields) });
    if (!error) return id;
    // Two different names can make the same address. Try -2, -3, ... for that case only.
    if (!(error.code === '23505' && error.message.includes('events_pkey'))) throw eventError(error);
  }
  throw new Error('Couldn’t find a free page address for this event. Try a different name.');
}

/** Save changes to an event. The id (page address) never changes. Returns the id. */
export async function updateEvent(id, fields) {
  const { data, error } = await supabase
    .from('events')
    .update(eventRow(fields))
    .eq('id', id)
    .select('id');
  if (error) throw eventError(error);
  // Without permission the database changes nothing and reports no error.
  if (!data.length) throw new Error('Only the admin can add or edit events.');
  return id;
}

/** Memories for an event, newest first. */
export async function getMemories(eventId) {
  const rows = unwrap(
    await supabase
      .from('memories')
      .select(MEMORY_COLUMNS)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false }),
  );
  return rows.map(toMemory);
}

/**
 * Search memory text and author names, newest first. Every word in `query` must appear.
 * Pass `eventId` to search one event; omit it to search all events.
 * The matching itself is the search_memories() function in the database.
 */
export async function searchMemories({ query, eventId = null }) {
  const rows = unwrap(
    await supabase.rpc('search_memories', { search_query: query, in_event_id: eventId }),
  );
  return rows.map((row) => ({
    id: row.id,
    eventId: row.event_id,
    authorName: row.author_name,
    createdAt: row.created_at,
    text: row.body,
  }));
}

/** Add a memory as the signed-in person. Throws an Error with a friendly message. */
export async function addMemory({ eventId, text }) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Write something before adding your memory.');
  if (trimmed.length > MAX_MEMORY_LENGTH) {
    throw new Error(`Memories can be up to ${MAX_MEMORY_LENGTH} characters.`);
  }

  // author_id fills in automatically from the signed-in user.
  const { error } = await supabase.from('memories').insert({ event_id: eventId, body: trimmed });
  if (error) {
    // P0001 is a limit message we wrote in the database (e.g. "memory limit reached").
    throw new Error(error.code === 'P0001' ? error.message : 'Couldn’t add your memory. Try again.');
  }
}

// ---- Requests: edit suggestions and deletion requests ----
// Any member can file one. Only the admin can see everyone's and approve or deny them.

export const MAX_REASON_LENGTH = 300; // keep in sync with supabase/04-requests.sql

/**
 * File a request for a memory. kind is 'edit' (text = the suggested wording) or
 * 'delete' (text = an optional reason).
 */
export async function createRequest({ memoryId, kind, text }) {
  const trimmed = text.trim();
  if (kind === 'edit' && !trimmed) throw new Error('Write the text you’d like to see instead.');
  if (kind === 'edit' && trimmed.length > MAX_MEMORY_LENGTH) {
    throw new Error(`Memories can be up to ${MAX_MEMORY_LENGTH} characters.`);
  }
  if (kind === 'delete' && trimmed.length > MAX_REASON_LENGTH) {
    throw new Error(`Reasons can be up to ${MAX_REASON_LENGTH} characters.`);
  }

  const { error } = await supabase.from('requests').insert({
    memory_id: memoryId,
    kind,
    new_text: kind === 'edit' ? trimmed : null,
    reason: kind === 'delete' ? trimmed || null : null,
  });
  if (!error) return;
  if (error.code === '23505') throw new Error('You already have an open request like this for this memory.');
  if (error.code === 'P0001') throw new Error(error.message); // e.g. too many open requests
  if (error.code === '23503') throw new Error('This memory no longer exists.');
  throw new Error('Couldn’t send your request. Try again.');
}

/** Open requests, oldest first (admin only; anyone else gets just their own). */
export async function getPendingRequests() {
  const rows = unwrap(
    await supabase
      .from('requests')
      .select(`
        id, kind, new_text, reason, created_at,
        requester:profiles(display_name),
        memory:memories(id, body, author:profiles(display_name), event:events(name))
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
  );
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    newText: row.new_text,
    reason: row.reason,
    createdAt: row.created_at,
    requesterName: row.requester?.display_name ?? null,
    memoryText: row.memory?.body ?? '',
    memoryAuthor: row.memory?.author?.display_name ?? null,
    eventName: row.memory?.event?.name ?? '',
  }));
}

/** How many requests are waiting for the admin. */
export async function countPendingRequests() {
  const { count, error } = await supabase
    .from('requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) throw error;
  return count ?? 0;
}

/** Approve (applies the edit or deletes the memory) or deny a request. Admin only. */
export async function resolveRequest(id, approve) {
  const { error } = await supabase.rpc('resolve_request', { request_id: id, approve });
  if (error) {
    throw new Error(error.code === 'P0001' || error.code === '42501'
      ? error.message
      : 'Couldn’t save your decision. Try again.');
  }
}
