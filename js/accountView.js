// The account page (#/account): change display name, change password, delete account.
// Email changes will be added once the site can send email to everyone.

import { el, showToast } from './util.js';
import { field, buildForm, onSubmit } from './forms.js';
import { updateMyDisplayName } from './data.js';
import { updatePassword, deleteAccount } from './auth.js';

/**
 * userId, email, displayName: who is signed in
 * onDisplayNameSaved(name):   lets the caller update the name shown in the header
 */
export function renderAccount({ userId, email, displayName, onDisplayNameSaved }) {
  return el('article', { class: 'account' },
    el('h1', { class: 'account-title', text: 'Account' }),
    el('p', { class: 'account-email', text: email }),
    nameSection(userId, displayName, onDisplayNameSaved),
    passwordSection(),
    deleteSection(email),
  );
}

function nameSection(userId, displayName, onDisplayNameSaved) {
  const form = buildForm('Save name',
    field('display_name', 'Display name', {
      id: 'account-name', type: 'text', autocomplete: 'nickname', required: true, maxlength: 40,
      value: displayName,
      hint: 'Shown on every memory you’ve added, including the ones you added before.',
    }),
  );
  onSubmit(form, async (data) => {
    const saved = await updateMyDisplayName(userId, data.get('display_name'));
    onDisplayNameSaved(saved);
    showToast('Display name updated.');
  });
  return section('Display name', null, form);
}

function passwordSection() {
  const form = buildForm('Change password',
    field('password', 'New password', {
      id: 'account-password', type: 'password', autocomplete: 'new-password', required: true, minlength: 8,
      hint: 'At least 8 characters.',
    }),
    field('confirm', 'Confirm new password', {
      id: 'account-confirm', type: 'password', autocomplete: 'new-password', required: true,
    }),
  );
  onSubmit(form, async (data) => {
    if (data.get('password') !== data.get('confirm')) throw new Error('The two passwords don’t match.');
    await updatePassword(data.get('password'));
    form.reset();
    showToast('Password changed.');
  });
  return section('Password', null, form);
}

function deleteSection(email) {
  const form = buildForm('Delete my account',
    field('password', 'Your password', {
      id: 'account-delete-password', type: 'password', autocomplete: 'current-password', required: true,
    }),
  );
  form.querySelector('button[type="submit"]').classList.replace('primary', 'danger');
  onSubmit(form, async (data) => {
    await deleteAccount({ email, password: data.get('password') });
    showToast('Your account was deleted.');
  });
  return section(
    'Delete account',
    'This can’t be undone. The memories you added stay on the site, and their author shows as “[deleted]”.',
    form,
  );
}

function section(title, intro, form) {
  return el('section', { class: 'account-section' },
    el('h2', { text: title }),
    intro && el('p', { class: 'account-intro', text: intro }),
    form,
  );
}
