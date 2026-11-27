// Creates the one Supabase client the whole site shares.
// The library loads from a CDN with an exact version, so there's no build step.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const isConfigured = !SUPABASE_KEY.startsWith('PASTE');

// Links in Supabase emails (confirm email, reset password) bring the visitor back here
// with details in the URL hash. Read them now, before the client below cleans the URL.
const linkParams = new URLSearchParams(location.hash.slice(1));
export const linkType = linkParams.get('type'); // 'recovery' for a password-reset link
export const linkError = linkParams.get('error_description'); // set when a link has expired

export const supabase = isConfigured ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
