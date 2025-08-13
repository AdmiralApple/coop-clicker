document.addEventListener('DOMContentLoaded', () => {
  const counterEl = document.getElementById('counter');
  const buttonEl = document.getElementById('click-btn');
  let clickCount = 0;

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

  function createConfetti() {
    const colors = ['#FF0D72', '#0ABAB5', '#F9D423', '#FF4E50'];
    const confetti = document.createElement('div');
    confetti.classList.add('confetti');
    confetti.style.position = 'absolute';
    confetti.style.width = '10px';
    confetti.style.height = '10px';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.left = Math.random() * window.innerWidth + 'px';
    confetti.style.top = Math.random() * window.innerHeight + 'px';
    document.body.appendChild(confetti);
    setTimeout(() => {
      confetti.remove();
    }, 3000);
  }

  buttonEl.addEventListener('click', () => {
    incrementCount();
    clickCount++;
    if (clickCount >= 100) {
      createConfetti();
      clickCount = 0;
    }
  });

  setInterval(fetchCount, 1000);
  fetchCount();
});

(function(){
  const form = document.getElementById('aiForm');
  if (!form) return;
  const input = document.getElementById('aiPrompt');
  const status = document.getElementById('aiStatus');
  window.__AI_SECRET = "LEONISCOOL";
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

                                // main.js (append/replace your handler)
                                (function () {
                                  const $ = s => document.querySelector(s);
                                  const counterEl = $('#counter');
                                  const btn = $('#clickBtn');
                                  if (!counterEl || !btn) return;

                                  let count = Number(counterEl.textContent || 0) || 0;
                                  const setCount = n => { count = n; counterEl.textContent = String(n); };

                                  // Load the current value from the server on first paint
                                  fetch('/api/counter')
                                    .then(r => r.json()).then(d => setCount(Number(d.value || 0)))
                                    .catch(() => { /* keep local 0 if server down */ });

                                  btn.addEventListener('click', () => {
                                    setCount(count + 1); // instant UI
                                    // async write; don't block UI if it fails
                                    fetch('/api/counter', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ delta: 1 }),
                                      keepalive: true
                                    }).then(r => r.json())
                                      .then(d => { if (Number.isFinite(d?.value)) setCount(Number(d.value)); })
                                      .catch(() => {});
                                  });
                                })();
          'x-ai-secret': window.__AI_SECRET
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
