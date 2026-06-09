import type { RemoteBundle, SyncConfig } from '../types.ts';
import type { SyncBackend } from './syncBackend.ts';

export class ServerBackend implements SyncBackend {
  constructor(private cfg: SyncConfig, private token?: string, private logFn: (m: string) => void = () => {}) {}

  private headers(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }
  private base(): string { return this.cfg.serverUrl.replace(/\/+$/, ''); }

  async ensure(): Promise<void> {
    const r = await fetch(`${this.base()}/health`, { headers: this.headers() });
    if (!r.ok) throw new Error(`Server health check failed: ${r.status}`);
  }

  async list(): Promise<RemoteBundle[]> {
    const r = await fetch(`${this.base()}/api/sessions`, { headers: this.headers() });
    if (!r.ok) throw new Error(`list failed: ${r.status}`);
    const data = (await r.json()) as { bundles: Array<{ sessionId: string; project: string; filename: string; label?: string; updatedAt?: string }> };
    return data.bundles.map((b) => ({
      sessionId: b.sessionId, project: b.project, filename: b.filename,
      label: b.label ?? `${b.project} · ${b.sessionId.slice(0, 8)}`, updatedAt: b.updatedAt,
    }));
  }

  async push(project: string, filename: string, bytes: Buffer, _label: string): Promise<void> {
    const url = `${this.base()}/api/sessions/push?project=${encodeURIComponent(project)}&filename=${encodeURIComponent(filename)}`;
    const r = await fetch(url, { method: 'POST', headers: { ...this.headers(), 'Content-Type': 'application/gzip' }, body: bytes });
    if (!r.ok) throw new Error(`push failed: ${r.status}`);
  }

  async pull(sessionIdPrefix: string): Promise<Buffer> {
    const r = await fetch(`${this.base()}/api/sessions/${encodeURIComponent(sessionIdPrefix)}`, { headers: this.headers() });
    if (!r.ok) throw new Error(`pull failed: ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  }
}
