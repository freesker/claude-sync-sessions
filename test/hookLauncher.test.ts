import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs'; import * as os from 'node:os'; import * as path from 'node:path';
import { syncLauncher, launcherPresent, removeLauncher } from '../src/core/hookLauncher.ts';
import { hookLauncherPath, hookLauncherStampPath } from '../src/config/appPaths.ts';

function fixture(body: string): { home: string; bundle: string } {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-'));
  const bundle = path.join(home, 'ext', 'out', 'hook.js');
  fs.mkdirSync(path.dirname(bundle), { recursive: true });
  fs.writeFileSync(bundle, body);
  return { home, bundle };
}

test('copies the bundle and stamps the version', () => {
  const { home, bundle } = fixture('v1');
  assert.equal(launcherPresent(home), false);
  assert.equal(syncLauncher(bundle, '0.2.1', { home }), true);
  assert.equal(fs.readFileSync(hookLauncherPath(home), 'utf8'), 'v1');
  assert.equal(fs.readFileSync(hookLauncherStampPath(home), 'utf8'), '0.2.1');
});

test('skips the copy when the stamped version already matches', () => {
  const { home, bundle } = fixture('v1');
  syncLauncher(bundle, '0.2.1', { home });
  fs.writeFileSync(bundle, 'v2');
  assert.equal(syncLauncher(bundle, '0.2.1', { home }), false);
  assert.equal(fs.readFileSync(hookLauncherPath(home), 'utf8'), 'v1');
  assert.equal(syncLauncher(bundle, '0.2.1', { home, force: true }), true);
  assert.equal(fs.readFileSync(hookLauncherPath(home), 'utf8'), 'v2');
});

test('refreshes a launcher left behind by a previous extension version', () => {
  const { home, bundle } = fixture('v1');
  syncLauncher(bundle, '0.1.0', { home });
  fs.writeFileSync(bundle, 'v2');
  assert.equal(syncLauncher(bundle, '0.2.1', { home }), true);
  assert.equal(fs.readFileSync(hookLauncherPath(home), 'utf8'), 'v2');
  assert.equal(fs.readFileSync(hookLauncherStampPath(home), 'utf8'), '0.2.1');
});

test('restores a launcher that was deleted while the stamp survived', () => {
  const { home, bundle } = fixture('v1');
  syncLauncher(bundle, '0.2.1', { home });
  fs.rmSync(hookLauncherPath(home));
  assert.equal(syncLauncher(bundle, '0.2.1', { home }), true);
  assert.equal(launcherPresent(home), true);
});

test('removeLauncher clears both files and is idempotent', () => {
  const { home, bundle } = fixture('v1');
  syncLauncher(bundle, '0.2.1', { home });
  removeLauncher(home);
  assert.equal(launcherPresent(home), false);
  assert.equal(fs.existsSync(hookLauncherStampPath(home)), false);
  removeLauncher(home);
});
