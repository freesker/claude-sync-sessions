import * as fs from 'node:fs';
import * as path from 'node:path';
import { configPath } from './appPaths.ts';
import type { SyncConfig } from '../types.ts';

export function loadSyncConfig(): SyncConfig | null {
  const p = configPath();
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) as SyncConfig; } catch { return null; }
}

export function saveSyncConfig(cfg: SyncConfig): void {
  const p = configPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
}

export function isConfigured(cfg: SyncConfig | null): cfg is SyncConfig {
  return !!cfg && !!cfg.deviceName && !!cfg.projectsRoot &&
    (cfg.backend === 'server' ? !!cfg.serverUrl : !!cfg.gitRepoUrl);
}
