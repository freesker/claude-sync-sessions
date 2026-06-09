export interface TransformTokens {
  projectRoot: string; // absolute project path (source on normalize, target on denormalize)
  home: string;        // absolute home dir
}

// Build the search variants for an absolute path so we catch posix, raw
// backslash, and JSON-escaped backslash forms. Longest first to avoid partial hits.
function searchVariants(absPath: string): string[] {
  const posix = absPath.replace(/\\/g, '/');
  const win = posix.replace(/\//g, '\\');
  const winJsonEscaped = win.replace(/\\/g, '\\\\');
  return [...new Set([winJsonEscaped, win, posix])].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

function replaceAll(haystack: string, needle: string, replacement: string): string {
  if (!needle) return haystack;
  return haystack.split(needle).join(replacement);
}

// Replace concrete absolute paths with tokens. PROJECT_ROOT first (more specific),
// then HOME — so a project under HOME still tokenizes to ${PROJECT_ROOT}.
export function normalizeLine(line: string, t: TransformTokens): string {
  let out = line;
  for (const v of searchVariants(t.projectRoot)) out = replaceAll(out, v, '${PROJECT_ROOT}');
  for (const v of searchVariants(t.home)) out = replaceAll(out, v, '${HOME}');
  return out;
}

// Replace tokens with the target machine's paths. We insert forward-slash form,
// which is JSON-safe (no characters needing escaping) and accepted by Claude Code.
export function denormalizeLine(line: string, t: TransformTokens): string {
  const projPosix = t.projectRoot.replace(/\\/g, '/');
  const homePosix = t.home.replace(/\\/g, '/');
  let out = line;
  out = replaceAll(out, '${PROJECT_ROOT}', projPosix);
  out = replaceAll(out, '${HOME}', homePosix);
  return out;
}
