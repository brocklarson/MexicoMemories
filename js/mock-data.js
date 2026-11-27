// Fake data for Phase 1 only. Deleted when data.js switches to Supabase.
// Shapes here are the contract the rest of the UI relies on (see data.js).

export const EVENTS = [
  {
    id: 'tahoe-cabin-weekend',
    name: 'Tahoe Cabin Weekend',
    startDate: '2025-08-01',
    endDate: '2025-08-03',
    albumUrl: 'https://photos.example.com/tahoe-cabin-weekend',
    location: { label: 'Lake Tahoe, CA', lat: 39.0968, lng: -120.0324 },
  },
  {
    id: 'grandmas-80th',
    name: "Grandma's 80th Birthday",
    startDate: '2025-10-04',
    endDate: '2025-10-04',
    albumUrl: 'https://photos.example.com/grandmas-80th',
    location: { label: null, lat: 39.7392, lng: -104.9903 }, // dropped pin, no place name
  },
  {
    id: 'friendsgiving-2025',
    name: 'Friendsgiving 2025',
    startDate: '2025-11-22',
    endDate: '2025-11-22',
    albumUrl: null,
    location: { label: 'Boulder, CO', lat: 40.015, lng: -105.2705 },
  },
  {
    id: 'moab-road-trip',
    name: 'Moab Road Trip',
    startDate: '2026-04-10',
    endDate: '2026-04-14',
    albumUrl: 'https://photos.example.com/moab-road-trip',
    location: { label: 'Moab, UT', lat: 38.5733, lng: -109.5498 },
  },
  {
    id: 'maya-and-theo-wedding',
    name: "Maya & Theo's Wedding",
    startDate: '2026-06-13',
    endDate: '2026-06-14',
    albumUrl: 'https://photos.example.com/maya-and-theo',
    location: { label: 'Estes Park, CO', lat: 40.3772, lng: -105.5217 },
  },
];

// authorName is null once the author's account has been deleted.
export const MEMORIES = [
  {
    id: 'm1',
    eventId: 'tahoe-cabin-weekend',
    authorName: 'Dana R.',
    createdAt: '2025-08-04T15:20:00Z',
    text: 'Mara burned the pancakes and then insisted they were "rustic." We ate every single one anyway. Best breakfast of the summer.',
  },
  {
    id: 'm2',
    eventId: 'tahoe-cabin-weekend',
    authorName: 'Jonah K.',
    createdAt: '2025-08-05T02:41:00Z',
    text: 'The card game that somehow lasted until 3am. Still not sure who actually won, but I have been bragging about it ever since.',
  },
  {
    id: 'm3',
    eventId: 'tahoe-cabin-weekend',
    authorName: 'Priya S.',
    createdAt: '2025-08-05T18:05:00Z',
    text: 'Paddleboarding at sunrise was freezing and completely worth it. The lake was so still it looked like glass, and nobody said a word for the first ten minutes.',
  },
  {
    id: 'm4',
    eventId: 'tahoe-cabin-weekend',
    authorName: null,
    createdAt: '2025-08-06T12:00:00Z',
    text: 'Thanks for hosting, everyone. I needed that weekend more than I knew.',
  },
  {
    id: 'm5',
    eventId: 'tahoe-cabin-weekend',
    authorName: 'Mara L.',
    createdAt: '2025-08-07T09:30:00Z',
    text: 'The drive up was a mess of traffic and wrong turns, but the moment we got out of the car and smelled the pine trees, everything reset.\n\nAlso: the pancakes were NOT burned. They were caramelized.',
  },
  {
    id: 'm6',
    eventId: 'grandmas-80th',
    authorName: 'Elena V.',
    createdAt: '2025-10-05T20:10:00Z',
    text: 'Grandma pretending she did not know about the surprise, and then crying the second the lights came on. Four generations in one room.',
  },
  {
    id: 'm7',
    eventId: 'grandmas-80th',
    authorName: 'Sam V.',
    createdAt: '2025-10-06T08:45:00Z',
    text: 'She taught all the kids how to play her favorite card game and then beat every single one of us. Eighty years old and still undefeated.',
  },
  {
    id: 'm8',
    eventId: 'moab-road-trip',
    authorName: 'Jonah K.',
    createdAt: '2026-04-15T17:00:00Z',
    text: 'Watching the sunset from Dead Horse Point while everyone ate gas station snacks like it was a five-star dinner.',
  },
  {
    id: 'm9',
    eventId: 'moab-road-trip',
    authorName: 'Dana R.',
    createdAt: '2026-04-16T13:25:00Z',
    text: 'We took a wrong turn on day two and found the best taco truck of the whole trip. Some of the best plans are accidents.',
  },
  {
    id: 'm10',
    eventId: 'maya-and-theo-wedding',
    authorName: 'Priya S.',
    createdAt: '2026-06-15T10:15:00Z',
    text: 'Theo forgot his vows, so he just spoke from the heart instead. There was not a dry eye anywhere on that mountainside.',
  },
  {
    id: 'm11',
    eventId: 'maya-and-theo-wedding',
    authorName: 'Elena V.',
    createdAt: '2026-06-15T19:40:00Z',
    text: 'The whole dance floor singing along to the last song of the night, with the band long past their set time and nobody caring.',
  },
  {
    id: 'm12',
    eventId: 'maya-and-theo-wedding',
    authorName: 'Sam V.',
    createdAt: '2026-06-16T07:55:00Z',
    text: 'Maya and I made a pact at 1am to hold the photo booth hostage. We have strips from every single guest, and we are not sorry.',
  },
];
