export interface ProjectRef {
  name: string;                 // basename of the project directory
  relativeToRoot: string | null; // path relative to device projectsRoot, or null
  tokenizedPath: string;        // always "${PROJECT_ROOT}"
  originalPath: string;         // absolute project path on the source machine
}

export interface SessionMeta {
  firstPrompt: string;
  messageCount: number;
  modified: string;             // ISO timestamp
}

export interface TodoFile {
  filename: string;             // e.g. "<uuid>-agent-<uuid>.json"
  content: string;              // raw JSON text
}

export interface SessionPayload {
  sessionId: string;
  project: ProjectRef;
  messages: string[];                  // normalized jsonl lines (one per line)
  agents: Record<string, string>;      // "agent-xxxx.jsonl" -> normalized content
  todos: TodoFile[];
  fileHistory: Record<string, string>; // relpath under <uuid>/ -> base64 content
  meta: SessionMeta;
}

export interface Bundle {
  version: '1';
  exportedAt: string;     // ISO
  sourceDevice: string;
  updatedAt: string;      // ISO = max mtime of source files (for last-writer-wins)
  session: SessionPayload;
  checksum: string;       // sha256 hex over JSON.stringify(session)
}

export interface LocalSession {
  sessionId: string;
  projectDir: string;     // encoded directory name under ~/.claude/projects
  projectPath: string;    // absolute path (read from cwd inside the jsonl)
  projectName: string;    // basename of projectPath
  jsonlPath: string;      // absolute path to the <uuid>.jsonl
  firstPrompt: string;
  messageCount: number;
  modified: Date;
}

export interface RemoteBundle {
  sessionId: string;
  project: string;        // project folder name in the repo
  filename: string;       // "<uuid>.bundle.gz"
  label: string;          // human label (commit subject or derived)
  updatedAt?: string;     // ISO if known
}

export interface SyncConfig {
  deviceName: string;
  projectsRoot: string;   // forward-slash absolute path
  backend: 'git' | 'server';
  gitRepoUrl: string;
  serverUrl: string;
}
