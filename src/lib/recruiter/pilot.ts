// Pilot activation: turn pasted "firm, website, contact email" lines into rows, and split them into two arms.
// Pure, so the parsing and the split can be tested. Creating the firms is in recruiter-settings/actions.ts.

export const PILOT_MAX_LINES = 100

export type PilotRow = { name: string; website: string; email: string }
export type PilotParse = { rows: PilotRow[]; errors: { line: number; text: string; message: string }[] }

const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/

// One firm per line: name, website, contact email (comma or tab separated). A header line is skipped.
export function parsePilotLines(text: string): PilotParse {
  const rows: PilotRow[] = []
  const errors: PilotParse['errors'] = []
  const seen = new Set<string>()
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  lines.forEach((raw, i) => {
    if (!raw) return
    const parts = raw.split(/\t|,/).map((p) => p.trim())
    if (i === 0 && /firm|name/i.test(parts[0] ?? '') && !parts.some((p) => EMAIL.test(p))) return
    const [name, website = '', email = ''] = parts
    const fail = (message: string) => errors.push({ line: i + 1, text: raw.slice(0, 80), message })
    if (!name) return fail('Add the firm name.')
    if (!EMAIL.test(email.toLowerCase())) return fail('Add a contact email at the firm, so only someone there can claim the link.')
    const key = email.toLowerCase()
    if (seen.has(key)) return fail('This email is already on an earlier line.')
    seen.add(key)
    rows.push({ name, website, email: key })
  })
  if (rows.length + errors.length > PILOT_MAX_LINES) {
    return { rows: [], errors: [{ line: 0, text: '', message: `Paste at most ${PILOT_MAX_LINES} firms at a time. You pasted ${rows.length + errors.length}.` }] }
  }
  return { rows, errors }
}

// A stable A/B split on the address, so a firm keeps its arm if the list is pasted again.
export function pilotArm(email: string): 'A' | 'B' {
  // FNV-1a, then a final mix so the low bit depends on the whole address, not just its last letters.
  let h = 2166136261
  for (const ch of email.trim().toLowerCase()) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  h ^= h >>> 15
  h = Math.imul(h, 2246822519) >>> 0
  h ^= h >>> 13
  return (h & 1) === 0 ? 'A' : 'B'
}

export const PILOT_ARM_LABELS = { A: 'Free branded résumé page', B: 'Free CRM that tracks your candidates' } as const
