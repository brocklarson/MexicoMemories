// The account button in the top bar: shows who is signed in, links to the account
// page, and lets them sign out.

const menu = document.getElementById('user-menu');
const nameLabel = document.getElementById('user-name');
const accountLink = document.getElementById('account-link');
const requestsLink = document.getElementById('requests-link');
const requestsCount = document.getElementById('requests-count');
const requestsDot = document.getElementById('requests-dot');
const signOutButton = document.getElementById('sign-out');

export function initAccountMenu(onSignOut) {
  accountLink.addEventListener('click', () => {
    menu.open = false;
  });
  requestsLink.addEventListener('click', () => {
    menu.open = false;
  });
  signOutButton.addEventListener('click', () => {
    menu.open = false;
    onSignOut();
  });
}

export function setAccountName(displayName) {
  nameLabel.textContent = displayName;
}

/** Admin only: shows the "Review requests" link, with a count (and a dot on the button) when some are waiting. */
export function setRequestsBadge({ isAdmin, count }) {
  requestsLink.hidden = !isAdmin;
  requestsCount.textContent = count;
  requestsCount.hidden = !count;
  requestsDot.hidden = !isAdmin || !count;
}
