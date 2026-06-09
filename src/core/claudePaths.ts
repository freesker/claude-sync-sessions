import * as os from 'node:os';
import * as path from 'node:path';

export function claudeDir(home: string = os.homedir()): string {
  return path.join(home, '.claude');
}
export function projectsDir(claude: string = claudeDir()): string {
  return path.join(claude, 'projects');
}
export function todosDir(claude: string = claudeDir()): string {
  return path.join(claude, 'todos');
}
export function fileHistoryDir(claude: string = claudeDir()): string {
  return path.join(claude, 'file-history');
}

// Claude Code encodes the project's absolute path into the directory name by
// replacing path separators, the Windows drive colon, AND dots with '-'.
// e.g. /Users/me/.ssh -> -Users-me--ssh ; /Volumes/x/repos/app -> -Volumes-x-repos-app
export function encodeProjectDir(absPath: string): string {
  return absPath.replace(/[\/\\:.]/g, '-');
}
