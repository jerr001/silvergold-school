const form = document.querySelector('#loginForm');
const errorBox = document.querySelector('#loginError');
fetch('/api/admin/me').then(r => { if (r.ok) location.replace('/admin/'); }).catch(() => {});
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button'); button.disabled = true; button.textContent = 'Signing in…'; errorBox.hidden = true;
  try {
    const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to sign in.');
    sessionStorage.setItem('sg-csrf', data.csrfToken); location.replace('/admin/');
  } catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; }
  finally { button.disabled = false; button.textContent = 'Sign in'; }
});
