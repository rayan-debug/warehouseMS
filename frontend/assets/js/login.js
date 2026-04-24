(() => {
  const API_BASE = 'http://localhost:3000/api';

  document.getElementById('togglePassword').addEventListener('click', () => {
    const input = document.getElementById('password');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

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

  function clearErrors() {
    document.querySelectorAll('.form-error').forEach((el) => el.classList.remove('show'));
    document.getElementById('globalError').classList.remove('show');
  }

  function showError(id) {
    document.getElementById(id).classList.add('show');
  }

  function showGlobalError(msg) {
    const el = document.getElementById('globalError');
    el.textContent = msg;
    el.classList.add('show');
  }

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
