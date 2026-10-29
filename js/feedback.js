const feedbackForm = document.getElementById('feedbackForm');
if (feedbackForm) {
  feedbackForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = feedbackForm.querySelector('button[type="submit"]');
    const status = document.getElementById('feedbackStatus');
    button.disabled = true;
    button.textContent = 'Sending…';
    status.textContent = '';
    try {
      const payload = Object.fromEntries(new FormData(feedbackForm));
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || `The school server could not accept your feedback (HTTP ${response.status}).`);
      status.textContent = data.message;
      status.style.color = '#28a745';
      feedbackForm.reset();
    } catch (error) {
      status.textContent = error.message === 'Failed to fetch'
        ? 'Cannot reach the school server. Open the website through http://localhost:3000, then try again.'
        : error.message;
      status.style.color = '#dc3545';
    } finally {
      button.disabled = false;
      button.textContent = 'Send feedback';
    }
  });
}
