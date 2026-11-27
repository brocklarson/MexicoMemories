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

export const MAX_MEMORY_LENGTH = 1000; // keep in sync with supabase/01-schema.sql

const EVENT_COLUMNS = 'id, name, start_date, end_date, album_url, location_label, lat, lng';
const MEMORY_COLUMNS = 'id, event_id, body, created_at, author:profiles(display_name)';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

function toEvent(row) {
  return {
    id: row.id,
    name: row.name,
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
