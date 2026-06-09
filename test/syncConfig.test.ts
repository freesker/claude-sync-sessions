import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { saveSyncConfig, loadSyncConfig } from '../src/config/syncConfig.ts';
import { configPath } from '../src/config/appPaths.ts';
import type { SyncConfig } from '../src/types.ts';

test('saveSyncConfig round-trips serverToken and is chmod 600', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-'));
  const cfg: SyncConfig = { deviceName: 'd', projectsRoot: '/r', backend: 'server', gitRepoUrl: '', serverUrl: 'http://s', serverToken: 'secret-123' };
  saveSyncConfig(cfg, home);
  const back = loadSyncConfig(home);
  assert.equal(back?.serverToken, 'secret-123');
  const mode = fs.statSync(configPath(home)).mode & 0o777;
  assert.equal(mode, 0o600);
});

test('loadSyncConfig returns null when no config exists', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-empty-'));
  assert.equal(loadSyncConfig(home), null);
});
