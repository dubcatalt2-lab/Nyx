import { createFile } from 'mp4box';

const MB = 1024 ** 2;
const MAX_SAMPLES = 1_000_000;
const invalid = () => Object.assign(new Error('This video has an unsupported playback index.'), { code: 'video', status: 422 });

// Read MP4 metadata without crossing the media payload, including moov-at-end files.
export async function readMp4Index(read, kind) {
  let offset = 0, total = Infinity, ftyp, moov;
  for (let atoms = 0; atoms < 128 && offset < total && !moov; atoms++) {
    const header = await read(offset, offset + 15);
    total = header.total;
    if (header.data.length < 8) throw invalid();
    const type = header.data.toString('ascii', 4, 8);
    let size = header.data.readUInt32BE(0);
    if (size === 1) { if (header.data.length < 16) throw invalid(); size = Number(header.data.readBigUInt64BE(8)); }
    if (size === 0) size = total - offset;
    if (!Number.isSafeInteger(size) || size < 8 || offset + size > total) throw invalid();
    if (type === 'ftyp' || type === 'moov') {
      if (size > (type === 'ftyp' ? 4096 : 12 * MB)) throw invalid();
      const box = (await read(offset, offset + size - 1)).data;
      if (box.length !== size) throw invalid();
      if (type === 'ftyp') ftyp = box; else moov = box;
    }
    offset += size;
  }
  if (!ftyp || !moov) throw invalid();
  let boxes = 0;
  function validate(data, start = 0, end = data.length) {
    for (let at = start; at < end;) {
      if (++boxes > 4096 || at + 8 > end) throw invalid();
      const size = data.readUInt32BE(at), type = data.toString('ascii', at + 4, at + 8);
      if (size < 8 || at + size > end) throw invalid();
      if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) validate(data, at + 8, at + size);
      if (['stsz', 'stz2'].includes(type) && (size < 20 || data.readUInt32BE(at + 16) > MAX_SAMPLES)) throw invalid();
      at += size;
    }
  }
  validate(moov);
  const file = createFile(false);
  let info, parseError;
  file.onReady = value => { info = value; };
  file.onError = () => { parseError = true; };
  const bytes = Buffer.concat([ftyp, moov]);
  const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length); input.fileStart = 0;
  file.appendBuffer(input);
  if (!info || parseError) throw invalid();
  const track = (kind === 'video' ? info.videoTracks : info.audioTracks)?.[0];
  if (!track || !(kind === 'video' ? /^avc1\./ : /^mp4a\./).test(track.codec)) throw invalid();
  if (!Number.isSafeInteger(track.timescale) || track.timescale <= 0) throw invalid();
  if (info.isFragmented) {
    // YouTube's adaptive MP4s already contain independently playable moof/mdat
    // fragments. Their sidx lets us reuse those bytes directly, with no remux.
    if (info.tracks.length !== 1) throw invalid();
    for (let atoms = 0; atoms < 128 && offset < total; atoms++) {
      const header = (await read(offset, offset + 15)).data;
      if (header.length < 8) throw invalid();
      const size = header.readUInt32BE(0), type = header.toString('ascii', 4, 8);
      if (size < 8 || offset + size > total || ['moof','mdat'].includes(type)) throw invalid();
      if (type === 'sidx') {
        if (size > MB) throw invalid();
        const data = (await read(offset, offset + size - 1)).data, version = data[8];
        if (data.length !== size || ![0,1].includes(version) || size < (version ? 40 : 32)) throw invalid();
        const timescale = data.readUInt32BE(16), count = data.readUInt16BE(version ? 38 : 30);
        const earliest = version ? Number(data.readBigUInt64BE(20)) : data.readUInt32BE(20);
        const skip = version ? Number(data.readBigUInt64BE(28)) : data.readUInt32BE(24);
        if (!timescale || !count || count > 20000 || !Number.isSafeInteger(skip) || !Number.isSafeInteger(earliest)
          || size !== (version ? 40 : 32) + count * 12) throw invalid();
        let start = offset + size + skip;
        const segments = [], offsets = new Float64Array(count), sizes = new Uint32Array(count);
        for (let i = 0; i < count; i++) {
          const at = (version ? 40 : 32) + i * 12, length = data.readUInt32BE(at), duration = data.readUInt32BE(at + 4) / timescale;
          const sap = data.readUInt32BE(at + 8);
          if (length & 0x80000000 || !length || !Number.isSafeInteger(start) || start + length > total || duration <= 0 || duration > 60
            || (kind === 'video' && (!(sap & 0x80000000) || ![0,1,2].includes((sap >>> 28) & 7)))) throw invalid();
          offsets[i] = start; sizes[i] = length;
          segments.push({ offset: start, length, duration }); start += length;
        }
        return { kind, id: track.id, codec: track.codec, timescale: track.timescale, edit: 0, total, count,
          fragmented: true, init: bytes, offset: offsets, size: sizes, segments, bytes: bytes.length + count * 48 };
      }
      offset += size;
    }
    throw invalid();
  }
  const samples = file.getTrackSamplesInfo(track.id);
  if (!samples?.length || samples.length > MAX_SAMPLES) throw invalid();
  const edits = track.edits || [];
  if (edits.length > 1 || (edits.length && (edits[0].media_time < 0 || edits[0].media_rate_integer !== 1))) throw invalid();
  const edit = edits[0]?.media_time || 0, n = samples.length;
  const index = { kind, id: track.id, timescale: track.timescale, codec: track.codec, edit, total,
    offset: new Float64Array(n), dts: new Float64Array(n), cto: new Int32Array(n),
    size: new Uint32Array(n), duration: new Uint32Array(n), sync: new Uint8Array(n), count: n };
  if (!Number.isSafeInteger(track.timescale) || track.timescale <= 0) throw invalid();
  for (let i = 0; i < n; i++) {
    const s = samples[i], cto = s.cts - s.dts;
    if (![s.offset, s.size, s.dts, s.duration, cto].every(Number.isSafeInteger)
      || s.offset < 0 || s.size <= 0 || s.size > 16 * MB || s.offset + s.size > total
      || s.duration <= 0 || s.duration > 0xffffffff || s.dts < 0 || Math.abs(cto) > 0x7fffffff
      || s.description_index !== samples[0].description_index
      || (i && s.dts !== samples[i - 1].dts + samples[i - 1].duration)) throw invalid();
    index.offset[i] = s.offset; index.size[i] = s.size; index.dts[i] = s.dts;
    index.cto[i] = cto; index.duration[i] = s.duration; index.sync[i] = s.is_sync ? 1 : 0;
  }
  // Timeline adjustment is applied to fragments, so the init must not apply edits twice.
  const trak = file.getTrackById(track.id);
  if (trak.edts) { trak.boxes = trak.boxes.filter(box => box !== trak.edts); delete trak.edts; }
  file.onSegment = () => {};
  file.setSegmentOptions(track.id, null, { nbSamples: 1 });
  const init = file.initializeSegmentation('per-track').find(item => item.id === track.id);
  index.init = Buffer.from(init.buffer);
  index.bytes = n * 29 + index.init.length;
  return index;
}

export function segmentTrack(index, targetSeconds = 6) {
  if (index.fragmented) return index.segments;
  const starts = [0];
  for (let i = 1; i < index.count; i++) {
    if ((index.kind === 'audio' || index.sync[i]) && (index.dts[i] - index.dts[starts.at(-1)]) / index.timescale >= targetSeconds) starts.push(i);
  }
  starts.push(index.count);
  return starts.slice(0, -1).map((start, i) => {
    const end = starts[i + 1];
    const duration = (index.dts[end - 1] + index.duration[end - 1] - index.dts[start]) / index.timescale;
    if (!(duration > 0) || duration > 60 || (index.kind === 'video' && !index.sync[start])) throw invalid();
    return { start, end, duration };
  });
}

const u32 = (...values) => { const b = Buffer.alloc(values.length * 4); values.forEach((n, i) => b.writeUInt32BE(n >>> 0, i * 4)); return b; };
const box = (type, ...data) => { const body = Buffer.concat(data); return Buffer.concat([u32(body.length + 8), Buffer.from(type), body]); };
export function makeFragment(index, segment, sequence, timelineShift, data) {
  const { start, end } = segment;
  const entries = Buffer.alloc((end - start) * 16);
  let length = 0;
  for (let i = start; i < end; i++) {
    const at = (i - start) * 16;
    entries.writeUInt32BE(index.duration[i], at); entries.writeUInt32BE(index.size[i], at + 4);
    entries.writeUInt32BE(index.sync[i] ? 0x02000000 : 0x01010000, at + 8);
    entries.writeInt32BE(index.cto[i], at + 12); length += index.size[i];
  }
  if (data.length !== length) throw invalid();
  const time = Math.round(index.dts[start] - index.edit + timelineShift * index.timescale);
  if (!Number.isSafeInteger(time) || time < 0) throw invalid();
  const tfdt = Buffer.alloc(12); tfdt.writeUInt32BE(0x01000000); tfdt.writeBigUInt64BE(BigInt(time), 4);
  const moof = offset => box('moof', box('mfhd', u32(0, sequence)), box('traf',
    box('tfhd', u32(0x020000, index.id)), box('tfdt', tfdt), box('trun', u32(0x01000f01, end - start, offset), entries)));
  const header = moof(0);
  return Buffer.concat([moof(header.length + 8), box('mdat', data)]);
}
