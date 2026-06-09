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

export interface DenormalizeOptions { windows?: boolean }

// Replace tokens with the target machine's paths. For posix targets we emit forward
// slashes (JSON-safe as-is). For windows targets the substituted project/home path is
// emitted as native backslashes, escaped for embedding inside JSON strings. We convert
// ONLY the substituted path — never the rest of the line — so slashes in unrelated
// content (URLs, code, prose) are left intact. A path continuation that followed the
// token (e.g. the "/a.ts" in "${PROJECT_ROOT}/a.ts") keeps its forward slash; Windows
// accepts such mixed separators.
export function denormalizeLine(line: string, t: TransformTokens, opts: DenormalizeOptions = {}): string {
  const toTarget = (p: string): string => {
    const posix = p.replace(/\\/g, '/');
    return opts.windows ? posix.replace(/\//g, '\\\\') : posix;
  };
  let out = line;
  out = replaceAll(out, '${PROJECT_ROOT}', toTarget(t.projectRoot));
  out = replaceAll(out, '${HOME}', toTarget(t.home));
  return out;
}
