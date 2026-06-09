import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checksum, packBundle, unpackBundle } from '../src/core/bundler.ts';
import type { Bundle, SessionPayload } from '../src/types.ts';

function sample(): Bundle {
  const session: SessionPayload = {
    sessionId: 'uuid-1',
    project: { name: 'app', relativeToRoot: 'app', tokenizedPath: '${PROJECT_ROOT}', originalPath: '/x/app' },
    messages: ['{"a":1}', '{"b":2}'],
    agents: {},
    todos: [],
    fileHistory: {},
    meta: { firstPrompt: 'hi', messageCount: 2, modified: '2026-06-06T00:00:00.000Z' },
  };
  return { version: '1', exportedAt: '2026-06-06T00:00:00.000Z', sourceDevice: 'mac', updatedAt: '2026-06-06T00:00:00.000Z', session, checksum: checksum(session) };
}

test('pack then unpack round-trips and validates checksum', () => {
  const b = sample();
  const bytes = packBundle(b);
  assert.ok(bytes.length > 0);
  const back = unpackBundle(bytes);
  assert.deepEqual(back.session.messages, b.session.messages);
  assert.equal(back.checksum, b.checksum);
});

test('unpack throws on checksum mismatch', () => {
  const b = sample();
  b.checksum = 'deadbeef';
  const bytes = packBundle(b);
  assert.throws(() => unpackBundle(bytes), /checksum/i);
});
