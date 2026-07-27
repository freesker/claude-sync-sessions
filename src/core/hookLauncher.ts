import * as fs from 'node:fs';
import { binDir, hookLauncherPath, hookLauncherStampPath } from '../config/appPaths.ts';

// The launcher is a standalone copy of the bundled hook entrypoint rather than a
// `require()` into the extension folder: that folder is version-suffixed and is
// deleted on every update, which left the installed Claude hooks pointing at a
// missing file. out/hook.js is a self-contained esbuild bundle with no `vscode`
// import, so copying it keeps the hooks working across updates. The stamp file
// records which extension version the copy came from.

export function launcherPresent(home?: string): boolean {
  return fs.existsSync(hookLauncherPath(home));
}

function stampedVersion(home?: string): string {
  try { return fs.readFileSync(hookLauncherStampPath(home), 'utf8').trim(); } catch { return ''; }
}

/** Copies the hook bundle to the launcher path. Returns true if it wrote anything. */
export function syncLauncher(bundlePath: string, version: string, opts: { home?: string; force?: boolean } = {}): boolean {
  const { home, force } = opts;
  if (!force && launcherPresent(home) && stampedVersion(home) === version) return false;
  fs.mkdirSync(binDir(home), { recursive: true });
  fs.copyFileSync(bundlePath, hookLauncherPath(home));
  fs.writeFileSync(hookLauncherStampPath(home), version);
  return true;
}

export function removeLauncher(home?: string): void {
  fs.rmSync(hookLauncherPath(home), { force: true });
  fs.rmSync(hookLauncherStampPath(home), { force: true });
}
