import type { CSSProperties } from 'react'

/**
 * Who an email is for. Every email NextChapter sends carries one of these as a
 * small line at the very bottom, so a forward, a screenshot or a spot-check in
 * an inbox shows at a glance which product surface produced it.
 *
 *   candidate     – job seekers and members (and prospects invited by anyone)
 *   coach         – coaches
 *   recruiter     – recruiters and recruiting firms
 *   employer      – employers, hiring managers, references and companies
 *   organization  – institutions and partner organizations
 *   supporter     – friends and family a candidate invited to cheer them on
 *   admin         – NextChapter internal (alerts and digests for the team)
 *   general       – mixed-audience updates (investors, friends and family, monthly report)
 */
export type EmailAudience =
  | 'candidate'
  | 'coach'
  | 'recruiter'
  | 'employer'
  | 'organization'
  | 'supporter'
  | 'admin'
  | 'general'

const LABEL: Record<EmailAudience, string> = {
  candidate: 'Candidate',
  coach: 'Coach',
  recruiter: 'Recruiter',
  employer: 'Employer',
  organization: 'Organization',
  supporter: 'Supporter',
  admin: 'Internal',
  general: 'Update',
}

// 11px #6b7280 on white is 4.8:1, which clears WCAG AA while staying quiet.
const style: CSSProperties = {
  margin: '24px 0 0',
  fontSize: '11px',
  lineHeight: '1.4',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: '#6b7280',
}

export function audienceLabel(audience: EmailAudience): string {
  return LABEL[audience]
}

export function AudienceTag({ audience }: { audience: EmailAudience }) {
  return <p style={style}>NextChapter · {LABEL[audience]}</p>
}

/** Matches the line AudienceTag renders, in HTML or plain text. */
const MARKER = /NextChapter · (Candidate|Coach|Recruiter|Employer|Organization|Supporter|Internal|Update)\b/i

export function hasAudienceTag(content: string): boolean {
  return MARKER.test(content)
}

const HTML_STYLE = 'margin:24px 0 0;font-size:11px;line-height:1.4;letter-spacing:0.04em;text-transform:uppercase;color:#6b7280'

/** For emails built as HTML strings: appends the same line, before </body> when there is one. */
export function withAudienceHtml(audience: EmailAudience, html: string): string {
  if (hasAudienceTag(html)) return html
  const tag = `<p style="${HTML_STYLE}">NextChapter · ${LABEL[audience]}</p>`
  const i = html.toLowerCase().lastIndexOf('</body>')
  return i === -1 ? html + tag : html.slice(0, i) + tag + html.slice(i)
}

/** For plain-text emails. */
export function withAudienceText(audience: EmailAudience, text: string): string {
  if (hasAudienceTag(text)) return text
  return `${text.replace(/\s+$/, '')}\n\n—\nNextChapter · ${LABEL[audience]}\n`
}
