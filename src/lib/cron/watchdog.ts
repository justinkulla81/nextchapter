import 'server-only'
import { prisma } from '@/lib/prisma'
import { createResend } from '@/lib/email/resend-client'
import { captureServerEvent } from '@/lib/posthog/server'
import { cronSchedules, RERUN_SAFE_JOBS } from './schedule'
import { invokeCron } from './invoke'
import { assessJob, STUCK_AFTER_MS, UNHEALTHY, type JobHealth } from './health'

const ALERT_TO = 'justin@launchyournextchapter.com'
const SITE = 'https://launchyournextchapter.com'
/** A job that stays broken is mentioned again after this long, not every run. */
const REALERT_MS = 24 * 3_600_000
/** Run rows are only history; keep a month. */
const KEEP_DAYS = 30
const RETRY_WINDOW_MS = 6 * 3_600_000
const MAX_RETRIES_PER_TICK = 1
/** The watchdog's own function limit is 300s; leave room to finish after retries. */
const RETRY_BUDGET_MS = 200_000
/**
 * CronJobAlert.reason for a job that has never run: the row's alertedAt is when
 * the watchdog first saw it. A job added in this deploy gets its full allowed
 * gap from that moment before it counts as overdue, instead of being judged
 * against the whole ledger's age (which flagged every new cron within 15 min).
 */
const FIRST_SEEN = 'first_seen'

/** "1 background job needs attention" / "2 background jobs need attention". */
export function alertSubject(count: number): string {
  return `${count} background job${count === 1 ? ' needs' : 's need'} attention`
}

export interface JobStatus {
  job: string
  schedule: string
  health: JobHealth
  detail: string
  lastStartedAt: Date | null
  lastDurationMs: number | null
  lastTrigger: string | null
}

export async function loadJobStatuses(now = new Date(), opts: { recordFirstSeen?: boolean } = {}): Promise<JobStatus[]> {
  const schedules = cronSchedules()
  const [latestRuns] = await Promise.all([
    Promise.all(
      schedules.map((s) =>
        prisma.cronRun.findFirst({
          where: { job: s.job },
          orderBy: { startedAt: 'desc' },
          select: { status: true, startedAt: true, error: true, durationMs: true, trigger: true },
        }),
      ),
    ),
  ])
  // Jobs with no run yet are timed from when the watchdog first saw them.
  const neverRan = schedules.filter((_, i) => !latestRuns[i]).map((s) => s.job)
  const seen = neverRan.length
    ? await prisma.cronJobAlert.findMany({ where: { job: { in: neverRan }, reason: FIRST_SEEN } })
    : []
  const firstSeen = new Map(seen.map((r) => [r.job, r.alertedAt]))
  if (opts.recordFirstSeen) {
    const fresh = neverRan.filter((j) => !firstSeen.has(j))
    if (fresh.length) {
      await prisma.cronJobAlert.createMany({
        data: fresh.map((job) => ({ job, reason: FIRST_SEEN, alertedAt: now })),
        skipDuplicates: true,
      })
      for (const j of fresh) firstSeen.set(j, now)
    }
  }
  return schedules.map((s, i) => {
    const latest = latestRuns[i]
    const { health, detail } = assessJob(s, latest, latest ? null : firstSeen.get(s.job) ?? now, now)
    return { job: s.job, schedule: s.schedule, health, detail, lastStartedAt: latest?.startedAt ?? null, lastDurationMs: latest?.durationMs ?? null, lastTrigger: latest?.trigger ?? null }
  })
}

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Marks cut-off runs TIMED_OUT, emails about jobs that are failing, cut off, or
 * overdue (once per job per day), forgets alerts for jobs that recovered, and
 * prunes old history. Never throws on an email problem.
 */
export async function runJobWatchdog(now = new Date()) {
  const cutoff = await prisma.cronRun.updateMany({
    where: { status: 'RUNNING', startedAt: { lt: new Date(now.getTime() - STUCK_AFTER_MS) } },
    data: { status: 'TIMED_OUT', finishedAt: now, error: 'Cut off at the function time limit before finishing.' },
  })

  let statuses = await loadJobStatuses(now, { recordFirstSeen: true })
  let bad = statuses.filter((s) => UNHEALTHY.has(s.health))

  // One automatic retry per failure, for jobs that are safe to repeat, and only
  // while the failure is recent. A retry that fails too is the latest run with
  // trigger "retry", so it is not retried again — it goes to the email instead.
  const retried: string[] = []
  const deadline = now.getTime() + RETRY_BUDGET_MS
  for (const s of bad) {
    if (retried.length >= MAX_RETRIES_PER_TICK || Date.now() > deadline) break
    if (!(s.health === 'failed' || s.health === 'timed_out') || !RERUN_SAFE_JOBS.has(s.job)) continue
    if (s.lastTrigger === 'retry' || !s.lastStartedAt || now.getTime() - s.lastStartedAt.getTime() > RETRY_WINDOW_MS) continue
    retried.push(s.job)
    await invokeCron(s.job, 'retry', RETRY_BUDGET_MS)
  }
  if (retried.length) statuses = await loadJobStatuses(new Date())
  bad = statuses.filter((s) => UNHEALTHY.has(s.health))
  const badJobs = new Set(bad.map((s) => s.job))

  // Forget alerts for recovered jobs, and first-seen markers once a job has run.
  // A first-seen marker for a job still waiting on its first run is kept.
  const ranJobs = statuses.filter((s) => s.lastStartedAt).map((s) => s.job)
  await prisma.cronJobAlert.deleteMany({
    where: { OR: [{ job: { notIn: [...badJobs] }, reason: { not: FIRST_SEEN } }, { job: { in: ranJobs }, reason: FIRST_SEEN }] },
  })
  const prior = await prisma.cronJobAlert.findMany({ where: { job: { in: [...badJobs] } } })
  const priorByJob = new Map(prior.map((p) => [p.job, p]))
  const toAlert = bad.filter((s) => {
    const p = priorByJob.get(s.job)
    return !p || p.reason !== s.health || now.getTime() - p.alertedAt.getTime() > REALERT_MS
  })

  let emailed = false
  if (toAlert.length && process.env.RESEND_API_KEY) {
    try {
      const rows = toAlert
        .map((s) => `<li><strong>${esc(s.job)}</strong> — ${esc(s.health.replace('_', ' '))}. ${esc(s.detail)}</li>`)
        .join('')
      const { error } = await createResend(process.env.RESEND_API_KEY).emails.send({
        from: 'NextChapter <support@launchyournextchapter.com>',
        to: ALERT_TO,
        subject: alertSubject(toAlert.length),
        html: `<p>These scheduled jobs are not completing:</p><ul>${rows}</ul><p><a href="${SITE}/support/admin/job-health">Open job health</a></p>`,
      })
      if (error) console.error('Job watchdog email not sent', error)
      else emailed = true
    } catch (e) {
      console.error('Job watchdog email failed', e)
    }
  }
  if (emailed) {
    for (const s of toAlert) {
      await prisma.cronJobAlert.upsert({
        where: { job: s.job },
        create: { job: s.job, reason: s.health, alertedAt: now },
        update: { reason: s.health, alertedAt: now },
      })
    }
  }

  await prisma.cronRun.deleteMany({ where: { startedAt: { lt: new Date(now.getTime() - KEEP_DAYS * 86_400_000) } } })

  const result = { marked_timed_out: cutoff.count, retried, unhealthy: bad.length, alerted: emailed ? toAlert.length : 0 }
  if (cutoff.count || toAlert.length || retried.length) {
    captureServerEvent('cron', 'job_health_checked', { ...result, jobs: bad.map((s) => ({ job: s.job, health: s.health })) })
  }
  return result
}
