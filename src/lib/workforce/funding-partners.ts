// Workforce Hub, pure parts: a partner's part in a funding application, the match it commits, and the ask the steward sends. No database
// and no email here: the ask is a draft the person copies or opens in their own mail program.

export const COMMIT_ROLES = [
  { key: 'LEAD', label: 'Lead applicant' },
  { key: 'PARTNER', label: 'Partner' },
  { key: 'MATCH', label: 'Brings match' },
  { key: 'EVIDENCE', label: 'Provides data or letters' },
] as const
export type CommitRole = (typeof COMMIT_ROLES)[number]['key']
export const commitRoleLabel = (k: string) => COMMIT_ROLES.find((r) => r.key === k)?.label ?? k
export const isCommitRole = (v: unknown): v is CommitRole => COMMIT_ROLES.some((r) => r.key === v)

export const COMMIT_STATUSES = [
  { key: 'ASKED', label: 'Asked' },
  { key: 'COMMITTED', label: 'Committed' },
  { key: 'DECLINED', label: 'Declined' },
] as const
export type CommitStatus = (typeof COMMIT_STATUSES)[number]['key']
export const commitStatusLabel = (k: string) => COMMIT_STATUSES.find((s) => s.key === k)?.label ?? k
export const isCommitStatus = (v: unknown): v is CommitStatus => COMMIT_STATUSES.some((s) => s.key === v)

export type Commitment = { role: string; status: string; amount: number | null }

/** Match committed (only partners who said yes), match still only asked, and what is left to find against the amount required. */
export function matchTotals(commits: Commitment[], required: number | null) {
  const sum = (status: string) => commits.filter((c) => c.status === status).reduce((n, c) => n + (c.amount ?? 0), 0)
  const committed = sum('COMMITTED')
  const asked = sum('ASKED')
  return { committed, asked, left: required === null ? null : Math.max(0, required - committed) }
}

export type CommitInput = { partnerName: string; partnerId: string | null; role: CommitRole; status: CommitStatus; amount: number | null; note: string | null }

/** Reads one commitment as typed. Plain-words error, or the cleaned value. */
export function validateCommitment(f: { get: (k: string) => string | null }): { error: string } | { value: CommitInput } {
  const s = (k: string, max: number) => (f.get(k) ?? '').trim().slice(0, max)
  const partnerName = s('partnerName', 120)
  if (!partnerName) return { error: 'Add the name of the partner.' }
  const role = s('role', 20)
  if (!isCommitRole(role)) return { error: 'Pick the partner’s part in the application.' }
  const status = s('status', 20) || 'ASKED'
  if (!isCommitStatus(status)) return { error: 'Pick where the partner stands: asked, committed or declined.' }
  const raw = s('amount', 12).replace(/[$,\s]/g, '')
  const amount = raw ? Number(raw) : null
  if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000)) return { error: 'The match must be a dollar amount, such as 25000.' }
  return { value: { partnerName, partnerId: s('partnerId', 40) || null, role, status, amount: amount === null ? null : Math.round(amount), note: s('note', 400) || null } }
}

export const dollars = (n: number | null | undefined) => (n == null ? '—' : `$${n.toLocaleString('en-US')}`)

/** The message the steward sends a partner, from the application. */
export function askText(args: { from: string; partner: string; application: string; funder: string | null; due: string | null; role: string; amount: number | null }): string {
  const part = args.role === 'MATCH' && args.amount ? `a match of ${dollars(args.amount)}` : args.role === 'LEAD' ? 'serving as lead applicant' : args.role === 'EVIDENCE' ? 'a letter or data for the application' : 'joining as a partner'
  return `Hello ${args.partner},\n\n${args.from} is pursuing ${args.application}${args.funder ? ` from ${args.funder}` : ''}${args.due ? `, due ${args.due}` : ''}. We would like to ask ${args.partner} about ${part}. Could we find 20 minutes this week to talk it through?\n\nThank you.`
}
