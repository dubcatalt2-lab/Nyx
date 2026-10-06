import { readFileSync } from 'node:fs';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';

const MINUTE = 60_000;
const RETENTION = 1440;
const minute = value => Math.floor(value / MINUTE) * MINUTE;

// Aggregate app requests only. No addresses, paths, headers or identities are stored.
export function createAppTraffic({ file, now = Date.now, flushMs = MINUTE } = {}) {
  const buckets = new Map();
  let startedAt = now(), writeQueue = Promise.resolve(), lastPruned = null;
  const prune = () => {
    const current = minute(now());
    if (current === lastPruned) return;
    lastPruned = current;
    const first = current - (RETENTION - 1) * MINUTE;
    for (const at of buckets.keys()) if (at < first || at > current) buckets.delete(at);
  };
  try {
    if (file) {
      const raw = readFileSync(file, 'utf8');
      if (raw.length > 1024 * 1024) throw new Error('Oversized traffic history');
      const saved = JSON.parse(raw);
      if (saved.version !== 1 || !Array.isArray(saved.buckets)) throw new Error('Unknown traffic history');
      if (Number.isFinite(saved.startedAt) && saved.startedAt > 0 && saved.startedAt <= startedAt) startedAt = saved.startedAt;
      for (const b of saved.buckets.slice(-RETENTION)) {
        if (!Number.isSafeInteger(b.at) || minute(b.at) !== b.at) continue;
        if (!['requests', 'completed', 'errors', 'aborted', 'durationMs'].every(key => Number.isFinite(b[key]) && b[key] >= 0)) continue;
        buckets.set(b.at, { at:b.at, requests:b.requests, completed:b.completed, errors:b.errors, aborted:b.aborted, durationMs:b.durationMs });
        if (Number.isSafeInteger(b.onlinePeak) && b.onlinePeak >= 0 && b.onlinePeak <= 1000000
          && Number.isFinite(b.onlinePeakAt) && b.onlinePeakAt >= b.at && b.onlinePeakAt < b.at + MINUTE) {
          Object.assign(buckets.get(b.at), {onlinePeak:b.onlinePeak, onlinePeakAt:b.onlinePeakAt});
        }
      }
      prune();
    }
  } catch { /* Missing or invalid history starts a fresh, honest measurement window. */ }

  function touch(at = minute(now())) {
    const b = buckets.get(at) || { at, requests:0, completed:0, errors:0, aborted:0, durationMs:0 };
    buckets.set(at, b);
    return b;
  }
  touch();

  // Only aggregate counts persist; account IDs never leave the presence store.
  function recordOnline(count) {
    if (!Number.isSafeInteger(count) || count < 0 || count > 1000000) return;
    prune();
    const b = touch();
    if (b.onlinePeak === undefined || count > b.onlinePeak) {
      b.onlinePeak = count;
      b.onlinePeakAt = now();
    }
  }

  function middleware(req, res, next) {
    const path = String(req.url || '').split('?', 1)[0];
    if (path === '/healthz' || path === '/api/owner-dashboard/traffic') return next();
    const began = now(), at = minute(began);
    prune();
    const b = touch(at);
    b.requests++;
    let settled = false;
    const finish = aborted => {
      if (settled) return;
      settled = true;
      if (aborted) b.aborted++;
      else {
        b.completed++;
        b.durationMs += Math.max(0, now() - began);
        if (res.statusCode >= 500) b.errors++;
      }
    };
    res.once('finish', () => finish(false));
    res.once('close', () => finish(!res.writableFinished));
    next();
  }

  function snapshot(requestedMinutes = 60) {
    const minutes = [60, 360, 1440].includes(Number(requestedMinutes)) ? Number(requestedMinutes) : 60;
    prune();
    touch();
    const generatedAt = now(), end = minute(generatedAt), first = end - (minutes - 1) * MINUTE;
    const points = Array.from({ length:minutes }, (_, index) => {
      const at = first + index * MINUTE;
      const b = buckets.get(at);
      const known = Boolean(b);
      return { at, requests:known ? b?.requests || 0 : null, errors:known ? b?.errors || 0 : null,
        aborted:known ? b?.aborted || 0 : null, completed:b?.completed || 0,
        durationMs:b?.durationMs || 0, onlinePeak:b?.onlinePeak ?? null, onlinePeakAt:b?.onlinePeakAt ?? null,
        partial:at === end || (at === minute(startedAt) && startedAt !== at) };
    });
    const totals = points.reduce((sum, b) => {
      for (const key of ['requests', 'errors', 'aborted', 'completed', 'durationMs']) sum[key] += b[key] || 0;
      return sum;
    }, { requests:0, errors:0, aborted:0, completed:0, durationMs:0 });
    const peak = points.reduce((best, b) => b.requests !== null && (!best || b.requests > best.requests) ? b : best, null);
    const members = points.reduce((best,b) => b.onlinePeak !== null && (!best || b.onlinePeak > best.onlinePeak) ? b : best, null);
    return { scope:'VPS app requests across all sites', intervalMs:MINUTE, minutes, startedAt, generatedAt,
      points, totals:{ ...totals, averageMs:totals.completed ? Math.round(totals.durationMs / totals.completed) : null },
      peak:peak ? { at:peak.at, requests:peak.requests, partial:peak.partial } : null,
      peakOnline:members ? {at:members.onlinePeakAt, count:members.onlinePeak} : null };
  }

  function flush() {
    if (!file) return Promise.resolve();
    prune();
    touch();
    const json = JSON.stringify({ version:1, startedAt, buckets:[...buckets.values()].sort((a,b) => a.at - b.at) });
    const writing = writeQueue.catch(() => {}).then(async () => {
      await mkdir(dirname(file), { recursive:true });
      await writeFile(file + '.tmp', json, { mode:0o600 });
      await rename(file + '.tmp', file);
    });
    writeQueue = writing;
    return writing;
  }
  const timer = file && flushMs > 0 ? setInterval(() => { void flush().catch(() => console.warn('App traffic history could not be saved.')); }, flushMs) : null;
  timer?.unref();
  return { middleware, snapshot, recordOnline, flush, close:async () => { clearInterval(timer); await flush(); } };
}
