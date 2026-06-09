import * as os from 'node:os';
import { loadSyncConfig, isConfigured } from './config/syncConfig.ts';
import { backupsDir } from './config/appPaths.ts';
import { claudeDir } from './core/claudePaths.ts';
import { scanLocalSessions } from './core/sessionScanner.ts';
import { exportSession } from './core/exporter.ts';
import { importBundle } from './core/importer.ts';
import { packBundle, unpackBundle } from './core/bundler.ts';
import { GitBackend } from './backends/gitBackend.ts';
import { fileLog } from './core/fileLog.ts';

interface HookInput { session_id?: string; cwd?: string; hook_event_name?: string; }

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    setTimeout(() => resolve(data), 1500); // safety: hooks must not hang
  });
}

async function main(): Promise<void> {
  const event = process.argv[2] || '';
  const raw = await readStdin();
  let input: HookInput = {};
  try { input = raw ? JSON.parse(raw) : {}; } catch { /* ignore */ }
  const sessionId = input.session_id || process.env.CLAUDE_SESSION_ID || '';
  const cwd = input.cwd || process.cwd();

  const cfg = loadSyncConfig();
  if (!isConfigured(cfg) || cfg.backend !== 'git') {
    fileLog(`hook ${event}: not configured for git backend, skipping`);
    return;
  }
  const backend = new GitBackend(cfg, fileLog);
  const home = os.homedir();

  try {
    if (event === 'SessionEnd') {
      if (!sessionId) { fileLog('SessionEnd: no session_id'); return; }
      const bundle = exportSession(sessionId, cwd, cfg, home);
      const label = `sync: ${sessionId.slice(0, 8)} | ${bundle.session.project.name} | ${bundle.session.meta.firstPrompt.slice(0, 50)}`;
      await backend.push(bundle.session.project.name, `${sessionId}.bundle.gz`, packBundle(bundle), label);
      fileLog(`SessionEnd: pushed ${sessionId}`);
    } else if (event === 'SessionStart') {
      await backend.ensure();
      const remote = await backend.list();
      const localIds = new Set(scanLocalSessions(claudeDir(home)).map((s) => s.sessionId));
      for (const b of remote) {
        if (localIds.has(b.sessionId)) continue; // only fetch sessions we don't have
        try {
          const bundle = unpackBundle(await backend.pull(b.sessionId));
          importBundle(bundle, cfg, home, claudeDir(home), backupsDir());
          fileLog(`SessionStart: imported ${b.sessionId}`);
        } catch (e) { fileLog(`SessionStart: failed ${b.sessionId}: ${String(e)}`); }
      }
    }
  } catch (e) {
    fileLog(`hook ${event} error: ${String(e)}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { fileLog(`fatal: ${String(e)}`); process.exit(0); });
