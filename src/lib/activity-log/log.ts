import 'server-only'
import { prisma } from '@/lib/prisma'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { candidatePlusProgressLine, type LogKind } from '@/lib/activity-log/progress'
import { isDuplicateOutreach, outreachNoteKey, OUTREACH_DEDUPE_WINDOW_MS, type OutreachSource } from '@/lib/activity-log/outreach-note'
import { bucketLow, entriesToLog, selfReportKeys, type CheckInPayload } from '@/lib/activity-log/weekly-checkin'

// Writes for the one-tap logging prompts. Every write lands in the two tables the
// Candidate+ gate counts (dossier-unlock.ts isDossierUnlocked): OutreachLog rows and
// JobPosting rows with appliedAt set. Nothing here calls an LLM or a paid API.

/** The member's Candidate+ line for one kind, read fresh from the gate itself. */
export async function candidatePlusProgress(candidateId: string, kind: LogKind): Promise<{ line: string; count: number; unlocked: boolean }> {
  const status = await isDossierUnlocked(candidateId)
  const count = kind === 'applications' ? status.applicationCount : status.outreachCount
  return { line: candidatePlusProgressLine(kind, count, status.unlocked), count, unlocked: status.unlocked }
}

export interface OutreachSentInput {
  source: OutreachSource
  note: string
  jobId?: string | null
  contactId?: string | null
  templateType?: string | null
}

export type OutreachSentResult = { logged: boolean; duplicate: boolean; companyName: string | null; contactKind: string | null }

/** "✓ I sent it" after copying a note. One note counts once per 24 hours. */
export async function logOutreachSent(candidateId: string, input: OutreachSentInput, now: Date = new Date()): Promise<OutreachSentResult> {
  let companyName: string | null = null
  let contactKind: string | null = null
  let contactId: string | null = null
  let jobId: string | null = null
  let channel: 'EMAIL' | 'OTHER' = 'OTHER'
  let subjectKey: string

  if (input.source === 'who_to_contact' && input.jobId) {
    const posting = await prisma.exclusiveJobPosting.findUnique({ where: { id: input.jobId }, select: { id: true, companyName: true, recruiterName: true } })
    jobId = posting?.id ?? null
    companyName = posting?.companyName ?? null
    contactKind = posting?.recruiterName?.trim() ? 'posting_contact' : 'recruiter_or_manager'
    subjectKey = `job:${input.jobId}`
  } else if (input.source === 'outreach_coach' && input.contactId) {
    const contact = await prisma.supportNetworkContact.findFirst({
      where: { id: input.contactId, candidateId },
      select: { id: true, company: true, inferredCompany: true, email: true },
    })
    contactId = contact?.id ?? null
    companyName = contact?.company ?? contact?.inferredCompany ?? null
    contactKind = 'contact'
    if (contact?.email) channel = 'EMAIL'
    subjectKey = `contact:${input.contactId}`
  } else {
    contactKind = input.templateType?.slice(0, 60) || 'template'
    subjectKey = `template:${contactKind}`
  }

  const noteKey = outreachNoteKey(subjectKey, input.note)
  const last = await prisma.outreachLog.findFirst({
    where: { candidateId, noteKey, loggedAt: { gte: new Date(now.getTime() - OUTREACH_DEDUPE_WINDOW_MS) } },
    orderBy: { loggedAt: 'desc' },
    select: { loggedAt: true },
  })
  if (isDuplicateOutreach(last?.loggedAt ?? null, now)) return { logged: false, duplicate: true, companyName, contactKind }

  await prisma.outreachLog.create({
    data: { candidateId, contactId, channel, loggedAt: now, logSource: input.source, companyName, contactKind, jobId, noteKey },
  })
  return { logged: true, duplicate: false, companyName, contactKind }
}

export interface CheckInResult {
  reported: number
  alreadyLogged: number
  added: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * A weekly check-in tap: logs the low end of the range as self-reported entries, less what
 * is already on file for the 7 days before the email (plus anything since), keyed per week
 * so a second tap — or a tap on a lower range — never adds more.
 */
export async function logWeeklyCheckIn(p: CheckInPayload, now: Date = new Date()): Promise<CheckInResult> {
  const reported = bucketLow(p.bucket)
  const from = new Date(p.issuedAt - 7 * DAY_MS)
  const alreadyLogged =
    p.kind === 'applications'
      ? await prisma.jobPosting.count({ where: { candidateId: p.candidateId, selfReportKey: null, appliedAt: { gte: from, lte: now } } })
      : await prisma.outreachLog.count({ where: { candidateId: p.candidateId, selfReportKey: null, loggedAt: { gte: from, lte: now } } })
  const keys = selfReportKeys(p.weekKey, p.kind, entriesToLog(reported, alreadyLogged))
  if (keys.length === 0) return { reported, alreadyLogged, added: 0 }

  const result =
    p.kind === 'applications'
      ? await prisma.jobPosting.createMany({
          data: keys.map((selfReportKey) => ({
            candidateId: p.candidateId,
            source: 'MANUAL' as const,
            fetchStatus: 'no_url',
            title: 'Application (weekly check-in)',
            appliedAt: now,
            channel: 'OTHER' as const,
            selfReportKey,
          })),
          skipDuplicates: true,
        })
      : await prisma.outreachLog.createMany({
          data: keys.map((selfReportKey) => ({
            candidateId: p.candidateId,
            channel: 'OTHER' as const,
            loggedAt: now,
            logSource: 'weekly_checkin',
            selfReportKey,
          })),
          skipDuplicates: true,
        })
  return { reported, alreadyLogged, added: result.count }
}
