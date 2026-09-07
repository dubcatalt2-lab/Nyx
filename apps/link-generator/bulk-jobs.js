const HOSTS = new Set(['cdn.jsdelivr.net', 'gcore.jsdelivr.net', 'fastly.jsdelivr.net']);
export const MAX_JOB_LINKS = 100_000;

export function openJobStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('nyx.link-publish-jobs', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('records');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      resolve({
        read: () => new Promise((done, fail) => {
          const read = db.transaction('records').objectStore('records').get('job');
          read.onsuccess = () => done(read.result || null); read.onerror = () => fail(read.error);
        }),
        save: (job, batch) => new Promise((done, fail) => {
          const tx = db.transaction('records', 'readwrite'), records = tx.objectStore('records');
          records.put(job, 'job');
          if (batch) records.put(batch.links, 'batch:' + batch.id);
          tx.oncomplete = done; tx.onerror = () => fail(tx.error); tx.onabort = () => fail(tx.error || new Error('Progress could not be saved.'));
        }),
        links: job => new Promise((done, fail) => {
          const tx = db.transaction('records'), records = tx.objectStore('records'), chunks = [];
          job.batches.forEach((id, index) => {
            const request = records.get('batch:' + id);
            request.onsuccess = () => { chunks[index] = (request.result || []).join('\n') + '\n'; };
          });
          tx.oncomplete = () => done(chunks); tx.onerror = () => fail(tx.error);
        }),
        clear: () => new Promise((done, fail) => {
          const tx = db.transaction('records', 'readwrite'); tx.objectStore('records').clear();
          tx.oncomplete = done; tx.onerror = () => fail(tx.error);
        })
      });
    };
  });
}

export class BulkJob {
  constructor({ store, access, request = fetch, update = () => {}, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), uuid = () => crypto.randomUUID() }) {
    Object.assign(this, { store, access, request, update, now, sleep, uuid });
    this.paused = false;
  }
  pause() { this.paused = true; }
  async create(options) {
    if (await this.store.read()) throw new Error('A saved job already exists. Resume it or clear its saved progress first.');
    if (!Number.isSafeInteger(options.total) || options.total < 1 || options.total > MAX_JOB_LINKS || !HOSTS.has(options.host)) throw new Error('Choose up to 100,000 links and a supported CDN.');
    const user = await this.access();
    if (!user.uid) throw new Error('Sign in to your account above before starting a large job.');
    const job = { id: this.uuid(), uid: user.uid, label: options.label, host: options.host, total: options.total, completed: 0, batches: [], pending: null, nextAt: 0 };
    await this.store.save(job);
    return job;
  }
  async run() {
    let job = await this.store.read();
    if (!job) throw new Error('There is no saved job to resume.');
    this.paused = false;
    let failures = 0;
    while (!this.paused && job.completed < job.total) {
      if (job.nextAt > this.now()) {
        this.update(job, 'Waiting until ' + new Date(job.nextAt).toLocaleTimeString() + '. You can pause and return later.');
        await this.sleep(Math.min(1000, job.nextAt - this.now()));
        continue;
      }
      const user = await this.access();
      if (user.uid !== job.uid) throw new Error('Sign in to the account that started this job.');
      if (this.paused) break;
      // Save the exact batch identity BEFORE sending it. An uncertain response
      // resumes the same atomic publication rather than inventing new filenames.
      if (!job.pending) {
        job.pending = { id: this.uuid(), amount: Math.min(user.limit, 1000, job.total - job.completed), method: user.method };
        await this.store.save(job);
      }
      this.update(job, 'Publishing the next ' + job.pending.amount.toLocaleString() + ' links…');
      let response, payload;
      try {
        response = await this.request('/api/link-generator', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + user.token },
          signal: AbortSignal.timeout(120_000),
          body: JSON.stringify({ provider: 'jsdelivr', method: job.pending.method, label: job.label, amount: job.pending.amount, batchRequestId: job.pending.id })
        });
        payload = await response.json();
      } catch {
        failures++;
        job.nextAt = this.now() + Math.min(900_000, 60_000 * 2 ** (failures - 1));
        await this.store.save(job);
        if (failures >= 5) throw new Error('Connection kept failing. Progress is saved; resume later to check the same batch.');
        continue;
      }
      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          failures++;
          const retry = response.headers.get('Retry-After');
          const seconds = Number(retry) || Math.max(0, (Date.parse(retry) - this.now()) / 1000) || 60;
          job.nextAt = this.now() + Math.max(seconds * 1000, Math.min(900_000, 60_000 * 2 ** (failures - 1)));
          await this.store.save(job);
          if (failures >= 5) throw new Error('Publishing is still unavailable. Progress is saved; resume later.');
          continue;
        }
        throw new Error(payload.error || 'Publishing stopped. Your completed links are saved.');
      }
      const links = (payload.links || []).map(item => {
        const url = new URL(typeof item === 'string' ? item : item.url);
        if (url.protocol !== 'https:' || !HOSTS.has(url.hostname) || !url.pathname.startsWith('/gh/')) throw new Error('Publisher returned an unexpected link. Progress is saved.');
        url.hostname = job.host; return url.href;
      });
      if (links.length !== job.pending.amount || new Set(links).size !== links.length) throw new Error('The batch result was incomplete. Resume to check the same batch.');
      const batch = { id: job.pending.id, links };
      // One IndexedDB transaction commits links and their progress together.
      const next = { ...job, batches: [...job.batches, batch.id], completed: job.completed + links.length, pending: null,
        nextAt: Math.max(this.now() + 30_000, Number(payload.premiumCooldown?.cooldownUntil) || 0) };
      await this.store.save(next, batch);
      job = next; failures = 0;
      this.update(job, 'Saved ' + job.completed.toLocaleString() + ' published links.');
    }
    this.update(job, job.completed === job.total ? 'Complete. Your links are ready to download.' : 'Paused. Progress is saved on this device.');
    return job;
  }
}

export async function attachBulkJobs({ access }) {
  const panel = document.querySelector('[data-bulk-job]');
  const status = panel.querySelector('[data-job-status]');
  const progress = panel.querySelector('progress');
  const resume = panel.querySelector('[data-job-resume]');
  const pause = panel.querySelector('[data-job-pause]');
  const download = panel.querySelector('[data-job-download]');
  const clear = panel.querySelector('[data-job-clear]');
  if (!navigator.locks || !globalThis.indexedDB) throw new Error('Large jobs need a browser with local storage and Web Locks support.');
  const store = await openJobStore();
  let running = false;
  const update = (job, message) => {
    panel.hidden = false;
    progress.max = job?.total || 1; progress.value = job?.completed || 0;
    status.textContent = (job ? job.completed.toLocaleString() + ' / ' + job.total.toLocaleString() + ' — ' : '') + message;
    resume.disabled = running || !job || job.completed === job.total;
    pause.disabled = !running;
    clear.disabled = running || !job;
    download.disabled = !job?.completed;
  };
  const worker = new BulkJob({ store, access, update });
  const execute = async options => navigator.locks.request('nyx-link-publish-job', { ifAvailable: true }, async lock => {
    if (!lock) { update(await store.read(), 'This job is already running in another tab.'); return; }
    try {
      running = true;
      if (options) await worker.create(options);
      await worker.run();
    } catch (error) {
      update(await store.read(), error.message + ' No further batches will be sent.');
    } finally {
      running = false;
      const job = await store.read();
      resume.disabled = !job || job.completed === job.total; pause.disabled = true; clear.disabled = !job;
    }
  }).catch(error => {
    running = false;
    panel.hidden = false;
    status.textContent = 'Could not access saved progress: ' + error.message;
    pause.disabled = true;
  });
  resume.addEventListener('click', () => void execute());
  pause.addEventListener('click', () => { worker.pause(); pause.disabled = true; status.textContent = 'Pausing after the current request finishes…'; });
  download.addEventListener('click', async () => {
    try {
      const job = await store.read(), chunks = await store.links(job);
      const url = URL.createObjectURL(new Blob(chunks, { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'nyx-links-' + job.completed + '.txt';
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { status.textContent = 'Could not download: ' + error.message; }
  });
  clear.addEventListener('click', () => {
    if (!confirm('Clear this saved job and its local link list? Published files will stay online. Download your links first.')) return;
    void navigator.locks.request('nyx-link-publish-job', { ifAvailable: true }, async lock => {
      if (!lock) return;
      await store.clear(); update(null, 'Saved job cleared.');
    });
  });
  const saved = await store.read();
  if (saved) update(saved, 'Saved job found. Sign in to the same account and choose Resume.');
  return { start: options => execute(options) };
}
