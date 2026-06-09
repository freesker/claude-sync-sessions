import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBackend } from '../src/backends/backendFactory.ts';
import { GitBackend } from '../src/backends/gitBackend.ts';
import { ServerBackend } from '../src/backends/serverBackend.ts';
import type { SyncConfig } from '../src/types.ts';

const base: SyncConfig = { deviceName: 'd', projectsRoot: '/r', backend: 'git', gitRepoUrl: 'x', serverUrl: '' };

test('makeBackend picks Git or Server from cfg.backend', () => {
  assert.ok(makeBackend(base, () => {}) instanceof GitBackend);
  assert.ok(makeBackend({ ...base, backend: 'server', serverUrl: 'http://s' }, () => {}, 't') instanceof ServerBackend);
});
