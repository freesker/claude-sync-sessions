import * as fs from 'node:fs';
import * as path from 'node:path';
import { configPath } from './appPaths.ts';
import type { SyncConfig } from '../types.ts';

// `home` is injectable so tests target a temp dir instead of the real ~/.
export function loadSyncConfig(home?: string): SyncConfig | null {
  const p = configPath(home);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) as SyncConfig; } catch { return null; }
}

export function saveSyncConfig(cfg: SyncConfig, home?: string): void {
  const p = configPath(home);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
  try { fs.chmodSync(p, 0o600); } catch { /* best effort (e.g. Windows) */ }
}

export function isConfigured(cfg: SyncConfig | null): cfg is SyncConfig {
  return !!cfg && !!cfg.deviceName && !!cfg.projectsRoot &&
    (cfg.backend === 'server' ? !!cfg.serverUrl : !!cfg.gitRepoUrl);
}
