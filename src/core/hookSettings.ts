import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { claudeDir } from './claudePaths.ts';

// vscode-free manipulation of Claude's settings.json, shared by the extension
// commands and by the `vscode:uninstall` entrypoint (which runs as a bare node
// script and cannot import the vscode API).

const MARKER = 'claude-sync-sessions';
const EVENTS = ['SessionEnd', 'SessionStart'];

export function settingsPath(home: string = os.homedir()): string {
  return path.join(claudeDir(home), 'settings.json');
}

export function isOurs(entry: unknown): boolean {
  const s = JSON.stringify(entry) ?? '';
  return s.includes(MARKER) || s.includes('hook.cjs');
}

function readSettingsFile(p: string): any {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

export function hasHookEntries(p: string): boolean {
  const s = readSettingsFile(p);
  if (!s) return false;
  return EVENTS.some((e) => (s.hooks?.[e] ?? []).some((g: any) => (g?.hooks ?? []).some((h: any) => String(h?.command ?? '').includes('hook.cjs'))));
}

/**
 * Drops our hook entries from settings.json, leaving every other hook untouched.
 * Returns true if the file was rewritten. A malformed or missing file is left
 * alone rather than clobbered — never destroy settings we cannot parse.
 */
export function removeHookEntries(p: string): boolean {
  const s = readSettingsFile(p);
  if (!s?.hooks) return false;
  let changed = false;
  for (const e of EVENTS) {
    const groups = s.hooks[e];
    if (!Array.isArray(groups)) continue;
    const kept = groups.filter((g: any) => !isOurs(g));
    if (kept.length === groups.length) continue;
    if (kept.length) s.hooks[e] = kept; else delete s.hooks[e];
    changed = true;
  }
  if (changed && !Object.keys(s.hooks).length) delete s.hooks;
  if (changed) fs.writeFileSync(p, `${JSON.stringify(s, null, 2)}\n`);
  return changed;
}
