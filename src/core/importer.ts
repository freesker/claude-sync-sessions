import * as fs from 'node:fs';
import * as path from 'node:path';
import { projectsDir, todosDir, fileHistoryDir, encodeProjectDir } from './claudePaths.ts';
import { denormalizeLine } from './pathTransformer.ts';
import type { Bundle, SyncConfig } from '../types.ts';

export interface ImportResult { skipped: boolean; targetPath: string; reason?: string; }

// Bundles may arrive over git/network and are untrusted. Resolve `name` under
// `rootDir` and refuse anything that escapes it (e.g. containing ".." or an absolute
// path), so a hostile bundle can never write files outside the intended directory.
function containedJoin(rootDir: string, name: string): string {
  const root = path.resolve(rootDir);
  const dest = path.resolve(root, name);
  if (dest !== root && !dest.startsWith(root + path.sep)) {
    throw new Error(`Refusing to write outside ${rootDir}: ${name}`);
  }
  return dest;
}

function resolveTargetPath(bundle: Bundle, cfg: SyncConfig): string {
  const rel = bundle.session.project.relativeToRoot;
  const name = bundle.session.project.name;
  const root = cfg.projectsRoot.replace(/\\/g, '/');
  const target = rel ? `${root}/${rel}` : `${root}/${name}`;
  // Refuse a relativeToRoot/name that escapes projectsRoot.
  containedJoin(root, rel ?? name);
  return target;
}

function backupExisting(sessionId: string, projDir: string, claudeDirPath: string, backupsRoot: string): void {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(backupsRoot, stamp, sessionId);
  fs.mkdirSync(dest, { recursive: true });
  const jsonl = path.join(projDir, `${sessionId}.jsonl`);
  if (fs.existsSync(jsonl)) fs.copyFileSync(jsonl, path.join(dest, `${sessionId}.jsonl`));
  const fh = path.join(fileHistoryDir(claudeDirPath), sessionId);
  if (fs.existsSync(fh)) fs.cpSync(fh, path.join(dest, 'file-history'), { recursive: true });
  const tdir = todosDir(claudeDirPath);
  if (fs.existsSync(tdir)) {
    for (const f of fs.readdirSync(tdir)) {
      if (f.startsWith(sessionId)) fs.copyFileSync(path.join(tdir, f), path.join(dest, f));
    }
  }
}

// Precondition: `bundle` is assumed integrity-checked. The transport layer obtains
// bundles via bundler.unpackBundle(), which verifies the SHA256 checksum before this
// runs; importBundle itself does not re-verify.
export function importBundle(
  bundle: Bundle,
  cfg: SyncConfig,
  home: string,
  claudeDirPath: string,
  backupsRoot: string,
  force = false,
): ImportResult {
  const sessionId = bundle.session.sessionId;
  const targetPath = resolveTargetPath(bundle, cfg);
  const tokens = { projectRoot: targetPath, home };
  const encoded = encodeProjectDir(targetPath);
  const projDir = path.join(projectsDir(claudeDirPath), encoded);
  const jsonlPath = path.join(projDir, `${sessionId}.jsonl`);

  // last-writer-wins: skip if local file is newer than the bundle, unless forced
  if (!force && fs.existsSync(jsonlPath)) {
    const localMs = fs.statSync(jsonlPath).mtimeMs;
    if (localMs > new Date(bundle.updatedAt).getTime()) {
      return { skipped: true, targetPath, reason: 'local-newer' };
    }
    backupExisting(sessionId, projDir, claudeDirPath, backupsRoot);
  }

  fs.mkdirSync(projDir, { recursive: true });
  // Write with a trailing newline to match Claude Code's own .jsonl files.
  const jsonl = bundle.session.messages.map((l) => denormalizeLine(l, tokens, { windows: process.platform === 'win32' })).join('\n');
  fs.writeFileSync(jsonlPath, jsonl ? `${jsonl}\n` : jsonl);

  for (const [name, content] of Object.entries(bundle.session.agents)) {
    const agentText = content.split('\n').map((l) => denormalizeLine(l, tokens, { windows: process.platform === 'win32' })).join('\n');
    fs.writeFileSync(containedJoin(projDir, name), agentText ? `${agentText}\n` : agentText);
  }

  const tdir = todosDir(claudeDirPath);
  fs.mkdirSync(tdir, { recursive: true });
  for (const t of bundle.session.todos) fs.writeFileSync(containedJoin(tdir, t.filename), t.content);

  const fhRoot = path.join(fileHistoryDir(claudeDirPath), sessionId);
  for (const [rel, b64] of Object.entries(bundle.session.fileHistory)) {
    const dest = containedJoin(fhRoot, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.from(b64, 'base64'));
  }

  return { skipped: false, targetPath };
}
