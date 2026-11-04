// The saved-job closure alert, pure parts: how a closure is worded for the owner, how rows group by job and by member,
// and the owner's daily digest. Tested in src/test/saved-job-closures.test.ts. The database and the sending are in
// saved-job-closures.ts.

import { buttonHtml, callout, emailDocument, escapeHtml } from '@/lib/help/email-layout'

/** ExclusiveJobPosting.closeReason values that mean the job is no longer open to apply to (src/lib/jobs/job-status.ts). 'duplicate' is excluded: that job is still listed under another URL. */
export const CLOSURE_REASONS = ['removed', 'aged_out', 'expired', 'expired_checked', 'manual'] as const

const OWNER_REASON: Record<string, string> = {
  expired: 'Expired: not reconfirmed before its expiry date',
  aged_out: 'Aged out: past our freshness window',
  removed: 'Removed: the employer stopped listing it',
  expired_checked: 'Found closed: our liveness check says the posting is gone',
  manual: 'Taken down by us',
}
export const ownerReason = (reason: string): string => OWNER_REASON[reason] ?? reason

export interface Closure {
  candidateId: string
  jobId: string
  title: string
  companyName: string
  closeReason: string
  archivedAt: Date
  disclosure: string | null
  level: string | null
  targetFunction: string | null
  locationState: string | null
  workArrangement: string | null
}

export interface MemberLine { id: string; name: string | null; email: string | null }

export interface DigestJob {
  title: string
  company: string
  reason: string
  closedAt: Date
  savers: MemberLine[]
}

/** One entry per closed job, with everyone who saved it. */
export function groupByJob(rows: Closure[], member: (id: string) => MemberLine): DigestJob[] {
  const by = new Map<string, DigestJob>()
  for (const r of rows) {
    const e = by.get(r.jobId) ?? { title: r.title, company: r.disclosure === 'CONFIDENTIAL' ? 'Confidential search' : r.companyName, reason: r.closeReason, closedAt: r.archivedAt, savers: [] }
    e.savers.push(member(r.candidateId))
    by.set(r.jobId, e)
  }
  return [...by.values()].sort((a, b) => b.savers.length - a.savers.length || a.title.localeCompare(b.title))
}

export function groupByMember(rows: Closure[]): Map<string, Closure[]> {
  const by = new Map<string, Closure[]>()
  for (const r of rows) (by.get(r.candidateId) ?? by.set(r.candidateId, []).get(r.candidateId)!).push(r)
  return by
}

export interface DigestInput {
  jobs: DigestJob[]
  memberCount: number
  /** What happened with the members' own emails. */
  memberEmails: { mode: 'sent'; sent: number } | { mode: 'off'; wouldSend: number }
  adminUrl: string
}

const who = (m: MemberLine) => [m.name, m.email ? `<${m.email}>` : null].filter(Boolean).join(' ') || 'A member'

export function closureDigestEmail(d: DigestInput): { subject: string; text: string; html: string } {
  const n = d.jobs.length
  const subject = `${n} saved ${n === 1 ? 'job was' : 'jobs were'} taken down: ${d.memberCount} ${d.memberCount === 1 ? 'member' : 'members'} saved ${n === 1 ? 'it' : 'them'}`
  const memberLine = d.memberEmails.mode === 'sent'
    ? `Emails sent to ${d.memberEmails.sent} ${d.memberEmails.sent === 1 ? 'member' : 'members'}, each with similar open jobs.`
    : `Member emails are off (SAVED_JOB_CLOSURE_EMAILS). ${d.memberEmails.wouldSend} ${d.memberEmails.wouldSend === 1 ? 'member' : 'members'} would have been emailed.`
  const text = [
    subject,
    memberLine,
    '',
    ...d.jobs.flatMap((j) => [`${j.title} at ${j.company}`, `  ${ownerReason(j.reason)}`, ...j.savers.map((s) => `  Saved by ${who(s)}`), '']),
    `Members: ${d.adminUrl}`,
  ].join('\n')
  const rows = d.jobs.map((j) => `<div style="margin:0 0 18px"><div style="font-size:15px;font-weight:600">${escapeHtml(j.title)} <span style="font-weight:400">at ${escapeHtml(j.company)}</span></div><div style="font-size:13px;color:#5f6368">${escapeHtml(ownerReason(j.reason))}</div><div style="font-size:14px;margin-top:4px">${j.savers.map((s) => escapeHtml(who(s))).join('<br>')}</div></div>`).join('')
  const html = emailDocument({
    preheader: subject,
    label: 'Saved jobs taken down',
    bodyHtml: `${callout(escapeHtml(memberLine))}${rows}${buttonHtml('Open members', d.adminUrl)}`,
  })
  return { subject, text, html }
}
