// The account button in the top bar: shows who is signed in, links to the account
// page, and lets them sign out.

const menu = document.getElementById('user-menu');
const nameLabel = document.getElementById('user-name');
const accountLink = document.getElementById('account-link');
const signOutButton = document.getElementById('sign-out');

export function initAccountMenu(onSignOut) {
  accountLink.addEventListener('click', () => {
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
