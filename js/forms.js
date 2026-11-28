// Small form builders shared by the sign-in screens and the account page.

import { el } from './util.js';

/**
 * A labelled input. `id` defaults to auth-<name>; `hint` is small help text under it.
 * Password inputs get a Show/Hide button.
 */
export function field(name, label, { id = `auth-${name}`, hint, ...attrs }) {
  const input = el('input', { id, name, ...attrs });
  return el('div', { class: 'field' },
    el('label', { for: id, text: label }),
    attrs.type === 'password' ? withVisibilityToggle(input) : input,
    hint && el('p', { class: 'field-hint', text: hint }),
  );
}

function withVisibilityToggle(input) {
  const toggle = el('button', {
    type: 'button',
    class: 'password-toggle',
    text: 'Show',
    'aria-pressed': 'false',
    'aria-label': 'Show password',
    onclick: () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.textContent = show ? 'Hide' : 'Show';
      toggle.setAttribute('aria-pressed', String(show));
      toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    },
  });
  return el('div', { class: 'password-wrap' }, input, toggle);
}

/** A form with the given fields, an error line, and a submit button. */
export function buildForm(submitLabel, ...fields) {
  return el('form', { class: 'auth-form' },
    ...fields,
    el('p', { class: 'form-error', role: 'alert' }),
    el('button', { type: 'submit', class: 'btn primary', text: submitLabel }),
  );
}

/**
 * Runs `action(formData)` on submit: disables the button while it works and shows
 * any thrown error's message under the fields.
 */
export function onSubmit(form, action) {
  const button = form.querySelector('button[type="submit"]');
  const error = form.querySelector('.form-error');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';
    button.disabled = true;
    try {
      await action(new FormData(form));
    } catch (err) {
      error.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });
}
