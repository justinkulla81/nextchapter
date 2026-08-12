// Contact names arrive from several places that don't reliably capitalize
// (raw Gmail headers, CSV exports, manual entry) — "justin kulla" and
// "JUSTIN KULLA" both show up. Only fixes names that are ALL lowercase or
// ALL uppercase; anything already mixed-case (McDonald, O'Brien, DeShawn)
// is left untouched rather than risking a wrong "fix".
export function formatDisplayName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return trimmed

  const isAllLower = trimmed === trimmed.toLowerCase()
  const isAllUpper = trimmed === trimmed.toUpperCase()
  if (!isAllLower && !isAllUpper) return trimmed

  return trimmed
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
