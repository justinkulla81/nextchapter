import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createResend } from '@/lib/email/resend-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { candidateUnsubscribeUrl } from '@/lib/email/signed-links'
import { neutralizeEmailSubject } from '@/lib/email/neutral-subject'
import { captureServerEvent } from '@/lib/posthog/server'
import { liveBoardWhere } from '@/lib/jobs/board-shortlist'
import { emailSafeJobs } from '@/lib/jobs/mid-level'
import { classifyWorkType } from '@/lib/jobs/work-type'
import SavedJobClosedEmail from '@/emails/saved-job-closed'
import {
  CLOSURE_REASONS, closureDigestEmail, groupByJob, groupByMember,
  type Closure, type MemberLine,
} from '@/lib/jobs/saved-job-closure-format'

// A job a member saved (TrackedJob, source job_board) that was taken down: closed by the employer, aged out, expired, found
// dead by our check, or taken down by us. Once a day this tells the owner which jobs and who saved them, and emails each
// member (when SAVED_JOB_CLOSURE_EMAILS=true) with similar jobs that are open now. Each (member, job) is noted once in
// SavedJobClosureNotice, so a rerun never repeats an email.

const LOOKBACK_DAYS = 3
const MAX_ROWS = 2000
const MAX_SIMILAR_PER_EMAIL = 4
const DEADLINE_MS = 240_000

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
const ADMIN_URL = 'https://admin.launchyournextchapter.com'
const OWNER_TO = process.env.FOLLOW_ALERT_TO || process.env.HELP_FORWARD_TO || process.env.CONTACT_FORWARD_TO || 'justin@launchyournextchapter.com'
const FROM = 'NextChapter <support@launchyournextchapter.com>'

export const savedJobClosureEmailsEnabled = (): boolean => process.env.SAVED_JOB_CLOSURE_EMAILS === 'true'

type Row = Omit<Closure, 'archivedAt'> & { archivedAt: Date }

/** Saved jobs taken down in the last few days with no notice yet. */
export async function findNewClosures(): Promise<Closure[]> {
  return prisma.$queryRaw<Row[]>`
    SELECT t."candidateId" AS "candidateId", p.id AS "jobId", p.title, p."companyName", p."closeReason", p."archivedAt",
           p."disclosure", p."level", p."targetFunction", p."locationState", p."workArrangement"
    FROM "TrackedJob" t
    JOIN "ExclusiveJobPosting" p ON p.id = t."sourceId"
    WHERE t."source" = 'job_board' AND t."savedAt" IS NOT NULL AND t."dismissedAt" IS NULL
      AND p."archivedAt" IS NOT NULL AND p."archivedAt" > now() - make_interval(days => ${LOOKBACK_DAYS}::int)
      AND p."closeReason" IN (${Prisma.join([...CLOSURE_REASONS])})
      AND NOT EXISTS (SELECT 1 FROM "SavedJobClosureNotice" n WHERE n."candidateId" = t."candidateId" AND n."jobId" = p.id)
    ORDER BY p."archivedAt" DESC
    LIMIT ${MAX_ROWS}`
}

interface Similar { id: string; title: string; company: string; meta: string }

/** Open jobs like a closed one: same function and level, in its state or remote. Only what an email may show (full-time, not mid-level or early-career unless the owner allowed it, not confidential). */
async function similarLive(j: Closure, exclude: Set<string>): Promise<Similar[]> {
  if (!j.targetFunction && !j.level) return []
  const rows = await prisma.exclusiveJobPosting.findMany({
    where: liveBoardWhere({
      id: { notIn: [...exclude] },
      disclosure: { not: 'CONFIDENTIAL' },
      ...(j.targetFunction ? { targetFunction: j.targetFunction } : {}),
      ...(j.level ? { level: j.level } : {}),
      ...(j.locationState ? { OR: [{ locationState: j.locationState }, { workArrangement: 'remote' }] } : {}),
    }),
    select: { id: true, title: true, companyName: true, location: true, workArrangement: true, level: true, employmentType: true, description: true },
    orderBy: { postedAt: 'desc' },
    take: 12,
  })
  return emailSafeJobs(rows)
    .filter((r) => classifyWorkType({ title: r.title, description: r.description, employmentType: r.employmentType }) === 'full_time')
    .slice(0, 3)
    .map((r) => ({ id: r.id, title: r.title, company: r.companyName, meta: [r.location, r.workArrangement === 'remote' ? 'Remote' : null].filter(Boolean).join(' · ') }))
}

async function sendMemberEmail(
  p: { id: string; userId: string; firstName: string | null; confidentialSearchMode: boolean },
  closures: Closure[],
  cache: Map<string, Similar[]>,
): Promise<{ sent: boolean; similar: number }> {
  if (!process.env.RESEND_API_KEY) return { sent: false, similar: 0 }
  const { data } = await createAdminClient().auth.admin.getUserById(p.userId)
  const to = data.user?.email
  if (!to) return { sent: false, similar: 0 }

  const exclude = new Set(closures.map((c) => c.jobId))
  const similar: Similar[] = []
  for (const c of closures.slice(0, 3)) {
    const key = [c.targetFunction, c.level, c.locationState].join('|')
    if (!cache.has(key)) cache.set(key, await similarLive(c, exclude))
    for (const s of cache.get(key)!) if (!similar.some((x) => x.id === s.id) && similar.length < MAX_SIMILAR_PER_EMAIL) similar.push(s)
  }

  const one = closures.length === 1
  const subject = neutralizeEmailSubject(one ? `A job you saved is no longer listed: ${closures[0].title}` : `${closures.length} jobs you saved are no longer listed`, p.confidentialSearchMode)
  const { error } = await createResend(process.env.RESEND_API_KEY).emails.send({
    from: FROM,
    replyTo: 'support@launchyournextchapter.com',
    to,
    subject,
    react: SavedJobClosedEmail({
      firstName: p.firstName,
      closed: closures.map((c) => ({ title: c.title, company: c.disclosure === 'CONFIDENTIAL' ? 'Confidential search' : c.companyName })),
      similar: similar.map((s) => ({ title: s.title, company: s.company, meta: s.meta, href: `${APP_URL}/dashboard/jobs/${s.id}` })),
      boardUrl: `${APP_URL}/dashboard/find-my-job?src=saved_job_closed`,
      unsubscribeUrl: candidateUnsubscribeUrl(APP_URL, p.id, 'freshJobAlerts'),
    }),
  })
  if (error) {
    console.error('Saved-job closure email failed for', p.id, error)
    return { sent: false, similar: similar.length }
  }
  captureServerEvent(p.id, 'saved_job_closed_email_sent', { jobIds: closures.map((c) => c.jobId), similarCount: similar.length })
  return { sent: true, similar: similar.length }
}

export async function runSavedJobClosures(): Promise<Record<string, number | boolean>> {
  const startedAt = Date.now()
  const rows = await findNewClosures()
  if (rows.length === 0) return { closures: 0, jobs: 0, members: 0, emailsSent: 0, wouldSend: 0, memberEmailsOn: savedJobClosureEmailsEnabled() }

  // Note every (member, job) first, so a retry or a second run can never repeat an email.
  await prisma.savedJobClosureNotice.createMany({
    data: rows.map((r) => ({ candidateId: r.candidateId, jobId: r.jobId, closeReason: r.closeReason, closedAt: r.archivedAt })),
    skipDuplicates: true,
  })

  const profiles = await prisma.candidateProfile.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.candidateId))] }, isSampleData: false },
    select: {
      id: true, userId: true, firstName: true, lastName: true, email: true, confidentialSearchMode: true,
      registrationCompletedAt: true, deactivatedAt: true, freshJobAlertsOptedOut: true, notificationTier: true,
    },
  })
  const byId = new Map(profiles.map((p) => [p.id, p]))
  const real = rows.filter((r) => byId.has(r.candidateId))
  const line = (id: string): MemberLine => {
    const p = byId.get(id)
    return { id, name: [p?.firstName, p?.lastName].filter(Boolean).join(' ') || null, email: p?.email ?? null }
  }

  const enabled = savedJobClosureEmailsEnabled()
  const cache = new Map<string, Similar[]>()
  let sent = 0
  let wouldSend = 0
  for (const [id, closures] of groupByMember(real)) {
    const p = byId.get(id)!
    const eligible = !!p.registrationCompletedAt && !p.deactivatedAt && !p.freshJobAlertsOptedOut && p.notificationTier !== 'MINIMAL'
    if (!eligible) continue
    if (!enabled) { wouldSend++; continue }
    if (Date.now() - startedAt > DEADLINE_MS) break
    try {
      const r = await sendMemberEmail(p, closures, cache)
      if (r.sent) {
        sent++
        await prisma.savedJobClosureNotice.updateMany({ where: { candidateId: id, jobId: { in: closures.map((c) => c.jobId) } }, data: { memberEmailedAt: new Date() } })
      }
    } catch (error) {
      console.error('Saved-job closure email failed for', id, error)
    }
  }

  // The owner's digest: every closed job and who saved it.
  const jobs = groupByJob(real, line)
  if (jobs.length > 0 && process.env.RESEND_API_KEY) {
    const mail = closureDigestEmail({
      jobs,
      memberCount: new Set(real.map((r) => r.candidateId)).size,
      memberEmails: enabled ? { mode: 'sent', sent } : { mode: 'off', wouldSend },
      adminUrl: `${ADMIN_URL}/support/admin/candidates`,
    })
    try {
      const { error } = await createResend(process.env.RESEND_API_KEY, 'general').emails.send({ from: FROM, to: OWNER_TO, ...mail })
      if (error) console.error('Saved-job closure digest failed:', error)
    } catch (error) {
      console.error('Saved-job closure digest failed:', error)
    }
  }
  return { closures: real.length, jobs: jobs.length, members: byId.size, emailsSent: sent, wouldSend, memberEmailsOn: enabled }
}
