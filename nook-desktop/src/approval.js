window.approval.receive(data => { document.getElementById('title').textContent = data.title; document.getElementById('detail').textContent = data.detail; });
document.getElementById('deny').onclick = () => window.approval.decide(false);
document.getElementById('allow').onclick = () => window.approval.decide(true);
document.addEventListener('keydown', event => { if (event.key === 'Escape') window.approval.decide(false); });
