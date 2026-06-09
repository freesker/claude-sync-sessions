import * as vscode from 'vscode';
import * as os from 'node:os';
import { saveSyncConfig } from './syncConfig.ts';
import type { SyncConfig } from '../types.ts';

const SECTION = 'claudeSyncSessions';

export function readSettings(): SyncConfig {
  const c = vscode.workspace.getConfiguration(SECTION);
  return {
    deviceName: c.get<string>('deviceName', '') || os.hostname(),
    projectsRoot: (c.get<string>('projectsRoot', '') || '').replace(/\\/g, '/'),
    backend: c.get<'git' | 'server'>('backend', 'git'),
    gitRepoUrl: c.get<string>('gitRepoUrl', ''),
    serverUrl: c.get<string>('serverUrl', ''),
  };
}

// Mirror VSCode settings into ~/.claude-sync-sessions/config.json so the hook
// entrypoint (which has no vscode) can read the same configuration.
export function syncSettingsToDisk(): SyncConfig {
  const cfg = readSettings();
  saveSyncConfig(cfg);
  return cfg;
}

export async function updateSetting(key: string, value: unknown): Promise<void> {
  await vscode.workspace.getConfiguration(SECTION).update(key, value, vscode.ConfigurationTarget.Global);
  syncSettingsToDisk();
}
