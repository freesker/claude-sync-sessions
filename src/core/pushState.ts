import * as fs from 'node:fs';
import * as path from 'node:path';
import { appDir } from '../config/appPaths.ts';

// `home` is injectable so tests target a temp dir instead of the real ~/.
function statePath(home?: string): string { return path.join(appDir(home), 'push-state.json'); }

export function loadPushState(home?: string): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(statePath(home), 'utf8')); } catch { return {}; }
}
export function isUnchanged(sessionId: string, hash: string, home?: string): boolean {
  return loadPushState(home)[sessionId] === hash;
}
export function markPushed(sessionId: string, hash: string, home?: string): void {
  const s = loadPushState(home); s[sessionId] = hash;
  fs.mkdirSync(appDir(home), { recursive: true });
  fs.writeFileSync(statePath(home), JSON.stringify(s, null, 2));
}
