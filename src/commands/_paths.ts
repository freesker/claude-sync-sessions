import * as os from 'node:os';
import { claudeDir } from '../core/claudePaths.ts';
import { backupsDir as appBackups } from '../config/appPaths.ts';

export function claudeDirFromHome(): string { return claudeDir(os.homedir()); }
export function backupsDir(): string { return appBackups(); }
