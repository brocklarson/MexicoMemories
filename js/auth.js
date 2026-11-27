// Sign-up, sign-in, sign-out, and password reset. Wraps Supabase Auth and turns its
// errors into messages a visitor can act on.

import { supabase } from './supabase.js';

// Where links in Supabase emails send people back to (this page, without the hash).
const SITE_URL = location.origin + location.pathname;

const ERROR_MESSAGES = {
  invalid_credentials: 'The email or password is incorrect.',
  email_not_confirmed: 'Confirm your email first. Check your inbox for the link.',
  user_already_exists: 'An account with this email already exists. Sign in instead.',
  weak_password: 'Choose a longer or less common password.',
  over_request_rate_limit: 'Too many attempts. Wait a few minutes and try again.',
  over_email_send_rate_limit: 'Too many emails sent. Wait a while and try again.',
  same_password: 'Choose a password you haven’t used here before.',
  reauthentication_needed: 'For security, sign out and sign in again, then change your password.',
};

function friendly(error, fallback = 'Something went wrong. Try again.') {
  if (ERROR_MESSAGES[error.code]) return ERROR_MESSAGES[error.code];
  if (error.status === 429) return ERROR_MESSAGES.over_request_rate_limit;
  return fallback;
}

/** Calls callback(event, session) on sign-in, sign-out, password recovery, and at startup. */
export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange(callback);
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Resolves to { needsConfirmation }. If email confirmation is off, the visitor is signed in. */
export async function signUp({ email, password, displayName, inviteCode }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: SITE_URL,
      // The database checks the invite code and creates the profile from these.
      data: { display_name: displayName, invite_code: inviteCode },
    },
  });
  if (error) {
    // The database refuses sign-ups with a wrong invite code, which Supabase reports as
    // a generic database error.
    throw new Error(friendly(error, 'Couldn’t create the account. Check that your invite code is correct.'));
  }
  return { needsConfirmation: !data.session };
}

export async function signIn({ email, password }) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendly(error));
}

export async function signOut() {
  await supabase.auth.signOut();
}

/** Emails a reset link. Doesn't reveal whether the address has an account. */
export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL });
  if (error && (error.status === 429 || error.code?.startsWith('over_'))) throw new Error(friendly(error));
}

/**
 * Permanently deletes the signed-in person's account. Their memories stay (shown as
 * "[deleted]"). Asks for the password again first, then signs them out.
 */
export async function deleteAccount({ email, password }) {
  const check = await supabase.auth.signInWithPassword({ email, password });
  if (check.error) {
    throw new Error(check.error.code === 'invalid_credentials' ? 'That password is incorrect.' : friendly(check.error));
  }

  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    // P0001 is a message we wrote in the database (e.g. "you are the only admin").
    throw new Error(error.code === 'P0001' ? error.message : 'Couldn’t delete the account. Try again.');
  }
  await supabase.auth.signOut();
}

/** Sets a new password for the signed-in user (used after a reset link and on the account page). */
export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(friendly(error, 'Couldn’t update the password. Try again.'));
}
