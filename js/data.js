// The ONLY module that knows where data comes from.
//
// Right now it reads from in-memory mock data. In Phase 2 the bodies of these
// functions get replaced with Supabase calls; their names, arguments, and return
// shapes stay the same, so no other file needs to change.
//
// Shapes:
//   Event  { id, name, startDate, endDate, albumUrl|null, location: { label|null, lat, lng } }
//          label is null for a dropped pin with no place name; the UI shows coordinates instead.
//   Memory { id, eventId, authorName|null, createdAt, text }
//          authorName is null when the author's account was deleted.

import { EVENTS, MEMORIES } from './mock-data.js';
import { searchTerms } from './util.js';

// Limits are enforced again in the database later; these give friendly errors up front.
export const MAX_MEMORY_LENGTH = 1000;
export const MAX_MEMORIES_PER_EVENT = 200;

const events = [...EVENTS];
const memories = [...MEMORIES];

/** All events, newest first. */
export async function getEvents() {
  return [...events].sort((a, b) => b.startDate.localeCompare(a.startDate));
}

/** One event by id, or null if it doesn't exist. */
export async function getEvent(id) {
  return events.find((event) => event.id === id) ?? null;
}

/** Memories for an event, newest first. */
export async function getMemories(eventId) {
  return memories
    .filter((memory) => memory.eventId === eventId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Search memory text and author names, newest first. Every word in `query` must appear.
 * Pass `eventId` to search one event; omit it to search all events.
 * (With Supabase this becomes an ilike / full-text query.)
 */
export async function searchMemories({ query, eventId = null }) {
  const terms = searchTerms(query);
  if (!terms.length) return [];
  return memories
    .filter((memory) => !eventId || memory.eventId === eventId)
    .filter((memory) => {
      const haystack = `${memory.text} ${memory.authorName ?? ''}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Add a memory. Throws an Error with a user-friendly message if it isn't allowed. */
export async function addMemory({ eventId, text }) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Write something before adding your memory.');
  if (trimmed.length > MAX_MEMORY_LENGTH) {
    throw new Error(`Memories can be up to ${MAX_MEMORY_LENGTH} characters.`);
  }
  if (memories.filter((memory) => memory.eventId === eventId).length >= MAX_MEMORIES_PER_EVENT) {
    throw new Error('This event has reached its memory limit.');
  }

  const memory = {
    id: crypto.randomUUID(),
    eventId,
    authorName: 'Preview visitor', // Phase 3: the signed-in user's display name
    createdAt: new Date().toISOString(),
    text: trimmed,
  };
  memories.push(memory);
  return memory;
}
