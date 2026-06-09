import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { repoDir } from '../config/appPaths.ts';
import type { RemoteBundle, SyncConfig } from '../types.ts';
import type { SyncBackend } from './syncBackend.ts';

const exec = promisify(execFile);

function sanitize(name: string): string { return name.replace(/[^A-Za-z0-9._-]/g, '_'); }

export class GitBackend implements SyncBackend {
  constructor(private cfg: SyncConfig, private logFn: (m: string) => void = () => {}) {}

  private async git(args: string[], cwd: string): Promise<string> {
    this.logFn(`git ${args.join(' ')}`);
    const { stdout } = await exec('git', args, { cwd, maxBuffer: 64 * 1024 * 1024 });
    return stdout.trim();
  }

  async ensure(): Promise<void> {
    const dir = repoDir();
    if (fs.existsSync(path.join(dir, '.git'))) {
      try { await this.git(['pull', '--rebase'], dir); }
      catch (e) { this.logFn(`pull skipped/failed: ${String(e)}`); }
      return;
    }
    // No valid repo yet. Remove any partial/broken leftover from a previous failed
    // clone so we never get stuck on "destination path already exists".
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    // Clone into a temp dir and move into place only on success, so a failed clone
    // (network/auth error) never leaves a broken repo dir behind.
    const tmp = `${dir}.tmp`;
    if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
    try {
      await exec('git', ['clone', this.cfg.gitRepoUrl, tmp], { maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
      if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
      throw e;
    }
    fs.renameSync(tmp, dir);
    fs.mkdirSync(path.join(dir, 'sessions'), { recursive: true });
  }

  async list(): Promise<RemoteBundle[]> {
    const dir = repoDir();
    const sessionsRoot = path.join(dir, 'sessions');
    if (!fs.existsSync(sessionsRoot)) return [];
    const out: RemoteBundle[] = [];
    for (const project of fs.readdirSync(sessionsRoot)) {
      const pdir = path.join(sessionsRoot, project);
      if (!fs.statSync(pdir).isDirectory()) continue;
      for (const file of fs.readdirSync(pdir)) {
        if (!file.endsWith('.bundle.gz')) continue;
        const sessionId = file.replace(/\.bundle\.gz$/, '');
        let label = `${project} · ${sessionId.slice(0, 8)}`;
        let updatedAt: string | undefined;
        try {
          const rel = `sessions/${project}/${file}`;
          const logLine = await this.git(['log', '-1', '--format=%s|%cI', '--', rel], dir);
          const [subject, iso] = logLine.split('|');
          if (subject) label = subject;
          if (iso) updatedAt = iso;
        } catch { /* keep default */ }
        out.push({ sessionId, project, filename: file, label, updatedAt });
      }
    }
    return out;
  }

  async push(project: string, filename: string, bytes: Buffer, label: string): Promise<void> {
    const dir = repoDir();
    await this.ensure();
    const pdir = path.join(dir, 'sessions', sanitize(project));
    fs.mkdirSync(pdir, { recursive: true });
    fs.writeFileSync(path.join(pdir, filename), bytes);
    const rel = `sessions/${sanitize(project)}/${filename}`;
    await this.git(['add', rel], dir);
    try { await this.git(['commit', '-m', label], dir); }
    catch { this.logFn('nothing to commit'); return; }
    try { await this.git(['pull', '--rebase'], dir); } catch { /* first push */ }
    await this.git(['push'], dir);
  }

  async pull(sessionIdPrefix: string): Promise<Buffer> {
    const dir = repoDir();
    await this.ensure();
    const sessionsRoot = path.join(dir, 'sessions');
    for (const project of fs.readdirSync(sessionsRoot)) {
      const pdir = path.join(sessionsRoot, project);
      if (!fs.statSync(pdir).isDirectory()) continue;
      for (const file of fs.readdirSync(pdir)) {
        if (file.endsWith('.bundle.gz') && file.startsWith(sessionIdPrefix)) {
          return fs.readFileSync(path.join(pdir, file));
        }
      }
    }
    throw new Error(`Bundle not found for prefix ${sessionIdPrefix}`);
  }
}
