// Login page controller — IIFE keeps helpers out of the global scope.
// Handles the show-password toggle, form validation, the email+password POST,
// and a placeholder Google button that explains the feature isn't configured.
(() => {
  // Pick API base: localhost dev → :3000, deployed → relative /api on Vercel.
  const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api'
    : '/api';

  // Eye icon toggles the password between hidden and revealed.
  document.getElementById('togglePassword').addEventListener('click', () => {
    const input = document.getElementById('password');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // Submit the login form: client-side validate, POST to /auth/login, persist
  // the returned tokens + user, then jump to the dashboard. Errors render inline.
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    let valid = true;

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      showError('emailError'); valid = false;
    }
    if (!password) {
      showError('passwordError'); valid = false;
    }
    if (!valid) return;

    setLoading(true);

    try {
      const res  = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Login failed.');

      localStorage.setItem('wms_token',         data.token);
      localStorage.setItem('wms_refresh_token', data.refreshToken || '');
      localStorage.setItem('wms_user',           JSON.stringify(data.user));
      window.location.href = 'dashboard.html';
    } catch (err) {
      showGlobalError(err.message);
    } finally {
      setLoading(false);
    }
  });

  document.getElementById('googleLoginBtn').addEventListener('click', () => {
    showGlobalError('Google sign-in is not configured for this installation. Use email and password instead.');
  });

  // Hide all field-level and global error messages.
  function clearErrors() {
    document.querySelectorAll('.form-error').forEach((el) => el.classList.remove('show'));
    document.getElementById('globalError').classList.remove('show');
  }

  // Reveal a field-specific error element (e.g. emailError, passwordError).
  function showError(id) {
    document.getElementById(id).classList.add('show');
  }

  // Reveal the form-level error banner with a custom message.
  function showGlobalError(msg) {
    const el = document.getElementById('globalError');
    el.textContent = msg;
    el.classList.add('show');
  }

  // Toggle the submit button between idle text and a loading spinner.
  function setLoading(loading) {
    const btn     = document.getElementById('loginBtn');
    const text    = document.getElementById('loginBtnText');
    const spinner = document.getElementById('loginSpinner');
    btn.disabled          = loading;
    text.style.display    = loading ? 'none'  : 'inline';
    spinner.style.display = loading ? 'block' : 'none';
  }

  // Redirect if already logged in
  if (localStorage.getItem('wms_token')) {
    window.location.href = 'dashboard.html';
  }
})();
