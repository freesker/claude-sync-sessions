import * as zlib from 'node:zlib';
import * as crypto from 'node:crypto';
import type { Bundle, SessionPayload } from '../types.ts';

export function checksum(session: SessionPayload): string {
  return crypto.createHash('sha256').update(JSON.stringify(session)).digest('hex');
}

export function packBundle(bundle: Bundle): Buffer {
  return zlib.gzipSync(Buffer.from(JSON.stringify(bundle), 'utf8'));
}

export function unpackBundle(gz: Buffer): Bundle {
  const bundle = JSON.parse(zlib.gunzipSync(gz).toString('utf8')) as Bundle;
  const expected = checksum(bundle.session);
  if (bundle.checksum !== expected) {
    throw new Error(`Bundle checksum mismatch: expected ${expected}, got ${bundle.checksum}`);
  }
  return bundle;
}
