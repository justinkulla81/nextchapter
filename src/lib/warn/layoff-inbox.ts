import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { createResend } from '@/lib/email/resend-client'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { captureServerEvent } from '@/lib/posthog/server'
import { matchOrCreateCompanyForEmployer } from './company-match'
import { sameEmployer } from './news-headline'
import {
  buildLayoffExtractRequest, layoffReplyText, parseLayoffExtraction,
  type EmailedLayoff,
} from './layoff-inbox-rules'

/** A notice already on file this close covers the layoff (same window as the SEC and news checks). */
const COVERED_DAYS = 45
const DAY_MS = 86_400_000

type Outcome = 'filed' | 'already-filed' | 'covered' | 'no-company' | 'no-link' | 'error'

async function file(l: EmailedLayoff): Promise<{ outcome: 'filed' | 'already-filed' | 'covered'; noticeId?: string }> {
  const key = normalizeOrgName(l.company)
  const when = new Date(`${l.noticeDate}T00:00:00Z`)

  if (await prisma.warnNotice.findFirst({ where: { sourceUrl: l.sourceUrl }, select: { id: true } })) return { outcome: 'already-filed' }

  const recent = await prisma.warnNotice.findMany({
    where: { dismissedAt: null, noticeDate: { gte: new Date(when.getTime() - COVERED_DAYS * DAY_MS) } },
    select: { normalizedEmployer: true, noticeDate: true },
  })
  if (recent.some((n) => sameEmployer(n.normalizedEmployer, key) && n.noticeDate && Math.abs(n.noticeDate.getTime() - when.getTime()) <= COVERED_DAYS * DAY_MS)) {
    return { outcome: 'covered' }
  }

  const match = await matchOrCreateCompanyForEmployer(l.company).catch(() => null)
  const notice = await prisma.warnNotice.create({
    data: {
      ...(match ? {
        companyId: match.companyId,
        companyMatchStatus: match.status,
        ...(match.candidates ? { companyMatchCandidates: match.candidates } : {}),
      } : {}),
      employer: l.company,
      normalizedEmployer: key,
      source: 'MANUAL_ANNOUNCEMENT',
      state: l.state,
      noticeDate: when,
      employees: l.employees,
      sourceUrl: l.sourceUrl,
      layoffType: 'Reported by email (unconfirmed)',
    },
    select: { id: true },
  })
  return { outcome: 'filed', noticeId: notice.id }
}

async function reply(to: string, outcome: Outcome, l?: EmailedLayoff): Promise<void> {
  if (!process.env.RESEND_API_KEY) return
  const { subject, text } = layoffReplyText(outcome, l)
  await createResend(process.env.RESEND_API_KEY, 'admin').emails
    .send({ from: 'NextChapter Support <support@launchyournextchapter.com>', to, subject, text })
    .catch((e) => console.error('Layoffs inbox reply failed:', e))
}

/**
 * Files the layoff in an email sent to layoffs@. The caller has already checked the sender is an admin.
 * Returns the status to log against the inbound email.
 */
export async function fileEmailedLayoff(args: {
  providerEmailId: string
  senderEmail: string
  subject: string | null
  body: string
}): Promise<string> {
  const today = new Date().toISOString().slice(0, 10)
  let outcome: Outcome = 'error'
  let layoff: EmailedLayoff | undefined
  let noticeId: string | undefined
  try {
    const msg = await new Anthropic().messages.create(buildLayoffExtractRequest(args.subject, args.body, today))
    const read = parseLayoffExtraction(msg.content.find((b) => b.type === 'text')?.text ?? '', today)
    if (!read.ok) {
      outcome = read.reason
    } else {
      layoff = read.layoff
      const filed = await file(layoff)
      outcome = filed.outcome
      noticeId = filed.noticeId
    }
  } catch (error) {
    console.error('Layoffs inbox failed:', error)
  }

  captureServerEvent(args.senderEmail, 'layoff_emailed_in', {
    providerEmailId: args.providerEmailId,
    outcome,
    noticeId: noticeId ?? null,
    employer: layoff?.company ?? null,
    employees: layoff?.employees ?? null,
    sourceUrl: layoff?.sourceUrl ?? null,
  })
  await reply(args.senderEmail, outcome, layoff)
  return `layoffs_${outcome.replace('-', '_')}`
}
