import * as vscode from 'vscode';
import { RemoteBundleNode } from './treeNodes.ts';
import { makeBackend } from '../backends/backendFactory.ts';
import { readSettings } from '../config/settings.ts';
import { isConfigured } from '../config/syncConfig.ts';
import { log } from '../ui/logger.ts';
import type { RemoteBundle } from '../types.ts';

const TOKEN_KEY = 'claudeSyncSessions.serverToken';

export class RemoteTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChange.event;
  private bundles: RemoteBundle[] = [];

  constructor(private readonly secrets: vscode.SecretStorage) {}

  async refresh(): Promise<void> {
    const cfg = readSettings();
    if (!isConfigured(cfg)) { this.bundles = []; this._onDidChange.fire(); return; }
    try {
      // Read the server token fresh from SecretStorage every refresh — the same
      // source the push/pull commands use — so it can't go stale after the server
      // is configured mid-session.
      const token = cfg.backend === 'server' ? await this.secrets.get(TOKEN_KEY) : undefined;
      const backend = makeBackend(cfg, log, token);
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
