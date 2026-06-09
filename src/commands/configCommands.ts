import * as vscode from 'vscode';
import * as os from 'node:os';
import * as path from 'node:path';
import { updateSetting, readSettings, mirrorConfigToDisk } from '../config/settings.ts';

const required = (label: string) => (v: string) => (v && v.trim() ? undefined : `${label} is required`);

// "git@host:1234/path" is scp syntax — git treats "1234" as a PATH and uses port 22,
// not a custom port. Warn and point at the ssh:// form, which honours the port.
function warnIfScpWithPort(url: string): void {
  if (!url.startsWith('ssh://') && /^[^/@]+@[^/:]+:\d+\//.test(url.trim())) {
    vscode.window.showWarningMessage(
      'Claude Sync: this Git URL uses scp syntax with a port-like segment. Git ignores it and connects on port 22. For a custom SSH port use the ssh:// form, e.g. ssh://git@host:PORT/user/repo.git',
    );
  }
}

export function registerConfigCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeSync.configureDevice', async () => {
      const cur = readSettings();
      // Sensible default for the projects root: the parent of the open workspace folder.
      const wsFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const defaultRoot = cur.projectsRoot || (wsFolder ? path.dirname(wsFolder) : '');

      const deviceName = await vscode.window.showInputBox({
        prompt: 'Device name (step 1/3)',
        value: cur.deviceName || os.hostname(),
        ignoreFocusOut: true,
        validateInput: required('Device name'),
      });
      if (deviceName === undefined) return;

      const projectsRoot = await vscode.window.showInputBox({
        prompt: 'Projects root — parent directory of your projects on this device (step 2/3)',
        value: defaultRoot,
        ignoreFocusOut: true,
        validateInput: required('Projects root'),
      });
      if (projectsRoot === undefined) return;

      const gitRepoUrl = await vscode.window.showInputBox({
        prompt: 'Git repository URL (SSH or HTTPS) — required for the Git backend (step 3/3)',
        placeHolder: 'git@host:user/sessions.git — leave empty to use a server instead',
        value: cur.gitRepoUrl,
        ignoreFocusOut: true,
      });
      if (gitRepoUrl === undefined) return;

      await updateSetting(context.secrets, 'deviceName', deviceName.trim());
      await updateSetting(context.secrets, 'projectsRoot', projectsRoot.trim());
      if (gitRepoUrl.trim()) {
        warnIfScpWithPort(gitRepoUrl);
        await updateSetting(context.secrets, 'gitRepoUrl', gitRepoUrl.trim());
        await updateSetting(context.secrets, 'backend', 'git');
      }

      if (!gitRepoUrl.trim() && !readSettings().serverUrl) {
        vscode.window.showWarningMessage('Claude Sync: device saved, but no Git repo set. Run "Set Git Repository URL" or "Set Server URL" before syncing.');
      } else {
        vscode.window.showInformationMessage('Claude Sync: configured. Ready to sync.');
      }
      vscode.commands.executeCommand('claudeSync.refreshLocal');
      vscode.commands.executeCommand('claudeSync.refreshRemote');
    }),

    vscode.commands.registerCommand('claudeSync.setGitRepo', async () => {
      const url = await vscode.window.showInputBox({ prompt: 'Git repository URL (SSH or HTTPS)', value: readSettings().gitRepoUrl, ignoreFocusOut: true });
      if (url === undefined) return;
      warnIfScpWithPort(url);
      await updateSetting(context.secrets, 'gitRepoUrl', url.trim());
      await updateSetting(context.secrets, 'backend', 'git');
      vscode.window.showInformationMessage('Claude Sync: Git repository set.');
    }),

    vscode.commands.registerCommand('claudeSync.setServer', async () => {
      const url = await vscode.window.showInputBox({ prompt: 'Server base URL', value: readSettings().serverUrl });
      if (url === undefined) return;
      const token = await vscode.window.showInputBox({ prompt: 'Server token (stored in SecretStorage)', password: true });
      await updateSetting(context.secrets, 'serverUrl', url);
      await updateSetting(context.secrets, 'backend', 'server');
      if (token) {
        await context.secrets.store('claudeSyncSessions.serverToken', token);
        await mirrorConfigToDisk(context.secrets);
      }
      vscode.window.showInformationMessage('Claude Sync: server set.');
    }),
  );
}
