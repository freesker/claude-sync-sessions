import * as vscode from 'vscode';
import type { LocalSession, RemoteBundle } from '../types.ts';

export class ProjectNode extends vscode.TreeItem {
  constructor(public readonly projectName: string, public readonly sessions: LocalSession[]) {
    super(projectName, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'project';
    this.description = `${sessions.length} session(s)`;
    this.iconPath = new vscode.ThemeIcon('folder');
  }
}

export class SessionNode extends vscode.TreeItem {
  constructor(public readonly session: LocalSession) {
    super(session.firstPrompt, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'session';
    this.description = session.sessionId.slice(0, 8);
    this.tooltip = `${session.sessionId}\n${session.projectPath}\n${session.modified.toISOString()}`;
    this.iconPath = new vscode.ThemeIcon('comment-discussion');
  }
}

export class RemoteBundleNode extends vscode.TreeItem {
  constructor(public readonly bundle: RemoteBundle) {
    super(bundle.label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'remoteBundle';
    this.description = bundle.sessionId.slice(0, 8);
    this.tooltip = `${bundle.project}/${bundle.filename}`;
    this.iconPath = new vscode.ThemeIcon('cloud');
  }
}
