import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { claudeDir } from '../core/claudePaths.ts';
import { hookLauncherPath, binDir } from '../config/appPaths.ts';
import { log } from '../ui/logger.ts';

const MARKER = 'claude-sync-sessions';

function settingsPath(): string { return path.join(claudeDir(os.homedir()), 'settings.json'); }

function writeLauncher(context: vscode.ExtensionContext): string {
  const target = context.asAbsolutePath('out/hook.js').replace(/\\/g, '/');
  fs.mkdirSync(binDir(), { recursive: true });
  const launcher = hookLauncherPath();
  fs.writeFileSync(launcher, `require(${JSON.stringify(target)});\n`);
  return launcher;
}

function hookCmd(launcher: string, event: string): string {
  return `node "${launcher}" ${event}`;
}

function isOurs(entry: any): boolean {
  return JSON.stringify(entry).includes(MARKER) || JSON.stringify(entry).includes('hook.cjs');
}

export function hooksInstalled(): boolean {
  const p = settingsPath();
  if (!fs.existsSync(p)) return false;
  try {
    const s = JSON.parse(fs.readFileSync(p, 'utf8'));
    const groups = [...(s.hooks?.SessionEnd ?? []), ...(s.hooks?.SessionStart ?? [])];
    return groups.some((g: any) => (g.hooks ?? []).some((h: any) => String(h.command ?? '').includes('hook.cjs')));
  } catch { return false; }
}

export function registerHooksCommands(context: vscode.ExtensionContext, onChange: () => void): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeSync.installHooks', () => {
      const launcher = writeLauncher(context);
      const p = settingsPath();
      const s = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
      s.hooks = s.hooks ?? {};
      const mk = (event: string) => ({ hooks: [{ type: 'command', command: hookCmd(launcher, event) }] });
      s.hooks.SessionEnd = [...(s.hooks.SessionEnd ?? []).filter((g: any) => !isOurs(g)), mk('SessionEnd')];
      s.hooks.SessionStart = [...(s.hooks.SessionStart ?? []).filter((g: any) => !isOurs(g)), mk('SessionStart')];
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, JSON.stringify(s, null, 2));
      log('hooks installed');
      vscode.window.showInformationMessage('Claude Sync: auto-sync hooks installed.');
      onChange();
    }),

    vscode.commands.registerCommand('claudeSync.uninstallHooks', () => {
      const p = settingsPath();
      if (!fs.existsSync(p)) { onChange(); return; }
      const s = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (s.hooks?.SessionEnd) s.hooks.SessionEnd = s.hooks.SessionEnd.filter((g: any) => !isOurs(g));
      if (s.hooks?.SessionStart) s.hooks.SessionStart = s.hooks.SessionStart.filter((g: any) => !isOurs(g));
      fs.writeFileSync(p, JSON.stringify(s, null, 2));
      log('hooks removed');
      vscode.window.showInformationMessage('Claude Sync: auto-sync hooks removed.');
      onChange();
    }),
  );
}
