import * as vscode from 'vscode';
import * as os from 'node:os';
import { saveSyncConfig } from './syncConfig.ts';
import type { SyncConfig } from '../types.ts';

const SECTION = 'claudeSyncSessions';
const TOKEN_KEY = 'claudeSyncSessions.serverToken';

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

// Mirror settings + the SecretStorage token into config.json for the hooks entrypoint.
export async function mirrorConfigToDisk(secrets: vscode.SecretStorage): Promise<SyncConfig> {
  const cfg = readSettings();
  const serverToken = (await secrets.get(TOKEN_KEY)) || undefined;
  saveSyncConfig({ ...cfg, serverToken });
  return cfg;
}

export async function updateSetting(secrets: vscode.SecretStorage, key: string, value: unknown): Promise<void> {
  await vscode.workspace.getConfiguration(SECTION).update(key, value, vscode.ConfigurationTarget.Global);
  await mirrorConfigToDisk(secrets);
}
