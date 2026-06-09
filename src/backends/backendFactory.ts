import type { SyncConfig } from '../types.ts';
import type { SyncBackend } from './syncBackend.ts';
import { GitBackend } from './gitBackend.ts';
import { ServerBackend } from './serverBackend.ts';

export function makeBackend(cfg: SyncConfig, log: (m: string) => void, token?: string): SyncBackend {
  return cfg.backend === 'server' ? new ServerBackend(cfg, token, log) : new GitBackend(cfg, log);
}
