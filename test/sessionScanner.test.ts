import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { scanLocalSessions, extractFirstPrompt } from '../src/core/sessionScanner.ts';

function makeClaude(): string {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-'));
  const proj = path.join(base, 'projects', '-Volumes-M2-repos-app');
  fs.mkdirSync(proj, { recursive: true });
  const lines = [
    JSON.stringify({ type: 'file-history-snapshot', messageId: 'm0' }),
    JSON.stringify({ type: 'user', isMeta: true, cwd: '/Volumes/M2/repos/app', message: { role: 'user', content: 'caveat' } }),
    JSON.stringify({ type: 'user', cwd: '/Volumes/M2/repos/app', sessionId: 'sess-1', message: { role: 'user', content: 'Fix the login bug please' } }),
    JSON.stringify({ type: 'assistant', cwd: '/Volumes/M2/repos/app', message: { role: 'assistant', content: 'ok' } }),
  ];
  fs.writeFileSync(path.join(proj, 'sess-1.jsonl'), lines.join('\n'));
  fs.writeFileSync(path.join(proj, 'agent-aaa.jsonl'), '{"type":"user"}'); // must be ignored
  return base;
}

test('extractFirstPrompt skips meta and snapshot lines', () => {
  const p = extractFirstPrompt([
    '{"type":"file-history-snapshot"}',
    '{"type":"user","isMeta":true,"message":{"role":"user","content":"caveat"}}',
    '{"type":"user","message":{"role":"user","content":"Fix the login bug please"}}',
  ]);
  assert.equal(p, 'Fix the login bug please');
});

test('scanLocalSessions lists sessions, ignores agent-*.jsonl, reads cwd', () => {
  const base = makeClaude();
  const list = scanLocalSessions(base);
  assert.equal(list.length, 1);
  const s = list[0];
  assert.equal(s.sessionId, 'sess-1');
  assert.equal(s.projectPath, '/Volumes/M2/repos/app');
  assert.equal(s.projectName, 'app');
  assert.equal(s.firstPrompt, 'Fix the login bug please');
  assert.ok(s.messageCount >= 1);
});
