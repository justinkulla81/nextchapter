// An email to the owner each time a member follows a company or expresses interest in a recruiting firm.
// The message itself is pure (follow-alert.test.ts); the send is in follow-alert-server.ts.

import { buttonHtml, callout, emailDocument, escapeHtml, factsHtml } from '@/lib/help/email-layout'

export type FollowKind = 'recruiter' | 'company'

export interface FollowAlert {
  kind: FollowKind
  /** The company or firm name. */
  target: string
  /** Where the follow came from: "directory", "search_firm_page", "recommendation", "package", "employer_email_signup" ... */
  source: string | null
  member: { id: string; name: string | null; email: string | null; registered: boolean }
  adminUrl: string
}

export function followAlertEmail(a: FollowAlert): { subject: string; text: string; html: string } {
  const who = a.member.name || a.member.email || 'A visitor'
  const what = a.kind === 'recruiter' ? 'expressed interest in' : 'followed'
  const subject = `${who} ${what} ${a.target}`
  const kindLabel = a.kind === 'recruiter' ? 'Recruiting firm' : 'Company'
  const rows: [string, string | null][] = [
    [kindLabel, a.target],
    ['Member', a.member.name],
    ['Email', a.member.email],
    ['Account', a.member.registered ? 'Registered' : 'Not registered yet (still in onboarding)'],
    ['From', a.source],
  ]
  const text = [subject, '', ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`), '', `Open the member: ${a.adminUrl}`].join('\n')
  const html = emailDocument({
    preheader: subject,
    label: a.kind === 'recruiter' ? 'New recruiter interest' : 'New company follow',
    bodyHtml: `${callout(`<strong>${escapeHtml(who)}</strong> ${what} <strong>${escapeHtml(a.target)}</strong>.`)}${factsHtml(rows)}${buttonHtml('Open the member', a.adminUrl)}`,
  })
  return { subject, text, html }
}
