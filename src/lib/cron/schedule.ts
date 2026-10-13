import vercelConfig from '../../../vercel.json'

export interface CronSchedule {
  job: string
  path: string
  schedule: string
  /** Longest gap between healthy runs, in minutes, before the job counts as overdue. */
  maxGapMinutes: number
}

/** Job name for a cron path: `/api/cron/gmail-sync` → `gmail-sync`. */
export function jobNameFromPath(path: string): string {
  return path.replace(/^\/api\/cron\//, '')
}

/**
 * Expected interval of a vercel.json cron expression, in minutes. Only the
 * shapes this project uses are understood; anything else is treated as daily
 * so an unfamiliar schedule errs toward alerting late rather than never.
 */
export function intervalMinutes(expr: string): number {
  const [min, hour, dom, , dow] = expr.trim().split(/\s+/)
  const dayStep = dom?.match(/^\*\/(\d+)$/)
  if (dayStep) return Number(dayStep[1]) * 1440
  if (dow && dow !== '*') return 7 * 1440
  const minStep = min?.match(/^\*\/(\d+)$/)
  if (minStep && hour === '*') return Number(minStep[1])
  if (hour === '*') return 60
  return 1440
}

/**
 * A job is overdue after missing two expected runs, plus an hour of slack for
 * platform scheduling jitter (Vercel may fire a cron minutes late).
 */
export function maxGapMinutes(expr: string): number {
  return intervalMinutes(expr) * 2 + 60
}

export function cronSchedules(): CronSchedule[] {
  return (vercelConfig.crons ?? []).map((c) => ({
    job: jobNameFromPath(c.path),
    path: c.path,
    schedule: c.schedule,
    maxGapMinutes: maxGapMinutes(c.schedule),
  }))
}
