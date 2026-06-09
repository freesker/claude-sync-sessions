import * as vscode from 'vscode';

let item: vscode.StatusBarItem | undefined;

export function initStatusBar(context: vscode.ExtensionContext): void {
  item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  context.subscriptions.push(item);
  item.show();
}

export function updateStatusBar(hooksOn: boolean): void {
  if (!item) return;
  item.text = `$(sync) Claude Sync: Hooks ${hooksOn ? 'ON' : 'OFF'}`;
  item.command = hooksOn ? 'claudeSync.uninstallHooks' : 'claudeSync.installHooks';
  item.tooltip = hooksOn ? 'Auto-sync hooks installed (click to remove)' : 'Auto-sync hooks off (click to install)';
}
