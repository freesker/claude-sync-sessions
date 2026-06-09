import * as fs from 'node:fs';
import { hookLogPath } from '../config/appPaths.ts';

// vscode-free file logger used by the hooks entrypoint (which has no OutputChannel).
export function fileLog(msg: string): void {
  try { fs.appendFileSync(hookLogPath(), `[${new Date().toISOString()}] ${msg}\n`); } catch { /* ignore */ }
}
