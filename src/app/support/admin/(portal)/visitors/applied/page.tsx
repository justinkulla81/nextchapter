import Link from 'next/link'
import { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AdminDataTable, type AdminColumn } from '@/components/admin/AdminDataTable'
import { BreakdownBars } from '@/components/admin/BreakdownBars'
import { BOT_SIGNATURES } from '@/lib/http/user-agent'
import { formatAdminDateTime } from '@/lib/admin/format-date'
import {
  AI_EXPOSURE_ORDER,
  EXPERIENCE_ORDER,
  PAY_ORDER,
  aiExposureBucket,
  aiMentionBucket,
  experienceBucket,
  industryLabel,
  levelLabel,
  medianPay,
  payBand,
  tally,
  type AppliedJob,
} from '@/lib/admin/applied-jobs-breakdown'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000
const RANGES = [
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: 'all', label: 'All time', days: null },
] as const

const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com').replace(/\/$/, '')
const OWN_HOST = new URL(SITE_URL).hostname.replace(/^www\./, '')

// Module-level, not inline in the component: react-hooks/purity flags Date.now().
function now(): Date {
  return new Date()
}

function money(value: number): string {
  return `$${Math.round(value / 1000)}k`
}

function payText(job: AppliedJob): string {
  if (job.salaryMin != null && job.salaryMax != null && job.salaryMin !== job.salaryMax) return `${money(job.salaryMin)}–${money(job.salaryMax)}`
  const one = job.salaryMax ?? job.salaryMin
  return one != null ? money(one) : '—'
}

interface JobRow {
  url: string
  title: string
  companyName: string
  clicks: number
  people: number
  lastAt: Date
  fn: string | null
  level: string | null
  state: string | null
  industry: string | null
  salaryMin: number | null
  salaryMax: number | null
  yearsMin: number | null
  noExperience: boolean
  aiExposed: boolean | null
  aiMention: boolean | null
  aiExposureLevel: string | null
}

// Which jobs visitors click Apply on, and what those jobs are like. An Apply click is a click on an outside,
// non-social link from a job page (or an old click with no page recorded) — the same rule as the Visitor activity
// page. It is matched to the listing by the employer link the listing carries.
export default async function AdminAppliedJobsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin()
  const raw = await searchParams
  const range = RANGES.find((r) => r.key === raw.range) ?? RANGES[1]
  const since = range.days ? new Date(now().getTime() - range.days * DAY_MS) : null

  const botPatterns = BOT_SIGNATURES.map((sig) => `%${sig}%`)
  const botFilter = Prisma.sql`(v."userAgent" IS NULL OR NOT (v."userAgent" ILIKE ANY(${botPatterns})))`
  const sinceFilter = since ? Prisma.sql`v."createdAt" >= ${since}` : Prisma.sql`TRUE`
  const applyFilter = Prisma.sql`v."eventType" = 'LINK_CLICK' AND v."href" ~* '^https?://' AND (v."path" IS NULL OR v."path" LIKE '/jobs/%')`

  const [rows, totalRows] = await Promise.all([
    prisma.$queryRaw<
      (Omit<JobRow, 'clicks' | 'people'> & { clicks: bigint; people: bigint })[]
    >(Prisma.sql`
      SELECT e."url", e."title", e."companyName",
             count(*) AS clicks, count(DISTINCT v."ip") AS people, max(v."createdAt") AS "lastAt",
             e."targetFunction" AS fn, e."level", e."locationState" AS state, e."industry",
             e."salaryMin", e."salaryMax",
             nullif(e."yearsRequired"->>'min', '')::int AS "yearsMin",
             (e."noExperiencePhrase" IS NOT NULL) AS "noExperience",
             e."aiExposed", e."aiMention", e."aiExposureLevel"
      FROM "HomepageVisitEvent" v
      JOIN "ExclusiveJobPosting" e ON e."url" = v."href"
      WHERE ${applyFilter} AND ${botFilter} AND ${sinceFilter}
      GROUP BY e."id"
      ORDER BY clicks DESC, "lastAt" DESC`),
    // Every outside, non-social click on a job page, matched or not, so the gap is visible.
    prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`
      SELECT count(*) AS n
      FROM "HomepageVisitEvent" v
      WHERE ${applyFilter} AND ${botFilter} AND ${sinceFilter}
        AND lower(regexp_replace(substring(v."href" from '^https?://([^/?#:]+)'), '^www\\.', '')) <> ${OWN_HOST}
        AND substring(v."href" from '^https?://([^/?#:]+)') !~* '(^|\\.)(linkedin|facebook|twitter|x|instagram|youtube|tiktok)\\.com$'`),
  ])

  const jobs: AppliedJob[] = rows.map((r) => ({
    url: r.url,
    title: r.title,
    companyName: r.companyName,
    clicks: Number(r.clicks),
    people: Number(r.people),
    lastAt: r.lastAt,
    function: r.fn,
    level: r.level,
    state: r.state,
    industry: r.industry,
    salaryMin: r.salaryMin,
    salaryMax: r.salaryMax,
    yearsMin: r.yearsMin,
    noExperience: r.noExperience,
    aiExposed: r.aiExposed,
    aiMention: r.aiMention,
    aiExposureLevel: r.aiExposureLevel,
  }))

  const matchedApplies = jobs.reduce((sum, j) => sum + j.clicks, 0)
  const allApplies = Number(totalRows[0]?.n ?? 0)
  const unmatched = Math.max(0, allApplies - matchedApplies)
  const median = medianPay(jobs)

  const columns: AdminColumn<AppliedJob>[] = [
    {
      header: 'Job',
      render: (j) => (
        <>
          <a href={j.url} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline underline-offset-4">
            {j.title}
          </a>
          <div className="text-xs text-muted-foreground">{j.companyName}</div>
        </>
      ),
    },
    { header: 'Applies', className: 'px-3 py-2 tabular-nums', render: (j) => (j.people === j.clicks ? j.clicks : `${j.clicks} (${j.people} people)`) },
    { header: 'Function', render: (j) => j.function ?? '—' },
    { header: 'Level', render: (j) => levelLabel(j.level) },
    { header: 'State', render: (j) => j.state ?? '—' },
    { header: 'Industry', render: (j) => industryLabel(j.industry) ?? '—' },
    { header: 'Pay', className: 'px-3 py-2 tabular-nums', render: payText },
    { header: 'Experience', render: experienceBucket },
    {
      header: 'AI',
      render: (j) => [j.aiMention ? 'Names AI' : null, j.aiExposureLevel ? `${j.aiExposureLevel} exposure` : null].filter(Boolean).join(' · ') || '—',
    },
    { header: 'Last apply', className: 'px-3 py-2 tabular-nums', render: (j) => formatAdminDateTime(j.lastAt) },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Jobs visitors applied to</h1>
        <p className="mt-1 text-muted-foreground">
          {matchedApplies} apply {matchedApplies === 1 ? 'click' : 'clicks'} on {jobs.length} {jobs.length === 1 ? 'listing' : 'listings'}
          {median != null && <>, median posted pay about {money(median)}</>}. Bots are left out.{' '}
          <Link href="/support/admin/visitors/activity" className="text-primary underline underline-offset-4">
            See every visit
          </Link>
        </p>
        {unmatched > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {unmatched} more apply {unmatched === 1 ? 'click' : 'clicks'} went to a link that is no longer on a listing, so they are not in the numbers below.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Time range">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/support/admin/visitors/applied?range=${r.key}`}
            aria-current={r.key === range.key ? 'true' : undefined}
            className={
              r.key === range.key
                ? 'rounded-md border border-foreground bg-foreground px-3 py-1.5 text-sm font-medium text-background'
                : 'rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted'
            }
          >
            {r.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BreakdownBars title="Function" buckets={tally(jobs, (j) => j.function)} />
        <BreakdownBars title="Seniority" buckets={tally(jobs, (j) => levelLabel(j.level))} />
        <BreakdownBars title="Where (state)" buckets={tally(jobs, (j) => j.state)} />
        <BreakdownBars title="Industry" buckets={tally(jobs, (j) => industryLabel(j.industry))} />
        <BreakdownBars title="Pay" hint="Middle of the posted range" buckets={tally(jobs, (j) => payBand(j.salaryMin, j.salaryMax), PAY_ORDER)} />
        <BreakdownBars title="Experience asked for" hint="Years the posting requires, or no experience needed" buckets={tally(jobs, experienceBucket, EXPERIENCE_ORDER)} />
        <BreakdownBars title="AI in the posting" buckets={tally(jobs, aiMentionBucket)} />
        <BreakdownBars title="How exposed the role is to AI" buckets={tally(jobs, aiExposureBucket, AI_EXPOSURE_ORDER)} />
      </div>

      <AdminDataTable
        columns={columns}
        rows={jobs}
        rowKey={(j) => j.url}
        emptyMessage="No one has clicked Apply in this range yet."
      />
    </div>
  )
}
