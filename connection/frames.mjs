const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal: true});
export const limits = Object.freeze({metadata: 65536, upload: 8388608, body: 33554432});

export function pack(id, type, metadata, body = new Uint8Array()) {
  if (!Number.isInteger(id) || id < 1 || id > 0xffffffff || ![0, 1].includes(type)) throw new Error('Invalid message identity');
  const text = encoder.encode(JSON.stringify(metadata));
  const bytes = body instanceof Uint8Array ? body : new Uint8Array(body);
  if (text.length > limits.metadata || bytes.length > limits.body) throw new Error('Message exceeds size limit');
  const output = new Uint8Array(9 + text.length + bytes.length);
  const view = new DataView(output.buffer);
  view.setUint32(0, id, true);
  view.setUint8(4, type);
  view.setUint32(5, text.length, true);
  output.set(text, 9);
  output.set(bytes, 9 + text.length);
  return output;
}

export function unpack(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength < 9 || bytes.byteLength > limits.body + limits.metadata + 9) throw new Error('Invalid message size');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const id = view.getUint32(0, true), type = view.getUint8(4), length = view.getUint32(5, true);
  if (!id || type > 1 || length > limits.metadata || length > bytes.length - 9) throw new Error('Invalid message fields');
  const metadata = JSON.parse(decoder.decode(bytes.subarray(9, 9 + length)));
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('Invalid metadata');
  return {id, type, metadata, body: bytes.subarray(9 + length)};
}

