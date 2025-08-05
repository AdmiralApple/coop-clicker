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