// The signed-out screens: sign in, create account, forgot password, and choose a new
// password (after following a reset link). Signing in or up doesn't need a callback:
// main.js hears about it from Supabase and loads the site.

import { el } from './util.js';
import { field, buildForm, onSubmit } from './forms.js';
import { signIn, signUp, requestPasswordReset, updatePassword } from './auth.js';

const TITLES = {
  signin: 'Sign in',
  signup: 'Create account',
  forgot: 'Reset your password',
  reset: 'Choose a new password',
};

/**
 * Draws the auth screen into `container`.
 * view:              'signin' | 'signup' | 'forgot' | 'reset'
 * notice:            a short message shown above the form
 * onPasswordUpdated: called after a new password is saved (reset view only)
 */
export function showAuth(container, { view = 'signin', notice = '', onPasswordUpdated } = {}) {
  const forms = {
    signin: signInForm,
    signup: signUpForm,
    forgot: forgotForm,
    reset: resetForm,
  };

  const go = (nextView, message = '') => {
    container.replaceChildren(
      el('section', { class: 'auth' },
        el('h1', { class: 'auth-title', text: TITLES[nextView] }),
        message && el('p', { class: 'form-notice', role: 'status', text: message }),
        forms[nextView]({ go, onPasswordUpdated }),
      ),
    );
  };

  go(view, notice);
}

// ---- Forms ---------------------------------------------------------------

function signInForm({ go }) {
  const form = buildForm('Sign in',
    field('email', 'Email', { type: 'email', autocomplete: 'email', required: true }),
    field('password', 'Password', { type: 'password', autocomplete: 'current-password', required: true }),
  );
  onSubmit(form, (data) => signIn({ email: data.get('email').trim(), password: data.get('password') }));
  return withLinks(form,
    linkButton('Forgot password?', () => go('forgot')),
    linkButton('Create account', () => go('signup')),
  );
}

function signUpForm({ go }) {
  const form = buildForm('Create account',
    field('display_name', 'Display name', {
      type: 'text', autocomplete: 'nickname', required: true, maxlength: 40,
      hint: 'Shown on the memories you add.',
    }),
    field('email', 'Email', { type: 'email', autocomplete: 'email', required: true }),
    field('password', 'Password', {
      type: 'password', autocomplete: 'new-password', required: true, minlength: 8,
      hint: 'At least 8 characters.',
    }),
    field('confirm', 'Confirm password', { type: 'password', autocomplete: 'new-password', required: true }),
    field('invite_code', 'Invite code', {
      type: 'text', autocomplete: 'off', required: true,
      hint: 'Ask whoever shared this site with you.',
    }),
  );
  onSubmit(form, async (data) => {
    if (data.get('password') !== data.get('confirm')) throw new Error('The two passwords don’t match.');
    const { needsConfirmation } = await signUp({
      displayName: data.get('display_name').trim(),
      email: data.get('email').trim(),
      password: data.get('password'),
      inviteCode: data.get('invite_code').trim(),
    });
    if (needsConfirmation) go('signin', 'Check your email for a confirmation link, then sign in.');
  });
  return withLinks(form, linkButton('I already have an account', () => go('signin')));
}

function forgotForm({ go }) {
  const form = buildForm('Send reset link',
    field('email', 'Email', { type: 'email', autocomplete: 'email', required: true }),
  );
  onSubmit(form, async (data) => {
    await requestPasswordReset(data.get('email').trim());
    go('signin', 'If an account exists for that email, we sent a link to reset the password. It can take a minute, and may land in your junk or spam folder.');
  });
  return withLinks(form, linkButton('Back to sign in', () => go('signin')));
}

function resetForm({ onPasswordUpdated }) {
  const form = buildForm('Save new password',
    field('password', 'New password', {
      type: 'password', autocomplete: 'new-password', required: true, minlength: 8,
      hint: 'At least 8 characters.',
    }),
    field('confirm', 'Confirm new password', { type: 'password', autocomplete: 'new-password', required: true }),
  );
  onSubmit(form, async (data) => {
    if (data.get('password') !== data.get('confirm')) throw new Error('The two passwords don’t match.');
    await updatePassword(data.get('password'));
    onPasswordUpdated();
  });
  return form;
}

// ---- Small builders ------------------------------------------------------

function linkButton(label, onclick) {
  return el('button', { type: 'button', class: 'link-btn', text: label, onclick });
}

function withLinks(form, ...links) {
  return el('div', {}, form, el('div', { class: 'auth-switch' }, ...links));
}
