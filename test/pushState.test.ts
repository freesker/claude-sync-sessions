import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs'; import * as os from 'node:os'; import * as path from 'node:path';
import { loadPushState, markPushed, isUnchanged } from '../src/core/pushState.ts';

test('marks and detects unchanged sessions (isolated home)', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-'));
  assert.equal(isUnchanged('s1', 'hashA', home), false);
  markPushed('s1', 'hashA', home);
  assert.equal(isUnchanged('s1', 'hashA', home), true);
  assert.equal(isUnchanged('s1', 'hashB', home), false);
  assert.ok(loadPushState(home)['s1']);
});
