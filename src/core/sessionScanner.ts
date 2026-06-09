import * as fs from 'node:fs';
import * as path from 'node:path';
import { projectsDir } from './claudePaths.ts';
import type { LocalSession } from '../types.ts';

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (b && typeof b === 'object' && 'text' in b ? String((b as any).text ?? '') : ''))
      .join(' ')
      .trim();
  }
  return '';
}

export function extractFirstPrompt(lines: string[]): string {
  for (const line of lines) {
    if (!line.trim()) continue;
    let obj: any;
    try { obj = JSON.parse(line); } catch { continue; }
    if (obj?.type !== 'user' || obj?.isMeta) continue;
    if (obj?.message?.role !== 'user') continue;
    const text = contentToText(obj.message.content);
    if (text) return text.slice(0, 120);
  }
  return '(no prompt)';
}

function readCwd(lines: string[]): string | null {
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (typeof obj?.cwd === 'string' && obj.cwd) return obj.cwd;
    } catch { /* skip */ }
  }
  return null;
}

export function scanLocalSessions(claudeDirPath?: string): LocalSession[] {
  const root = projectsDir(claudeDirPath);
  if (!fs.existsSync(root)) return [];
  const out: LocalSession[] = [];
  for (const projectDir of fs.readdirSync(root)) {
    const projPath = path.join(root, projectDir);
    if (!fs.statSync(projPath).isDirectory()) continue;
    for (const file of fs.readdirSync(projPath)) {
      if (!file.endsWith('.jsonl') || file.startsWith('agent-')) continue;
      const jsonlPath = path.join(projPath, file);
      const stat = fs.statSync(jsonlPath);
      if (stat.size === 0) continue;
      const lines = fs.readFileSync(jsonlPath, 'utf8').split('\n');
      const cwd = readCwd(lines);
      if (!cwd) continue;
      out.push({
        sessionId: file.replace(/\.jsonl$/, ''),
        projectDir,
        projectPath: cwd,
        projectName: path.basename(cwd),
        jsonlPath,
        firstPrompt: extractFirstPrompt(lines),
        messageCount: lines.filter((l) => l.trim()).length,
        modified: stat.mtime,
      });
    }
  }
  return out.sort((a, b) => b.modified.getTime() - a.modified.getTime());
}
