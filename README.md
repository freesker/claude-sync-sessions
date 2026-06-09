# Claude Sync Sessions

A VSCode extension that syncs your Claude Code sessions — messages, sub-agent transcripts,
todos, and file-history — between machines via a private Git repository (e.g. Forgejo) or a
self-hosted HTTP server. It rewrites the absolute project paths embedded in sessions so a
conversation started on one machine resumes correctly on another, even when your projects
live under a different directory.

## Install (from source)

```bash
npm install
npm run compile
```

Then press <kbd>F5</kbd> in VSCode to launch an Extension Development Host, or run
`npm run package` to produce a `.vsix` and install it via "Extensions: Install from VSIX…".

## Configure

- **Claude Sync: Configure Device** — set a device name and your _projects root_ (the parent
  directory that contains your projects on this machine).
- **Claude Sync: Set Git Repository URL** — point at a private Git/Forgejo repo (SSH or HTTPS).
  Authentication is handled by your system `git`.
- For a self-hosted server instead: **Claude Sync: Set Server URL** (the access token is stored
  in VSCode SecretStorage, never in plain settings). Set `claudeSyncSessions.backend` to `server`.

## Use

The **Claude Sync** activity-bar icon opens two views:

- **Local Sessions** — your sessions grouped by project. The inline **↑** uploads one session;
  the title-bar **Upload All** uploads every local session. A project's inline button uploads
  just that project.
- **Remote Bundles** — sessions stored in your repo/server. The inline **↓** downloads one;
  the title-bar **Download All** downloads everything.

Bulk operations show progress and a summary (done / failed); a single failure never aborts the batch.

### Automatic sync (hooks)

**Claude Sync: Install Auto-Sync Hooks** registers Claude Code `SessionEnd` (push) and
`SessionStart` (pull) hooks in `~/.claude/settings.json`. These run even when Claude Code is used
from a terminal. The status bar shows **Claude Sync: Hooks ON/OFF** (click to toggle).
**Remove Auto-Sync Hooks** cleanly removes only the entries this extension added.

## How paths are handled

Claude Code sessions embed absolute project paths in many places. On upload, the project path and
your home directory are replaced with the tokens `${PROJECT_ROOT}` and `${HOME}`. On download, those
tokens are rewritten to this device's paths (computed from `projectsRoot`). Each bundle carries a
SHA-256 checksum that is verified on download.

## Conflicts & backups

Conflicts use **last-writer-wins**: when downloading, if your local copy of a session is _newer_
than the incoming bundle it is kept; otherwise the local copy is backed up under
`~/.claude-sync-sessions/backups/<timestamp>/` before being overwritten.

## Settings

| Setting                                 | Default | Purpose                                               |
| --------------------------------------- | ------- | ----------------------------------------------------- |
| `claudeSyncSessions.backend`            | `git`   | `git` or `server`.                                    |
| `claudeSyncSessions.gitRepoUrl`         | `""`    | Private Git/Forgejo repo URL.                         |
| `claudeSyncSessions.serverUrl`          | `""`    | Self-hosted server base URL.                          |
| `claudeSyncSessions.deviceName`         | `""`    | This device's identifier.                             |
| `claudeSyncSessions.projectsRoot`       | `""`    | Parent directory of your projects on this device.     |
| `claudeSyncSessions.autoRefreshOnFocus` | `true`  | Refresh local sessions when the window regains focus. |

The server token is stored in VSCode SecretStorage, not in settings.

## Data locations

- Local Git mirror: `~/.claude-sync-sessions/repo`
- Conflict backups: `~/.claude-sync-sessions/backups/`
- Hooks launcher: `~/.claude-sync-sessions/bin/hook.cjs`
- Shared config (read by hooks): `~/.claude-sync-sessions/config.json`
- Hook log: `~/.claude-sync-sessions/hook.log`

## Roadmap / TODO

- [ ] **Self-hosted server.** Build the actual sync server that implements the client's API
      contract (`POST /api/sessions/push`, `GET /api/sessions`, `GET /api/sessions/{prefix}`,
      `GET /health`). Only the client is implemented today.
- [ ] **Server backend from hooks.** Hooks currently support the Git backend only (the vscode-free
      config has no server token); extend hook auto-sync to the server backend.
- [ ] **Windows end-to-end verification.** Verify project-dir-name encoding and the path round-trip
      on Windows (drive letters / backslashes), and emit native backslash paths on download
      (denormalize currently always writes forward slashes).
- [ ] **Compression of bundles.** Bundles are gzipped already; consider per-message delta/append
      sync for very large sessions to reduce repeated full re-uploads.
