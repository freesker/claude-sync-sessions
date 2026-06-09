import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { claudeDir, projectsDir, todosDir, fileHistoryDir, encodeProjectDir } from '../src/core/claudePaths.ts';

test('claudeDir joins home with .claude', () => {
  assert.equal(claudeDir('/home/u'), path.join('/home/u', '.claude'));
});

test('projectsDir/todosDir/fileHistoryDir derive from claude dir', () => {
  const c = '/home/u/.claude';
  assert.equal(projectsDir(c), path.join(c, 'projects'));
  assert.equal(todosDir(c), path.join(c, 'todos'));
  assert.equal(fileHistoryDir(c), path.join(c, 'file-history'));
});

test('encodeProjectDir replaces / \\ : . with -', () => {
  assert.equal(encodeProjectDir('/Volumes/M2/repos/app'), '-Volumes-M2-repos-app');
  assert.equal(encodeProjectDir('C:\\Users\\bob\\app'), 'C--Users-bob-app');
  // dot-bearing (hidden) directories: Claude encodes '.' to '-' as well
  assert.equal(encodeProjectDir('/Users/freesker/.ssh'), '-Users-freesker--ssh');
  assert.equal(encodeProjectDir('/Users/freesker/.local/share/chezmoi'), '-Users-freesker--local-share-chezmoi');
});
