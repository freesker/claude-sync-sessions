import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { exportSession } from '../src/core/exporter.ts';
import type { SyncConfig } from '../src/types.ts';

function setup(): { claude: string; sessionId: string } {
  const claude = fs.mkdtempSync(path.join(os.tmpdir(), 'claudeexp-'));
  const proj = path.join(claude, 'projects', '-Volumes-M2-repos-app');
  fs.mkdirSync(proj, { recursive: true });
  const sessionId = 'sess-1';
  fs.writeFileSync(path.join(proj, `${sessionId}.jsonl`), [
    JSON.stringify({ type: 'user', cwd: '/Volumes/M2/repos/app', sessionId, message: { role: 'user', content: 'Hello in /Volumes/M2/repos/app' } }),
  ].join('\n'));
  fs.writeFileSync(path.join(proj, 'agent-x.jsonl'), JSON.stringify({ cwd: '/Volumes/M2/repos/app' }));
  fs.mkdirSync(path.join(claude, 'todos'), { recursive: true });
  fs.writeFileSync(path.join(claude, 'todos', `${sessionId}-agent-${sessionId}.json`), '[]');
  const fh = path.join(claude, 'file-history', sessionId);
  fs.mkdirSync(fh, { recursive: true });
  fs.writeFileSync(path.join(fh, 'abc@v1'), 'file contents');
  return { claude, sessionId };
}

const cfg: SyncConfig = { deviceName: 'mac', projectsRoot: '/Volumes/M2/repos', backend: 'git', gitRepoUrl: 'x', serverUrl: '' };

test('exportSession produces a tokenized, checksummed bundle', () => {
  const { claude, sessionId } = setup();
  const b = exportSession(sessionId, '/Volumes/M2/repos/app', cfg, '/Users/alice', claude);
  assert.equal(b.session.sessionId, sessionId);
  assert.equal(b.session.project.relativeToRoot, 'app');
  assert.ok(b.session.messages[0].includes('${PROJECT_ROOT}'));
  assert.ok(!b.session.messages[0].includes('/Volumes/M2/repos/app'));
  assert.ok('agent-x.jsonl' in b.session.agents);
  assert.equal(b.session.todos.length, 1);
  assert.ok(Object.keys(b.session.fileHistory).length === 1);
  assert.equal(typeof b.checksum, 'string');
});
