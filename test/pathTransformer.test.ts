import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLine, denormalizeLine } from '../src/core/pathTransformer.ts';

const src = { projectRoot: '/Volumes/M2/repos/app', home: '/Users/alice' };
const dst = { projectRoot: '/home/bob/projects/app', home: '/home/bob' };

test('normalize replaces project path and home with tokens', () => {
  const line = JSON.stringify({ cwd: '/Volumes/M2/repos/app', note: 'see /Users/alice/.zshrc' });
  const out = normalizeLine(line, src);
  assert.ok(out.includes('${PROJECT_ROOT}'));
  assert.ok(out.includes('${HOME}'));
  assert.ok(!out.includes('/Volumes/M2/repos/app'));
  assert.ok(!out.includes('/Users/alice'));
});

test('project path is normalized before home when project is under home', () => {
  const s = { projectRoot: '/Users/alice/proj/app', home: '/Users/alice' };
  const line = JSON.stringify({ cwd: '/Users/alice/proj/app' });
  const out = normalizeLine(line, s);
  assert.ok(out.includes('${PROJECT_ROOT}'));
  assert.ok(!out.includes('${HOME}/proj/app'));
});

test('denormalize substitutes target paths', () => {
  const line = JSON.stringify({ cwd: '${PROJECT_ROOT}', f: '${PROJECT_ROOT}/src/x.ts', h: '${HOME}/.zshrc' });
  const out = denormalizeLine(line, dst);
  const obj = JSON.parse(out);
  assert.equal(obj.cwd, '/home/bob/projects/app');
  assert.equal(obj.f, '/home/bob/projects/app/src/x.ts');
  assert.equal(obj.h, '/home/bob/.zshrc');
});

test('round-trip across different roots yields valid JSON with new paths', () => {
  const original = JSON.stringify({ cwd: '/Volumes/M2/repos/app', file: '/Volumes/M2/repos/app/a.ts' });
  const moved = denormalizeLine(normalizeLine(original, src), dst);
  const obj = JSON.parse(moved); // must remain valid JSON
  assert.equal(obj.cwd, '/home/bob/projects/app');
  assert.equal(obj.file, '/home/bob/projects/app/a.ts');
});

test('handles JSON-escaped windows backslashes on normalize', () => {
  const s = { projectRoot: 'C:\\Users\\bob\\app', home: 'C:\\Users\\bob' };
  const line = '{"cwd":"C:\\\\Users\\\\bob\\\\app"}'; // JSON text with escaped backslashes
  const out = normalizeLine(line, s);
  assert.ok(out.includes('${PROJECT_ROOT}'));
  assert.ok(!out.includes('Users'));
});

test('handles raw (non-JSON-escaped) windows backslashes on normalize', () => {
  const s = { projectRoot: 'C:\\Users\\bob\\app', home: 'C:\\Users\\bob' };
  // A line literally containing single backslashes (e.g. a free-text note field)
  const line = 'cwd: C:\\Users\\bob\\app shell: C:\\Users\\bob\\.zshrc';
  const out = normalizeLine(line, s);
  assert.ok(out.includes('${PROJECT_ROOT}'));
  assert.ok(out.includes('${HOME}'));
  assert.ok(!out.includes('C:\\'));
});

test('denormalize emits backslash project paths on windows without mangling other slashes', () => {
  const t = { projectRoot: 'C:/Users/bob/app', home: 'C:/Users/bob' };
  const out = denormalizeLine('{"cwd":"${PROJECT_ROOT}","f":"${PROJECT_ROOT}/a.ts","note":"see https://x.dev/p"}', t, { windows: true });
  const obj = JSON.parse(out); // must stay valid JSON
  assert.equal(obj.cwd, 'C:\\Users\\bob\\app'); // project path → native backslashes
  assert.ok(obj.f.startsWith('C:\\Users\\bob\\app')); // continuation keeps its separator (mixed is OK on Windows)
  assert.equal(obj.note, 'see https://x.dev/p'); // unrelated URL slashes are NOT touched
});

test('denormalize default (posix) behaviour is unchanged', () => {
  const t = { projectRoot: '/home/bob/app', home: '/home/bob' };
  const obj = JSON.parse(denormalizeLine('{"cwd":"${PROJECT_ROOT}"}', t));
  assert.equal(obj.cwd, '/home/bob/app');
});
