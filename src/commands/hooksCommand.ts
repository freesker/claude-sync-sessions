import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { hookLauncherPath } from '../config/appPaths.ts';
import { syncLauncher, launcherPresent, removeLauncher } from '../core/hookLauncher.ts';
import { settingsPath, isOurs, hasHookEntries, removeHookEntries } from '../core/hookSettings.ts';
import { log } from '../ui/logger.ts';

function writeLauncher(context: vscode.ExtensionContext, force = false): string {
  const bundle = context.asAbsolutePath('out/hook.js');
  const version = String(context.extension.packageJSON.version ?? '0');
  if (syncLauncher(bundle, version, { force })) log(`hook launcher updated (${version})`);
  return hookLauncherPath();
}

/**
 * Refreshes the launcher copy after an extension update, so hooks installed by a
 * previous version keep working. No-op when the user never installed the hooks.
 */
export function refreshLauncher(context: vscode.ExtensionContext): void {
  if (!launcherPresent() && !hooksInstalled()) return;
  try { writeLauncher(context); } catch (e) { log(`hook launcher refresh failed: ${e}`); }
}

function hookCmd(launcher: string, event: string): string {
  return `node "${launcher}" ${event}`;
}

export function hooksInstalled(): boolean {
  return hasHookEntries(settingsPath());
}

export function registerHooksCommands(context: vscode.ExtensionContext, onChange: () => void): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeSync.installHooks', () => {
      const launcher = writeLauncher(context, true);
      const p = settingsPath();
      const s = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
      s.hooks = s.hooks ?? {};
      const mk = (event: string) => ({ hooks: [{ type: 'command', command: hookCmd(launcher, event) }] });
      s.hooks.SessionEnd = [...(s.hooks.SessionEnd ?? []).filter((g: any) => !isOurs(g)), mk('SessionEnd')];
      s.hooks.SessionStart = [...(s.hooks.SessionStart ?? []).filter((g: any) => !isOurs(g)), mk('SessionStart')];
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, `${JSON.stringify(s, null, 2)}\n`);
      log('hooks installed');
      vscode.window.showInformationMessage('Claude Sync: auto-sync hooks installed.');
      onChange();
    }),

    vscode.commands.registerCommand('claudeSync.uninstallHooks', () => {
      removeLauncher();
      removeHookEntries(settingsPath());
      log('hooks removed');
      vscode.window.showInformationMessage('Claude Sync: auto-sync hooks removed.');
      onChange();
    }),
  );
}
