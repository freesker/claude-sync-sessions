import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { exportSession } from '../src/core/exporter.ts';
import { importBundle } from '../src/core/importer.ts';
import type { SyncConfig } from '../src/types.ts';

function srcClaude(): { claude: string; sessionId: string } {
  const claude = fs.mkdtempSync(path.join(os.tmpdir(), 'imp-src-'));
  const proj = path.join(claude, 'projects', '-Volumes-M2-repos-app');
  fs.mkdirSync(proj, { recursive: true });
  const sessionId = 'sess-9';
  fs.writeFileSync(path.join(proj, `${sessionId}.jsonl`),
    JSON.stringify({ type: 'user', cwd: '/Volumes/M2/repos/app', sessionId, message: { role: 'user', content: 'edit /Volumes/M2/repos/app/a.ts' } }));
  fs.mkdirSync(path.join(claude, 'todos'), { recursive: true });
  fs.writeFileSync(path.join(claude, 'todos', `${sessionId}-agent-${sessionId}.json`), '[{"content":"x"}]');
  const fh = path.join(claude, 'file-history', sessionId); fs.mkdirSync(fh, { recursive: true });
  fs.writeFileSync(path.join(fh, 'h@v1'), 'snapshot');
  return { claude, sessionId };
}

const srcCfg: SyncConfig = { deviceName: 'mac', projectsRoot: '/Volumes/M2/repos', backend: 'git', gitRepoUrl: 'x', serverUrl: '' };
const dstCfg: SyncConfig = { deviceName: 'linux', projectsRoot: '/home/bob/projects', backend: 'git', gitRepoUrl: 'x', serverUrl: '' };

test('importBundle writes jsonl/todos/file-history under the target root with rewritten paths', () => {
  const { claude, sessionId } = srcClaude();
  const bundle = exportSession(sessionId, '/Volumes/M2/repos/app', srcCfg, '/Users/alice', claude);

  const dstClaude = fs.mkdtempSync(path.join(os.tmpdir(), 'imp-dst-'));
  const res = importBundle(bundle, dstCfg, '/home/bob', dstClaude, path.join(dstClaude, '..', 'backups'));
  assert.equal(res.skipped, false);

  const encoded = '-home-bob-projects-app';
  const written = fs.readFileSync(path.join(dstClaude, 'projects', encoded, `${sessionId}.jsonl`), 'utf8');
  const obj = JSON.parse(written);
  assert.equal(obj.cwd, '/home/bob/projects/app');
  assert.ok(written.includes('/home/bob/projects/app/a.ts'));
  assert.ok(fs.existsSync(path.join(dstClaude, 'todos', `${sessionId}-agent-${sessionId}.json`)));
  assert.equal(fs.readFileSync(path.join(dstClaude, 'file-history', sessionId, 'h@v1'), 'utf8'), 'snapshot');
});

test('importBundle skips when local session is newer (last-writer-wins)', () => {
  const { claude, sessionId } = srcClaude();
  const bundle = exportSession(sessionId, '/Volumes/M2/repos/app', srcCfg, '/Users/alice', claude);
  bundle.updatedAt = '2000-01-01T00:00:00.000Z'; // very old remote

  const dstClaude = fs.mkdtempSync(path.join(os.tmpdir(), 'imp-dst2-'));
  const encoded = '-home-bob-projects-app';
  const projDir = path.join(dstClaude, 'projects', encoded);
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(path.join(projDir, `${sessionId}.jsonl`), '{"local":"newer"}'); // fresh local file

  const res = importBundle(bundle, dstCfg, '/home/bob', dstClaude, path.join(dstClaude, '..', 'backups'));
  assert.equal(res.skipped, true);
});

test('importBundle backs up existing local session and overwrites when remote is newer', () => {
  const { claude, sessionId } = srcClaude();
  const bundle = exportSession(sessionId, '/Volumes/M2/repos/app', srcCfg, '/Users/alice', claude);
  bundle.updatedAt = new Date(Date.now() + 60_000).toISOString(); // remote newer than local

  const dstClaude = fs.mkdtempSync(path.join(os.tmpdir(), 'imp-bak-'));
  const backupsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bak-'));
  const encoded = '-home-bob-projects-app';
  const projDir = path.join(dstClaude, 'projects', encoded);
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(path.join(projDir, `${sessionId}.jsonl`), '{"local":"old"}');

  const res = importBundle(bundle, dstCfg, '/home/bob', dstClaude, backupsRoot);
  assert.equal(res.skipped, false);

  const written = fs.readFileSync(path.join(projDir, `${sessionId}.jsonl`), 'utf8');
  assert.ok(!written.includes('"local":"old"'), 'old content should be overwritten');

  const stamps = fs.readdirSync(backupsRoot);
  assert.equal(stamps.length, 1, 'one backup timestamp dir expected');
  const backupFile = path.join(backupsRoot, stamps[0], sessionId, `${sessionId}.jsonl`);
  assert.equal(fs.readFileSync(backupFile, 'utf8'), '{"local":"old"}', 'backup holds original content');
});

test('importBundle falls back to project name when relativeToRoot is null', () => {
  const { claude, sessionId } = srcClaude();
  const outsideCfg: SyncConfig = { ...srcCfg, projectsRoot: '/Volumes/M2/other' };
  const bundle = exportSession(sessionId, '/Volumes/M2/repos/app', outsideCfg, '/Users/alice', claude);
  assert.equal(bundle.session.project.relativeToRoot, null);

  const dstClaude = fs.mkdtempSync(path.join(os.tmpdir(), 'imp-null-'));
  const res = importBundle(bundle, dstCfg, '/home/bob', dstClaude, path.join(dstClaude, '..', 'backups'));
  assert.equal(res.targetPath, '/home/bob/projects/app');
  assert.equal(res.skipped, false);
  assert.ok(fs.existsSync(path.join(dstClaude, 'projects', '-home-bob-projects-app', `${sessionId}.jsonl`)));
});

test('importBundle rejects path-traversal in agents / todos / file-history keys', () => {
  const make = () => {
    const { claude, sessionId } = srcClaude();
    return exportSession(sessionId, '/Volumes/M2/repos/app', srcCfg, '/Users/alice', claude);
  };
  // agents key escapes the project dir
  const b1 = make();
  b1.session.agents = { '../../../../../../../../tmp/cs-escape-agent.jsonl': 'x' };
  let dst = fs.mkdtempSync(path.join(os.tmpdir(), 'trav-a-'));
  assert.throws(() => importBundle(b1, dstCfg, '/home/bob', dst, path.join(dst, '..', 'b')), /outside/i);
  assert.ok(!fs.existsSync('/tmp/cs-escape-agent.jsonl'));

  // todo filename escapes the todos dir
  const b2 = make();
  b2.session.todos = [{ filename: '../../../../../../../../tmp/cs-escape-todo.json', content: '[]' }];
  dst = fs.mkdtempSync(path.join(os.tmpdir(), 'trav-t-'));
  assert.throws(() => importBundle(b2, dstCfg, '/home/bob', dst, path.join(dst, '..', 'b')), /outside/i);
  assert.ok(!fs.existsSync('/tmp/cs-escape-todo.json'));

  // file-history rel key escapes the session's file-history dir
  const b3 = make();
  b3.session.fileHistory = { '../../../../../../../../tmp/cs-escape-fh': Buffer.from('x').toString('base64') };
  dst = fs.mkdtempSync(path.join(os.tmpdir(), 'trav-f-'));
  assert.throws(() => importBundle(b3, dstCfg, '/home/bob', dst, path.join(dst, '..', 'b')), /outside/i);
  assert.ok(!fs.existsSync('/tmp/cs-escape-fh'));
});

test('round-trip rewrites the project path embedded inside message content', () => {
  const claude = fs.mkdtempSync(path.join(os.tmpdir(), 'rtrip-'));
  const proj = path.join(claude, 'projects', '-Volumes-M2-repos-app');
  fs.mkdirSync(proj, { recursive: true });
  const sessionId = 'sess-rt';
  fs.writeFileSync(path.join(proj, `${sessionId}.jsonl`), JSON.stringify({
    type: 'tool_result', cwd: '/Volumes/M2/repos/app',
    content: 'Read /Volumes/M2/repos/app/src/index.ts successfully',
  }));

  const bundle = exportSession(sessionId, '/Volumes/M2/repos/app', srcCfg, '/Users/alice', claude);
  assert.ok(!bundle.session.messages[0].includes('/Volumes/M2/repos/app'));
  assert.ok(bundle.session.messages[0].includes('${PROJECT_ROOT}'));

  const dstClaude = fs.mkdtempSync(path.join(os.tmpdir(), 'rtrip-dst-'));
  importBundle(bundle, dstCfg, '/home/bob', dstClaude, path.join(dstClaude, '..', 'backups'));
  const written = fs.readFileSync(path.join(dstClaude, 'projects', '-home-bob-projects-app', `${sessionId}.jsonl`), 'utf8');
  const parsed = JSON.parse(written);
  assert.ok(parsed.content.includes('/home/bob/projects/app/src/index.ts'));
  assert.ok(!parsed.content.includes('/Volumes/M2/repos/app'));
});
