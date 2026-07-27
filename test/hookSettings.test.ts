import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs'; import * as os from 'node:os'; import * as path from 'node:path';
import { settingsPath, hasHookEntries, removeHookEntries } from '../src/core/hookSettings.ts';

const ours = (event: string) => ({ hooks: [{ type: 'command', command: `node "/Users/me/.claude-sync-sessions/bin/hook.cjs" ${event}` }] });
const theirs = { hooks: [{ type: 'command', command: 'node /opt/other-tool/notify.js' }] };

function write(content: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hs-'));
  const p = path.join(dir, 'settings.json');
  fs.writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  return p;
}

test('settingsPath resolves under the given home', () => {
  assert.equal(settingsPath('/home/x'), path.join('/home/x', '.claude', 'settings.json'));
});

test('detects our hook entries', () => {
  assert.equal(hasHookEntries(write({ hooks: { SessionEnd: [ours('SessionEnd')] } })), true);
  assert.equal(hasHookEntries(write({ hooks: { SessionEnd: [theirs] } })), false);
  assert.equal(hasHookEntries(write({})), false);
  assert.equal(hasHookEntries(path.join(os.tmpdir(), 'nope', 'settings.json')), false);
});

test('removes our entries and keeps everyone else untouched', () => {
  const p = write({
    model: 'opus',
    hooks: { SessionEnd: [theirs, ours('SessionEnd')], SessionStart: [ours('SessionStart')], PreToolUse: [theirs] },
  });
  assert.equal(removeHookEntries(p), true);
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.deepEqual(s.hooks.SessionEnd, [theirs]);       // third-party entry survives
  assert.equal('SessionStart' in s.hooks, false);        // emptied array is dropped
  assert.deepEqual(s.hooks.PreToolUse, [theirs]);        // untouched event
  assert.equal(s.model, 'opus');                         // unrelated settings preserved
  assert.equal(hasHookEntries(p), false);
});

test('drops the hooks key entirely when we were its only content', () => {
  const p = write({ model: 'opus', hooks: { SessionEnd: [ours('SessionEnd')] } });
  assert.equal(removeHookEntries(p), true);
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.equal('hooks' in s, false);
  assert.equal(s.model, 'opus');
});

test('is a no-op when there is nothing of ours to remove', () => {
  const p = write({ hooks: { SessionEnd: [theirs] } });
  const before = fs.readFileSync(p, 'utf8');
  assert.equal(removeHookEntries(p), false);
  assert.equal(fs.readFileSync(p, 'utf8'), before);
  assert.equal(removeHookEntries(write({})), false);
});

test('never clobbers a settings file it cannot parse', () => {
  const p = write('{ this is not json');
  assert.equal(removeHookEntries(p), false);
  assert.equal(fs.readFileSync(p, 'utf8'), '{ this is not json');
});

test('tolerates a missing settings file', () => {
  assert.equal(removeHookEntries(path.join(os.tmpdir(), 'absent-dir', 'settings.json')), false);
});
