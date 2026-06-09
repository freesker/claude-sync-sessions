import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

export function initLogger(): vscode.OutputChannel {
  if (!channel) channel = vscode.window.createOutputChannel('Claude Sync');
  return channel;
}
export function log(msg: string): void {
  channel?.appendLine(`[${new Date().toISOString()}] ${msg}`);
}
export function showLogs(): void { channel?.show(); }
