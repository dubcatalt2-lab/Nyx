const q1 = document.querySelector('form');
q1.addEventListener('submit', async q2 => {
  q2.preventDefault();
  const q3 = q1.querySelector('button');
  const q4 = document.querySelector('[role=status]');
  q3.disabled = true;
  q4.textContent = 'Checking access…';
  try {
    const q7 = Object.fromEntries(new FormData(q1));
    q7.password = String(q7.password || '').replace(/^[\t\r\n ]+|[\t\r\n ]+$/g, '');
    const q5 = await fetch('/_q83entry/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(q7),
      credentials: 'same-origin'
    });
    if (!q5.ok) throw new Error(q5.status === 429 ? 'Too many attempts. Please wait a few minutes.' : 'Check your username and access password.');
    location.replace('/');
  } catch (q6) {
    q4.textContent = q6.message;
    q3.disabled = false;
  }
});
