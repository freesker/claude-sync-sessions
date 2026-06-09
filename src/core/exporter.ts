import * as fs from 'node:fs';
import * as path from 'node:path';
import { projectsDir, todosDir, fileHistoryDir, encodeProjectDir } from './claudePaths.ts';
import { normalizeLine } from './pathTransformer.ts';
import { checksum } from './bundler.ts';
import { extractFirstPrompt } from './sessionScanner.ts';
import type { Bundle, SyncConfig, TodoFile } from '../types.ts';

function listFilesRecursive(dir: string, baseForRel: string): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...listFilesRecursive(full, baseForRel));
    else out.push(path.relative(baseForRel, full));
  }
  return out;
}

export function exportSession(
  sessionId: string,
  projectPath: string,
  cfg: SyncConfig,
  home: string,
  claudeDirPath?: string,
): Bundle {
  const tokens = { projectRoot: projectPath, home };
  const encoded = encodeProjectDir(projectPath);
  const projDir = path.join(projectsDir(claudeDirPath), encoded);
  const jsonlPath = path.join(projDir, `${sessionId}.jsonl`);
  if (!fs.existsSync(jsonlPath)) throw new Error(`Session not found: ${jsonlPath}`);

  const mtimes: number[] = [];
  const raw = fs.readFileSync(jsonlPath, 'utf8');
  mtimes.push(fs.statSync(jsonlPath).mtimeMs);
  const messages = raw.split('\n').filter((l) => l.trim()).map((l) => normalizeLine(l, tokens));

  // sub-agent transcripts in the same project dir
  const agents: Record<string, string> = {};
  for (const name of fs.readdirSync(projDir)) {
    if (name.startsWith('agent-') && name.endsWith('.jsonl')) {
      const p = path.join(projDir, name);
      mtimes.push(fs.statSync(p).mtimeMs);
      agents[name] = fs.readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l) => normalizeLine(l, tokens)).join('\n');
    }
  }

  // todos for this session
  const todos: TodoFile[] = [];
  const tdir = todosDir(claudeDirPath);
  if (fs.existsSync(tdir)) {
    for (const name of fs.readdirSync(tdir)) {
      if (name.startsWith(sessionId) && name.endsWith('.json')) {
        const p = path.join(tdir, name);
        mtimes.push(fs.statSync(p).mtimeMs);
        todos.push({ filename: name, content: fs.readFileSync(p, 'utf8') });
      }
    }
  }

  // file-history for this session (binary-safe base64)
  const fileHistory: Record<string, string> = {};
  const fhRoot = path.join(fileHistoryDir(claudeDirPath), sessionId);
  if (fs.existsSync(fhRoot)) {
    for (const rel of listFilesRecursive(fhRoot, fhRoot)) {
      const p = path.join(fhRoot, rel);
      mtimes.push(fs.statSync(p).mtimeMs);
      fileHistory[rel] = fs.readFileSync(p).toString('base64');
    }
  }

  // Only treat the project as "under" projectsRoot on a true path-segment boundary,
  // so e.g. "/home/bob/projects" does not falsely match "/home/bob/projects-extra".
  const underRoot =
    projectPath === cfg.projectsRoot || projectPath.startsWith(cfg.projectsRoot + '/');
  const relativeToRoot = underRoot
    ? path.relative(cfg.projectsRoot, projectPath).split(path.sep).join('/') || null
    : null;

  const session = {
    sessionId,
    project: { name: path.basename(projectPath), relativeToRoot, tokenizedPath: '${PROJECT_ROOT}', originalPath: projectPath },
    messages,
    agents,
    todos,
    fileHistory,
    meta: {
      firstPrompt: extractFirstPrompt(raw.split('\n')),
      messageCount: messages.length,
      modified: new Date(Math.max(...mtimes)).toISOString(),
    },
  };

  return {
    version: '1',
    exportedAt: new Date().toISOString(),
    sourceDevice: cfg.deviceName,
    updatedAt: new Date(Math.max(...mtimes)).toISOString(),
    session,
    checksum: checksum(session),
  };
}
