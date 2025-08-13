document.addEventListener('DOMContentLoaded', () => {
    const counterEl = document.getElementById('counter');
    const buttonEl = document.getElementById('click-btn');

    async function fetchCount() {
        try {
            const res = await fetch('/api/counter');
            const { count } = await res.json();
            counterEl.textContent = count;
        } catch (err) {
            console.error(err);
        }
    }

    async function incrementCount() {
        try {
            const res = await fetch('/api/counter', { method: 'POST' });
            const { count } = await res.json();
            counterEl.textContent = count;
        } catch (err) {
            console.error(err);
        }
    }

    buttonEl.addEventListener('click', incrementCount);
    setInterval(fetchCount, 1000);
    fetchCount();
});
