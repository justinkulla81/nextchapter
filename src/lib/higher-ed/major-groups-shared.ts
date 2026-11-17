// Client-safe helpers for major groups (no database). The SQL in
// major-groups.ts applies the same normalization to roster majors.

/** "Computer Science & Engineering " -> "computer science and engineering". */
export function normalizeMajor(major: string): string {
  return major
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Staff type majors separated by commas, semicolons or new lines. Returns unique normalized keys, at most 20. */
export function parseMajors(raw: string): string[] {
  const keys = raw
    .split(/[,;\n]/)
    .map(normalizeMajor)
    .filter((k) => k.length > 0 && k.length <= 120)
  return [...new Set(keys)].slice(0, 20)
}
