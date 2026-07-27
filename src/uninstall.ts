import { settingsPath, removeHookEntries } from './core/hookSettings.ts';
import { removeLauncher } from './core/hookLauncher.ts';
import { fileLog } from './core/fileLog.ts';

// `vscode:uninstall` hook: a bare node script VS Code runs on the restart that
// follows the extension being removed. Without it, the Claude hooks we wrote into
// settings.json would outlive the extension and keep syncing on their own.
// Deliberately scoped to what we installed — user data under ~/.claude-sync-sessions
// (config, credentials, backups, push state, the local repo) is left in place so a
// reinstall picks up where it left off.

try {
  const removed = removeHookEntries(settingsPath());
  removeLauncher();
  fileLog(`uninstall: launcher removed, settings ${removed ? 'cleaned' : 'untouched'}`);
} catch (e) {
  // An uninstall must never fail loudly; worst case the stale entries remain.
  fileLog(`uninstall failed: ${String(e)}`);
}
