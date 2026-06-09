import * as os from 'node:os';
import * as path from 'node:path';

export function appDir(home: string = os.homedir()): string {
  return path.join(home, '.claude-sync-sessions');
}
export function repoDir(home?: string): string { return path.join(appDir(home), 'repo'); }
export function backupsDir(home?: string): string { return path.join(appDir(home), 'backups'); }
export function binDir(home?: string): string { return path.join(appDir(home), 'bin'); }
export function configPath(home?: string): string { return path.join(appDir(home), 'config.json'); }
export function hookLogPath(home?: string): string { return path.join(appDir(home), 'hook.log'); }
export function hookLauncherPath(home?: string): string { return path.join(binDir(home), 'hook.cjs'); }
