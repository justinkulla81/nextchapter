import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { sendEmployerStatementLinkEmail } from '@/lib/email/send-org-claim-email'
import { checkClaimEmail, cleanDomain } from '@/lib/org-claims/rules'
import { CLAIM_TOKEN_DAYS, hashClaimToken, hashIp, newClaimToken } from '@/lib/org-claims/token'
import { SITE_URL } from '@/lib/org-claims/urls'
import { getCompanies } from '@/lib/warn/layoff-pages'
import { MAX_STATEMENTS_PER_EMAIL_PER_HOUR, MAX_STATEMENTS_PER_IP_PER_HOUR, checkStatementText } from './rules'

// Employer statements next to WARN notices (public pages: /layoffs/company/<slug>, /network/company/<slug>). The filing is never changed or hidden: a
// statement is an addition, shown only after the author confirms a work email and a person on the team approves it.

const siteUrl = () => (process.env.NEXT_PUBLIC_APP_URL || SITE_URL).replace(/\/$/, '')

export interface RequestStatementInput {
  /** The employer's layoff-page slug (/layoffs/company/<slug>). */
  companySlug: string
  noticeId: string
  name: string
  title: string
  email: string
  text: string
  ip: string | null
}
export type RequestStatementResult = { ok: true; email: string } | { ok: false; error: string }

/** The domain a statement author's work email must be at: the CRM email domain of the matched company, else its website's host. Null when unmatched. */
async function noticeCompanyDomain(noticeId: string): Promise<string | null> {
  const n = await prisma.warnNotice.findUnique({ where: { id: noticeId }, select: { companyId: true } })
  if (!n?.companyId) return null
  const c = await prisma.company.findUnique({
    where: { id: n.companyId },
    select: { website: true, crmOrganizations: { select: { emailDomain: true }, take: 1 } },
  })
  const fromCrm = cleanDomain(c?.crmOrganizations[0]?.emailDomain)
  if (fromCrm) return fromCrm
  try {
    return c?.website ? cleanDomain(new URL(/^https?:\/\//.test(c.website) ? c.website : `https://${c.website}`).hostname) : null
  } catch {
    return null
  }
}

export async function requestStatement(input: RequestStatementInput): Promise<RequestStatementResult> {
  const company = (await getCompanies()).get(input.companySlug)
  if (!company) return { ok: false, error: 'This page is no longer available.' }
  const notice = company.notices.find((n) => n.id === input.noticeId)
  if (!notice) return { ok: false, error: 'Choose one of the notices listed on the page.' }

  const name = input.name.trim().replace(/\s+/g, ' ').slice(0, 120)
  const title = input.title.trim().slice(0, 120)
  if (name.split(' ').length < 2) return { ok: false, error: 'Enter your first and last name.' }
  if (title.length < 2) return { ok: false, error: 'Enter your title.' }
  const text = checkStatementText(input.text)
  if (!text.ok) return { ok: false, error: text.message }
  const check = checkClaimEmail(input.email, await noticeCompanyDomain(notice.id))
  if (!check.ok) return { ok: false, error: check.message }

  const ipHash = input.ip ? hashIp(input.ip) : null
  const since = new Date(Date.now() - 3_600_000)
  const [byIp, byEmail] = await Promise.all([
    ipHash ? prisma.employerStatement.count({ where: { ipHash, createdAt: { gte: since } } }) : Promise.resolve(0),
    prisma.employerStatement.count({ where: { authorEmail: check.email, createdAt: { gte: since } } }),
  ])
  if (byIp >= MAX_STATEMENTS_PER_IP_PER_HOUR || byEmail >= MAX_STATEMENTS_PER_EMAIL_PER_HOUR) return { ok: false, error: 'Too many requests. Wait an hour and try again, or use the link in the email we already sent.' }

  const { token, tokenHash, expiresAt } = newClaimToken()
  // An older unconfirmed request for the same notice from the same person stops working; the newest link is the only live one.
  await prisma.employerStatement.updateMany({ where: { warnNoticeId: notice.id, authorEmail: check.email, status: 'PENDING_EMAIL' }, data: { tokenExpiresAt: new Date() } })
  const row = await prisma.employerStatement.create({
    data: { companySlug: company.slug, warnNoticeId: notice.id, body: text.text, authorName: name, authorTitle: title, authorEmail: check.email, emailDomain: check.domain, tokenHash, tokenExpiresAt: expiresAt, ipHash },
    select: { id: true },
  })
  const sent = await sendEmployerStatementLinkEmail({ to: check.email, name, orgName: company.name, verifyUrl: `${siteUrl()}/layoffs/company/${company.slug}/statement/verify/${token}`, days: CLAIM_TOKEN_DAYS })
  captureServerEvent(`employer-statement:${company.slug}`, 'employer_statement_requested', { companySlug: company.slug, noticeId: notice.id, statementId: row.id, emailDomain: check.domain, emailSent: sent, domainKnown: !!(await noticeCompanyDomain(notice.id)) })
  if (!sent) return { ok: false, error: 'We could not send the confirmation email. Try again in a few minutes.' }
  return { ok: true, email: check.email }
}

export type VerifyStatementResult = 'verified' | 'already' | 'expired' | 'invalid'

/** Step 2: the author opens the emailed link and confirms. The statement then waits for a person on the team. */
export async function verifyStatement(token: string): Promise<VerifyStatementResult> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return 'invalid'
  const row = await prisma.employerStatement.findUnique({ where: { tokenHash: hashClaimToken(token) }, select: { id: true, companySlug: true, warnNoticeId: true, status: true, emailVerifiedAt: true, tokenExpiresAt: true } })
  if (!row) return 'invalid'
  if (row.emailVerifiedAt) return 'already'
  if (row.tokenExpiresAt.getTime() <= Date.now()) return 'expired'
  await prisma.employerStatement.update({ where: { id: row.id }, data: { emailVerifiedAt: new Date(), status: 'PENDING_REVIEW' } })
  captureServerEvent(`employer-statement:${row.companySlug}`, 'employer_statement_email_confirmed', { companySlug: row.companySlug, noticeId: row.warnNoticeId, statementId: row.id })
  return 'verified'
}

export interface PublicStatement { noticeId: string; body: string; authorTitle: string; approvedAt: Date }

/** Approved statements for a company, newest per notice. Fail-soft: a missing table reads as none. */
export async function approvedStatements(companySlug: string): Promise<PublicStatement[]> {
  try {
    const rows = await prisma.employerStatement.findMany({ where: { companySlug, status: 'APPROVED' }, orderBy: { reviewedAt: 'desc' }, select: { warnNoticeId: true, body: true, authorTitle: true, reviewedAt: true } })
    const seen = new Set<string>()
    const out: PublicStatement[] = []
    for (const r of rows) {
      if (seen.has(r.warnNoticeId)) continue
      seen.add(r.warnNoticeId)
      out.push({ noticeId: r.warnNoticeId, body: r.body, authorTitle: r.authorTitle, approvedAt: r.reviewedAt ?? new Date() })
    }
    return out
  } catch {
    return []
  }
}

/** Approved statements keyed by notice id, in the shape NoticeTable shows them. */
export async function approvedStatementMap(companySlug: string, employer: string): Promise<Record<string, { body: string; authorTitle: string; approvedAt: Date; employer: string }>> {
  const out: Record<string, { body: string; authorTitle: string; approvedAt: Date; employer: string }> = {}
  for (const st of await approvedStatements(companySlug)) out[st.noticeId] = { body: st.body, authorTitle: st.authorTitle, approvedAt: st.approvedAt, employer }
  return out
}

export async function pendingStatements() {
  const rows = await prisma.employerStatement.findMany({ where: { status: 'PENDING_REVIEW' }, orderBy: { createdAt: 'asc' }, take: 100 })
  const companies = await getCompanies()
  return rows.map((r) => {
    const c = companies.get(r.companySlug)
    return { ...r, companyName: c?.name ?? r.companySlug, notice: c?.notices.find((n) => n.id === r.warnNoticeId) ?? null }
  })
}

export async function reviewStatement(id: string, decision: 'APPROVED' | 'REJECTED', note: string | null): Promise<void> {
  const row = await prisma.employerStatement.update({ where: { id }, data: { status: decision, reviewedAt: new Date(), reviewNote: note?.slice(0, 500) || null }, select: { companySlug: true, warnNoticeId: true } })
  captureServerEvent(`employer-statement:${row.companySlug}`, decision === 'APPROVED' ? 'employer_statement_approved' : 'employer_statement_rejected', { companySlug: row.companySlug, noticeId: row.warnNoticeId, statementId: id })
}
