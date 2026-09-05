import { createHash } from 'node:crypto';

export function batchFiles(uid, requestId, label, amount) {
  if (!uid || !/^[a-f0-9-]{36}$/.test(requestId)) throw new Error('Invalid batch identity.');
  const prefix = String(label || 'nyx').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'nyx';
  return Array.from({ length: amount }, (_, index) => {
    const suffix = createHash('sha256').update(JSON.stringify([uid, requestId, prefix, amount, index])).digest('hex').slice(0, 32);
    return prefix + '-learning-' + suffix + '.svg';
  });
}

export function inspectBatchTree(tree, files, svg) {
  if (tree.truncated || !Array.isArray(tree.tree)) throw Object.assign(new Error('Repository is too large to verify safely. Publishing paused.'), { status: 409 });
  const blobs = tree.tree.filter(item => item.type === 'blob');
  const byPath = new Map(blobs.map(item => [item.path, item]));
  const bytes = Buffer.byteLength(svg);
  const sha = createHash('sha1').update('blob ' + bytes + '\0').update(svg).digest('hex');
  const found = files.filter(file => byPath.has(file));
  if (found.length) {
    if (found.length !== files.length || found.some(file => byPath.get(file).sha !== sha)) throw Object.assign(new Error('This batch conflicts with existing files. Publishing paused.'), { status: 409 });
    return true;
  }
  // Leave headroom below the CDN package-size ceiling. Never roll into other
  // repositories automatically to sidestep capacity restrictions.
  if (blobs.some(item => !Number.isSafeInteger(item.size) || item.size < 0)) throw Object.assign(new Error('Repository size could not be verified. Publishing paused.'), { status: 409 });
  if (blobs.length + files.length > 100_000 || blobs.reduce((sum, item) => sum + (Number(item.size) || 0), 0) + files.length * bytes > 140_000_000) {
    throw Object.assign(new Error('The repository has reached its safe file or size capacity. Download completed links; this job cannot continue here.'), { status: 409 });
  }
  return false;
}
