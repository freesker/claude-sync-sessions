import * as vscode from 'vscode';
import { RemoteBundleNode } from './treeNodes.ts';
import { makeBackend } from '../backends/backendFactory.ts';
import { readSettings } from '../config/settings.ts';
import { isConfigured } from '../config/syncConfig.ts';
import { log } from '../ui/logger.ts';
import type { RemoteBundle } from '../types.ts';

export class RemoteTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChange.event;
  private bundles: RemoteBundle[] = [];
  private token: string | undefined;

  setToken(token?: string): void { this.token = token; }

  async refresh(): Promise<void> {
    const cfg = readSettings();
    if (!isConfigured(cfg)) { this.bundles = []; this._onDidChange.fire(); return; }
    try {
      const backend = makeBackend(cfg, log, this.token);
      await backend.ensure();
      this.bundles = await backend.list();
    } catch (e) {
      log(`remote refresh failed: ${String(e)}`);
      vscode.window.showErrorMessage(`Claude Sync: remote refresh failed — ${String(e)}`);
      this.bundles = [];
    }
    this._onDidChange.fire();
  }

  getTreeItem(el: vscode.TreeItem): vscode.TreeItem { return el; }
  getChildren(el?: vscode.TreeItem): vscode.TreeItem[] {
    return el ? [] : this.bundles.map((b) => new RemoteBundleNode(b));
  }
  allBundles(): RemoteBundle[] { return this.bundles; }
}
