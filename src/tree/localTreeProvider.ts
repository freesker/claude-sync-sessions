import * as vscode from 'vscode';
import { scanLocalSessions } from '../core/sessionScanner.ts';
import { ProjectNode, SessionNode } from './treeNodes.ts';
import type { LocalSession } from '../types.ts';

export class LocalTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChange.event;
  private sessions: LocalSession[] = [];

  refresh(): void { this.sessions = scanLocalSessions(); this._onDidChange.fire(); }
  getTreeItem(el: vscode.TreeItem): vscode.TreeItem { return el; }

  getChildren(el?: vscode.TreeItem): vscode.TreeItem[] {
    if (!el) {
      const byProject = new Map<string, LocalSession[]>();
      for (const s of this.sessions) {
        const arr = byProject.get(s.projectName) ?? [];
        arr.push(s); byProject.set(s.projectName, arr);
      }
      return [...byProject.entries()].map(([name, ss]) => new ProjectNode(name, ss));
    }
    if (el instanceof ProjectNode) return el.sessions.map((s) => new SessionNode(s));
    return [];
  }

  allSessions(): LocalSession[] { return this.sessions; }
}
