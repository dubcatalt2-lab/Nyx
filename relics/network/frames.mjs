const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal: true});
export const limits = Object.freeze({frame: 34 * 1024 * 1024, body: 32 * 1024 * 1024, upload: 8 * 1024 * 1024, metadata: 64 * 1024});

export function pack(metadata, body = new Uint8Array()) {
  const description = encoder.encode(JSON.stringify(metadata));
  const bytes = body instanceof Uint8Array ? body : new Uint8Array(body);
  const length = 4 + description.length + bytes.byteLength;
  if (description.length > limits.metadata || length > limits.frame) throw new Error('Message exceeds the size limit');
  const result = new Uint8Array(length + 4);
  const view = new DataView(result.buffer);
  view.setUint32(0, length);
  view.setUint32(4, description.length);
  result.set(description, 8);
  result.set(bytes, 8 + description.length);
  return result;
}

export function unpack(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength < 8 || bytes.byteLength > limits.frame + 4) throw new Error('Invalid message size');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const length = view.getUint32(0), descriptionLength = view.getUint32(4);
  if (length !== bytes.byteLength - 4 || descriptionLength > limits.metadata || descriptionLength > length - 4) throw new Error('Invalid message length');
  const metadata = JSON.parse(decoder.decode(bytes.subarray(8, 8 + descriptionLength)));
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) || !Number.isSafeInteger(metadata.id) || metadata.id < 1 || typeof metadata.kind !== 'string') throw new Error('Invalid message fields');
  return {metadata, body: bytes.subarray(8 + descriptionLength)};
}
