import * as vscode from 'vscode';
import { initLogger, log, showLogs } from './ui/logger.ts';
import { LocalTreeProvider } from './tree/localTreeProvider.ts';
import { RemoteTreeProvider } from './tree/remoteTreeProvider.ts';
import { registerSyncCommands } from './commands/syncCommands.ts';
import { registerConfigCommands } from './commands/configCommands.ts';
import { syncSettingsToDisk, readSettings } from './config/settings.ts';
import { isConfigured } from './config/syncConfig.ts';
import { initStatusBar, updateStatusBar } from './ui/statusBar.ts';
import { registerHooksCommands, hooksInstalled } from './commands/hooksCommand.ts';

export function activate(context: vscode.ExtensionContext): void {
  initLogger();
  log('Claude Sync activated');
  syncSettingsToDisk();

  const local = new LocalTreeProvider();
  const remote = new RemoteTreeProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('claudeSync.local', local),
    vscode.window.registerTreeDataProvider('claudeSync.remote', remote),
  );
  local.refresh();
  void (async () => {
    if (readSettings().backend === 'server') {
      remote.setToken(await context.secrets.get('claudeSyncSessions.serverToken'));
    }
    remote.refresh();
  })();

  registerConfigCommands(context);
  initStatusBar(context);
  const refreshStatus = () => updateStatusBar(hooksInstalled());
  registerHooksCommands(context, refreshStatus);
  refreshStatus();
  registerSyncCommands(context, local, remote);

  context.subscriptions.push(
    vscode.commands.registerCommand('claudeSync.refreshLocal', () => local.refresh()),
    vscode.commands.registerCommand('claudeSync.refreshRemote', () => remote.refresh()),
    vscode.commands.registerCommand('claudeSync.showOutput', () => showLogs()),
  );

  const cfg = readSettings();
  if (!isConfigured(cfg)) {
    vscode.window.showInformationMessage('Claude Sync: configure your device and Git repo to start.', 'Configure Device')
      .then((p) => { if (p) vscode.commands.executeCommand('claudeSync.configureDevice'); });
  }

  if (vscode.workspace.getConfiguration('claudeSyncSessions').get('autoRefreshOnFocus', true)) {
    vscode.window.onDidChangeWindowState((s) => { if (s.focused) local.refresh(); }, null, context.subscriptions);
  }
}

export function deactivate(): void {}
