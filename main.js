// client side logic for the cooperative clicker

document.addEventListener('DOMContentLoaded', () => {
  const counterEl = document.getElementById('counter');
  const buttonEl = document.getElementById('click-btn');

  /**
   * Fetch the current count from the serverless function.
   */
  async function fetchCount() {
    try {
      const response = await fetch('/api/counter');
      if (!response.ok) {
        throw new Error('Failed to fetch count');
      }
      const data = await response.json();
      counterEl.textContent = data.count;
    } catch (err) {
      console.error(err);
    }
  }

  /**
   * Increment the counter by making a POST request.
   */
  async function incrementCount() {
    try {
      const response = await fetch('/api/counter', {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error('Failed to increment count');
      }
      const data = await response.json();
      counterEl.textContent = data.count;
    } catch (err) {
      console.error(err);
    }
  }

  // Hook up button click to increment
  buttonEl.addEventListener('click', () => {
    incrementCount();
  });

  // Poll the server every second to update the count in case others have clicked
  setInterval(fetchCount, 1000);

  // Immediately fetch the count when the page loads
  fetchCount();
});

// AI form handling logic
(function(){
  const form = document.getElementById('aiForm');
  if (!form) return;
  const input = document.getElementById('aiPrompt');
  const status = document.getElementById('aiStatus');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = (input.value || '').trim();
    if (!prompt) return;
    status.textContent = 'Sending to AI…';
    try {
      const r = await fetch('/api/dispatch-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ai-secret': (window.__AI_SECRET || '')
        },
        body: JSON.stringify({ prompt, user: 'friend' })
      });
      if (!r.ok) throw new Error(await r.text());
      status.textContent = 'Got it! A pull request will appear shortly.';
      input.value = '';
    } catch (err) {
      status.textContent = 'Error sending prompt: ' + (err.message || err);
    }
  });
})();