import type { RemoteBundle } from '../types.ts';

export interface SyncBackend {
  ensure(): Promise<void>;
  list(): Promise<RemoteBundle[]>;
  // push raw gzip bytes of a bundle into <project>/<filename>
  push(project: string, filename: string, bytes: Buffer, label: string): Promise<void>;
  // fetch the gzip bytes for a session by uuid prefix
  pull(sessionIdPrefix: string): Promise<Buffer>;
}
