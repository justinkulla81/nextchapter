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
  // A fixed day or range of days of the month (e.g. "28-31"): one real run a month.
  if (dom && /^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(dom)) return 31 * 1440
  if (dow && dow !== '*') return 7 * 1440
  const minStep = min?.match(/^\*\/(\d+)$/)
  if (minStep && hour === '*') return Number(minStep[1])
  if (hour === '*') return 60
  const hourStep = hour?.match(/^\*\/(\d+)$/)
  if (hourStep) return Number(hourStep[1]) * 60
  return 1440
}

/**
 * A job is overdue after missing two expected runs, plus an hour of slack for
 * platform scheduling jitter (Vercel may fire a cron minutes late).
 */
export function maxGapMinutes(expr: string): number {
  return intervalMinutes(expr) * 2 + 60
}

/**
 * Crons that run several small jobs in one slot (src/lib/cron/bundle.ts). Each listed job keeps its own route and
 * ledger row, so the watchdog and Job health judge it by name on the bundle's schedule.
 */
export const CRON_BUNDLES: Readonly<Record<string, readonly string[]>> = {
  'bundle-membership': ['demo-expiry', 'membership-lapse-check', 'membership-dossier-refresh', 'membership-market-check', 'membership-network-nudge', 'activity-streaks', 'benefits-network-expire-listings'],
  'bundle-daily-1300': ['week1-kickoff', 'candidate-email-dispatch', 'talent-intake', 'social-posts'],
  'bundle-daily-1030': ['meeting-prep-send', 'mailing-autoassign', 'content-drafts', 'ats-job-board-feed'],
  'bundle-daily-1200': ['help-feedback-digest', 'research-inbox-sweep', 'job-search-daily', 'saved-job-closures'],
  'bundle-search-pings': ['bing-url-submit', 'indexnow-seo-pages', 'google-indexing-jobs', 'indexnow-org-pages', 'indexnow-jobs'],
  'bundle-company-light': ['company-events', 'company-outcomes'],
  'bundle-tuesday-digests': ['market-digest-recruiters', 'market-digest-employers', 'weekly-read', 'market-digest-coaches', 'upgrade-offer', 'network-digest'],
  'bundle-wednesday': ['nudge-recruiter-network-unlock', 'win-back'],
  'bundle-monday': ['senior-brief', 'outplacement-agent', 'course-scan', 'higher-ed-weekly', 'market-reality-snapshot', 'auto-assign-sprint', 'conference-recheck', 'population-snapshot'],
  'bundle-sunday': ['partner-scores', 'workforce-boards', 'job-segments'],
  'bundle-afternoon': ['lead-nurture', 'layoff-alerts', 'job-alerts', 'deadline-reminders', 'census-comms', 'notify-recruiters-new-candidates', 'backchannel-match', 'registration-reminders', 'interim-role-reverify'],
  'bundle-hourly-light': ['indexnow-layoffs', 'social-filings', 'mailing-verify', 'topic-snapshots'],
  'bundle-every-5': ['lead-lifecycle', 'mailing-send'],
  'bundle-data-light': ['ceo-speaking', 'higher-ed-nightly', 'catalog-seeds', 'landed-to-managing', 'events-refresh', 'funding-opportunities', 'expire-job-postings', 'likely-openings'],
  'bundle-market-data': ['pivot-market', 'market-size', 'company-hiring-index', 'pay-data'],
  'bundle-contracts': ['competitor-awards', 'board-bids', 'federal-contracts'],
  'bundle-late-morning': ['mailing-drafts', 'staff-agents', 'news-discovery', 'seo-title-tests'],
}

/**
 * Flag-gated jobs with a route but no cron while their flag is off, to save a slot (the limit is 100). Add the cron back
 * to vercel.json when switching one on: mobile-push (MOBILE_PUSH_ENABLED), supporter-digest (SUPPORTER_DIGEST_ENABLED),
 * conference-heads-up (CONFERENCE_HEADSUP_ENABLED).
 */

export function cronSchedules(): CronSchedule[] {
  return (vercelConfig.crons ?? []).flatMap((c) => {
    const job = jobNameFromPath(c.path)
    const jobs = CRON_BUNDLES[job]
    if (!jobs) return [{ job, path: c.path, schedule: c.schedule, maxGapMinutes: maxGapMinutes(c.schedule) }]
    return jobs.map((j) => ({ job: j, path: `/api/cron/${j}`, schedule: c.schedule, maxGapMinutes: maxGapMinutes(c.schedule) }))
  })
}

/**
 * Jobs that only pull in or tidy data, so running one again — after a failure,
 * or from the admin page — cannot double-send anything. Jobs that email
 * candidates, coaches or recruiters are deliberately absent.
 */
export const RERUN_SAFE_JOBS: ReadonlySet<string> = new Set([
  'crm-sync', 'gmail-sync', 'warn-sync', 'layoff-news', 'ats-job-board-feed', 'company-signals', 'company-events', 'company-outcomes', 'company-graph', 'company-hiring-index',
  'funding-opportunities', 'content-drafts', 'catalog-seeds', 'federal-contracts', 'board-bids', 'competitor-awards', 'news-discovery', 'likely-openings',
  'workforce-boards', 'workforce-board-intel', 'refresh-youtube-content',
  'expire-job-postings', 'benefits-network-expire-listings', 'population-snapshot',
  'partner-scores', 'activity-streaks', 'board-light-rows', 'job-feed-direct', 'job-feed-jooble', 'indexnow-jobs', 'indexnow-seo-pages', 'indexnow-layoffs', 'google-indexing-jobs', 'bing-url-submit', 'pivot-market', 'market-size', 'pay-data', 'ai-market', 'skills-market', 'board-figures', 'rankings', 'job-segments', 'page-warmup',
  // Asks the AI assistants a fixed list of questions. It costs money, but the run stops at the monthly cap (src/lib/ai-visibility/run.ts), so a second click cannot overspend.
  'ai-citation-check',
])

/** The rankings job builds three packs of lists by default; the admin "Run now" can rebuild one group on its own (src/app/api/cron/rankings). */
export const RANKINGS_GROUPS = ['places', 'functions', 'skills', 'workforce', 'college', 'industry', 'profile', 'support'] as const
