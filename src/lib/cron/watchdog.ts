import 'server-only'
import { prisma } from '@/lib/prisma'
import { createResend } from '@/lib/email/resend-client'
import { captureServerEvent } from '@/lib/posthog/server'
import { cronSchedules } from './schedule'
import { assessJob, STUCK_AFTER_MS, UNHEALTHY, type JobHealth } from './health'

const ALERT_TO = 'justin@launchyournextchapter.com'
const SITE = 'https://launchyournextchapter.com'
/** A job that stays broken is mentioned again after this long, not every run. */
const REALERT_MS = 24 * 3_600_000
/** Run rows are only history; keep a month. */
const KEEP_DAYS = 30

export interface JobStatus {
  job: string
  schedule: string
  health: JobHealth
  detail: string
  lastStartedAt: Date | null
  lastDurationMs: number | null
}

export async function loadJobStatuses(now = new Date()): Promise<JobStatus[]> {
  const schedules = cronSchedules()
  const [first, latestRuns] = await Promise.all([
    prisma.cronRun.findFirst({ orderBy: { startedAt: 'asc' }, select: { startedAt: true } }),
    Promise.all(
      schedules.map((s) =>
        prisma.cronRun.findFirst({
          where: { job: s.job },
          orderBy: { startedAt: 'desc' },
          select: { status: true, startedAt: true, error: true, durationMs: true },
        }),
      ),
    ),
  ])
  return schedules.map((s, i) => {
    const latest = latestRuns[i]
    const { health, detail } = assessJob(s, latest, first?.startedAt ?? null, now)
    return { job: s.job, schedule: s.schedule, health, detail, lastStartedAt: latest?.startedAt ?? null, lastDurationMs: latest?.durationMs ?? null }
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

  const statuses = await loadJobStatuses(now)
  const bad = statuses.filter((s) => UNHEALTHY.has(s.health))
  const badJobs = new Set(bad.map((s) => s.job))

  await prisma.cronJobAlert.deleteMany({ where: { job: { notIn: [...badJobs] } } })
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
        subject: `${toAlert.length} background job${toAlert.length === 1 ? '' : 's'} need attention`,
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

  const result = { marked_timed_out: cutoff.count, unhealthy: bad.length, alerted: emailed ? toAlert.length : 0 }
  if (cutoff.count || toAlert.length) {
    captureServerEvent('cron', 'job_health_checked', { ...result, jobs: bad.map((s) => ({ job: s.job, health: s.health })) })
  }
  return result
}
