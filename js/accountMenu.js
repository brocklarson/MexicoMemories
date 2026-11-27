// The account button in the top bar: shows who is signed in and lets them sign out.
// (Password, email, and display-name settings will be added here later.)

const menu = document.getElementById('user-menu');
const nameLabel = document.getElementById('user-name');
const signOutButton = document.getElementById('sign-out');

export function initAccountMenu(onSignOut) {
  signOutButton.addEventListener('click', () => {
    menu.open = false;
    onSignOut();
  });
}

export function setAccountName(displayName) {
  nameLabel.textContent = displayName;
}
