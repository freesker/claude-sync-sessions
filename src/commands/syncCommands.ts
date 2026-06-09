import * as vscode from 'vscode';
import * as os from 'node:os';
import { readSettings } from '../config/settings.ts';
import { isConfigured } from '../config/syncConfig.ts';
import { backupsDir, claudeDirFromHome } from './_paths.ts';
import { exportSession } from '../core/exporter.ts';
import { importBundle } from '../core/importer.ts';
import { packBundle, unpackBundle } from '../core/bundler.ts';
import { makeBackend } from '../backends/backendFactory.ts';
import { log } from '../ui/logger.ts';
import { isUnchanged, markPushed } from '../core/pushState.ts';
import type { SyncBackend } from '../backends/syncBackend.ts';
import type { LocalTreeProvider } from '../tree/localTreeProvider.ts';
import type { RemoteTreeProvider } from '../tree/remoteTreeProvider.ts';
import type { SessionNode, ProjectNode, RemoteBundleNode } from '../tree/treeNodes.ts';
import type { LocalSession, SyncConfig } from '../types.ts';

async function requireConfig(): Promise<SyncConfig | null> {
  const cfg = readSettings();
  if (!isConfigured(cfg)) {
    const pick = await vscode.window.showWarningMessage('Claude Sync is not configured yet.', 'Configure Device');
    if (pick) vscode.commands.executeCommand('claudeSync.configureDevice');
    return null;
  }
  return cfg;
}

async function backendFor(context: vscode.ExtensionContext, cfg: SyncConfig): Promise<SyncBackend> {
  const token = cfg.backend === 'server' ? await context.secrets.get('claudeSyncSessions.serverToken') : undefined;
  return makeBackend(cfg, log, token);
}

async function pushOne(s: LocalSession, cfg: SyncConfig, backend: SyncBackend, force = false): Promise<void> {
  const bundle = exportSession(s.sessionId, s.projectPath, cfg, os.homedir());
  if (!force && isUnchanged(s.sessionId, bundle.checksum)) { log(`skip unchanged ${s.sessionId.slice(0, 8)}`); return; }
  const bytes = packBundle(bundle);
  const label = `sync: ${s.sessionId.slice(0, 8)} | ${s.projectName} | ${bundle.session.meta.firstPrompt.slice(0, 50)}`;
  await backend.push(s.projectName, `${s.sessionId}.bundle.gz`, bytes, label);
  markPushed(s.sessionId, bundle.checksum);
}

export function registerSyncCommands(
  context: vscode.ExtensionContext,
  local: LocalTreeProvider,
  remote: RemoteTreeProvider,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeSync.push', async (node: SessionNode) => {
      const cfg = await requireConfig(); if (!cfg) return;
      const backend = await backendFor(context, cfg);
      await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Uploading ${node.session.sessionId.slice(0, 8)}…` },
        async () => { await pushOne(node.session, cfg, backend, true); });
      vscode.window.showInformationMessage('Claude Sync: session uploaded.');
      remote.refresh();
    }),

    vscode.commands.registerCommand('claudeSync.pushAllProject', async (node: ProjectNode) => {
      const cfg = await requireConfig(); if (!cfg) return;
      const backend = await backendFor(context, cfg);
      await runBatch(`Uploading ${node.projectName}`, node.sessions, (s) => pushOne(s, cfg, backend));
      remote.refresh();
    }),

    vscode.commands.registerCommand('claudeSync.pushAll', async () => {
      const cfg = await requireConfig(); if (!cfg) return;
      const all = local.allSessions();
      if (all.length === 0) { vscode.window.showInformationMessage('No local sessions to upload.'); return; }
      const backend = await backendFor(context, cfg);
      await runBatch('Uploading all sessions', all, (s) => pushOne(s, cfg, backend));
      remote.refresh();
    }),

    vscode.commands.registerCommand('claudeSync.pull', async (node: RemoteBundleNode) => {
      const cfg = await requireConfig(); if (!cfg) return;
      const backend = await backendFor(context, cfg);
      await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Downloading ${node.bundle.sessionId.slice(0, 8)}…` },
        async () => {
          await backend.ensure();
          const bytes = await backend.pull(node.bundle.sessionId);
          const bundle = unpackBundle(bytes);
          const res = importBundle(bundle, cfg, os.homedir(), claudeDirFromHome(), backupsDir());
          log(res.skipped ? `skipped ${bundle.session.sessionId} (${res.reason})` : `imported ${bundle.session.sessionId}`);
        });
      vscode.window.showInformationMessage('Claude Sync: session downloaded.');
      local.refresh();
    }),

    vscode.commands.registerCommand('claudeSync.pullAll', async () => {
      const cfg = await requireConfig(); if (!cfg) return;
      const backend = await backendFor(context, cfg);
      await backend.ensure();
      const bundles = remote.allBundles();
      if (bundles.length === 0) { vscode.window.showInformationMessage('No remote bundles to download.'); return; }
      await runBatch('Downloading all sessions', bundles, async (b) => {
        const bytes = await backend.pull(b.sessionId);
        const bundle = unpackBundle(bytes);
        importBundle(bundle, cfg, os.homedir(), claudeDirFromHome(), backupsDir());
      });
      local.refresh();
    }),
  );
}

async function runBatch<T>(title: string, items: T[], fn: (item: T) => Promise<void>): Promise<void> {
  let ok = 0, failed = 0;
  await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title, cancellable: false },
    async (progress) => {
      for (let i = 0; i < items.length; i++) {
        progress.report({ message: `${i + 1}/${items.length}`, increment: 100 / items.length });
        try { await fn(items[i]); ok++; } catch (e) { failed++; log(`batch item failed: ${String(e)}`); }
      }
    });
  vscode.window.showInformationMessage(`Claude Sync: ${ok} done, ${failed} failed.`);
}
