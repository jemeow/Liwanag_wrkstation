// ===== AUTH MODULE =====
let currentUser = null;

function switchAuthTab(tab) {
  const loginTab = document.getElementById('tab-login');
  const signupTab = document.getElementById('tab-signup');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const indicator = document.querySelector('.tab-indicator');
  const errorEl = document.getElementById('auth-error');

  errorEl.classList.remove('show');
  errorEl.textContent = '';

  if (tab === 'login') {
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
    loginForm.classList.add('active');
    signupForm.classList.remove('active');
    indicator.classList.remove('right');
  } else {
    signupTab.classList.add('active');
    loginTab.classList.remove('active');
    signupForm.classList.add('active');
    loginForm.classList.remove('active');
    indicator.classList.add('right');
  }
}

function showAuthError(message) {
  const errorEl = document.getElementById('auth-error');
  errorEl.textContent = message;
  errorEl.classList.add('show');
  setTimeout(() => errorEl.classList.remove('show'), 5000);
}

// Login
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');

    if (!email || !password) return showAuthError('Please fill in all fields.');

    btn.disabled = true;
    btn.querySelector('span').textContent = 'Logging in...';

    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      showAuthError(getAuthErrorMessage(err.code));
    } finally {
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Log In';
    }
  });

  // Sign Up
  document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    const btn = document.getElementById('signup-btn');

    if (!email || !password || !confirm) return showAuthError('Please fill in all fields.');
    if (password !== confirm) return showAuthError('Passwords do not match.');
    if (password.length < 6) return showAuthError('Password must be at least 6 characters.');

    btn.disabled = true;
    btn.querySelector('span').textContent = 'Creating...';

    try {
      await auth.createUserWithEmailAndPassword(email, password);
    } catch (err) {
      showAuthError(getAuthErrorMessage(err.code));
    } finally {
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Create Account';
    }
  });
});

function logOut() {
  auth.signOut();
}

function getAuthErrorMessage(code) {
  const messages = {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Try again.',
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment.',
    'auth/invalid-credential': 'Invalid email or password.',
  };
  return messages[code] || 'Something went wrong. Please try again.';
}
