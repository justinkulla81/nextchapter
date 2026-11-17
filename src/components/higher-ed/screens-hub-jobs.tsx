// Talent Hub › Jobs: every job in the region (read-only, links out to the employer's own posting) and the jobs the organization adds
// for its group (one at a time or pasted, reviewed by NextChapter before the group sees them). Lists never read posting text.

import Link from 'next/link'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { memoTtl } from '@/lib/db/heavy'
import { readLocal } from '@/lib/workforce/local'
import { jobStatusLabel } from '@/lib/workforce/group-jobs'
import { StatTile } from './StatTile'
import { ArchiveJobButton, ConnectFeedForm, EmployerJobDecision, DisconnectFeedButton, FeatureJobButton, RefreshFeedButton, GroupJobForm, ImportJobsForm } from './HubFlowForms'
import { MAX_FEATURED } from '@/lib/workforce/featured-jobs'
import { providerLabel } from '@/lib/workforce/job-feeds'
import { ORG_PENDING, hoursWaiting, waitedLabel } from '@/lib/workforce/employer-jobs'

type Props = { ctx: WorkspaceContext; searchParams: { q?: string; page?: string }; base: string }

const PAGE = 25
const money = (n: number | null) => (n ? `$${Math.round(n / 1000)}k` : null)
const day = (d: Date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(d))
const LEVELS: Record<string, string> = { ENTRY_IC: 'Entry level', EARLY_IC: 'Early career', MID_IC: 'Mid-level', SENIOR_IC: 'Senior', STAFF_IC: 'Senior', MANAGER: 'Manager', SENIOR_MANAGER: 'Senior manager', DIRECTOR: 'Director', VP: 'Vice president', EVP_SVP: 'Executive vice president', C_SUITE: 'C-suite' }
const level = (l: string | null) => (l ? (LEVELS[l] ?? l.replace(/_IC$/, '').replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())) : null)

type RegionJob = { id: string; title: string; companyName: string; location: string | null; url: string; level: string | null; salaryMin: number | null; salaryMax: number | null; createdAt: Date }

// One bounded read per city: the newest 200 open listings in the state that name the city, narrow rows (no description),
// about 60 KB, shared for 30 minutes. Scoped (group-only) postings are never in it.
export const loadRegionJobs = memoTtl(
  30 * 60_000,
  (city: string, state: string) => `${city}|${state}`,
  async (city: string, state: string): Promise<RegionJob[]> =>
    prisma.exclusiveJobPosting.findMany({
      where: {
        status: 'approved',
        archivedAt: null,
        institutionScopeId: null,
        locationState: state,
        location: { contains: city, mode: 'insensitive' },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, title: true, companyName: true, location: true, url: true, level: true, salaryMin: true, salaryMax: true, createdAt: true },
    }),
)

export async function HubRegionJobs({ ctx, searchParams, base }: Props) {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } })
  const local = readLocal(inst.enabledFeatures)
  if (!local) return <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">Set your region on Reports › Kept in region to see the jobs near you.</p>
  const [all, featuredRows] = await Promise.all([
    loadRegionJobs(local.anchorCity, local.anchorState).catch(() => [] as RegionJob[]),
    prisma.featuredJob.findMany({ where: { institutionId: ctx.institution.id }, select: { postingId: true }, take: MAX_FEATURED }).catch(() => []),
  ])
  const featuredIds = new Set(featuredRows.map((f) => f.postingId))
  const q = (searchParams.q ?? '').trim().toLowerCase().slice(0, 80)
  const jobs = q ? all.filter((j) => `${j.title} ${j.companyName}`.toLowerCase().includes(q)) : all
  const page = Math.max(1, Math.min(Number(searchParams.page) || 1, Math.ceil(jobs.length / PAGE) || 1))
  const shown = jobs.slice((page - 1) * PAGE, page * PAGE)
  const withPay = all.filter((j) => j.salaryMin && j.salaryMax).length
  const employers = new Set(all.map((j) => j.companyName)).size
  const href = (p: number) => `${base}/regionjobs?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`
  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        The newest open jobs in {local.anchorCity}, from employers’ own career sites. Each links to the employer’s posting. Feature a job and your group sees it first. Add jobs just for your group under{' '}
        <Link href={`${base}/groupjobs`} className="text-[color:var(--accent-text,var(--primary))] hover:underline">
          Jobs for your group
        </Link>
        .
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Newest jobs read" value={all.length.toLocaleString()} note={`In ${local.anchorCity}, refreshed every 30 minutes`} />
        <StatTile label="Employers hiring" value={employers.toLocaleString()} />
        <StatTile label="State a pay range" value={all.length ? `${Math.round((withPay / all.length) * 100)}%` : '—'} />
        <StatTile label="Matching your search" value={jobs.length.toLocaleString()} />
      </div>
      <form action={`${base}/regionjobs`} className="flex max-w-lg gap-2">
        <label htmlFor="jq" className="sr-only">
          Search jobs by title or company
        </label>
        <input id="jq" name="q" defaultValue={q} placeholder="Search by title or company" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
        <button type="submit" className="h-9 rounded-md border border-input px-3 text-sm font-medium">
          Search
        </button>
      </form>
      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">{q ? 'No jobs match that search.' : 'No open jobs found for this region yet.'}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['Job', 'Employer', 'Where', 'Level', 'Pay', 'Posted', ''].map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((j) => (
                <tr key={j.id} className="border-t border-border">
                  <td className="min-w-48 px-3 py-2">
                    <a href={j.url} target="_blank" rel="noreferrer" className="font-medium text-[color:var(--accent-text,var(--primary))] hover:underline">
                      {j.title}
                    </a>
                  </td>
                  <td className="px-3 py-2">{j.companyName}</td>
                  <td className="px-3 py-2 text-muted-foreground">{j.location ? j.location.replace(/,?\s*UNITED STATES$/i, '') : '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{level(j.level) ?? '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{j.salaryMin && j.salaryMax ? `${money(j.salaryMin)} to ${money(j.salaryMax)}` : <span className="text-muted-foreground">Not stated</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">{day(j.createdAt)}</td>
                  <td className="px-3 py-2">
                    {!ctx.readOnly && <FeatureJobButton slug={ctx.institution.slug} postingId={j.id} title={j.title} featured={featuredIds.has(j.id)} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {jobs.length > PAGE && (
        <nav aria-label="Pages" className="flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link href={href(page - 1)} className="text-[color:var(--accent-text,var(--primary))] hover:underline">
              Previous
            </Link>
          )}
          <span className="text-muted-foreground">
            Page {page} of {Math.ceil(jobs.length / PAGE)}
          </span>
          {page < Math.ceil(jobs.length / PAGE) && (
            <Link href={href(page + 1)} className="text-[color:var(--accent-text,var(--primary))] hover:underline">
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

export async function HubGroupJobs({ ctx }: Props) {
  const slug = ctx.institution.slug
  const now = new Date()
  const rows = await prisma.exclusiveJobPosting.findMany({
    where: { institutionScopeId: ctx.institution.id, archivedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { id: true, title: true, companyName: true, location: true, url: true, status: true, expiresAt: true, createdAt: true, source: true, rejectionReason: true },
  })
  const featuredRows = await prisma.featuredJob.findMany({ where: { institutionId: ctx.institution.id }, orderBy: { createdAt: 'desc' }, take: MAX_FEATURED, select: { postingId: true, note: true } }).catch(() => [])
  const featuredPostings = featuredRows.length
    ? await prisma.exclusiveJobPosting.findMany({
        where: { id: { in: featuredRows.map((f) => f.postingId) }, status: 'approved', archivedAt: null },
        select: { id: true, title: true, companyName: true, location: true, url: true },
      })
    : []
  const featured = featuredRows.flatMap((f) => {
    const p = featuredPostings.find((x) => x.id === f.postingId)
    return p ? [{ ...p, note: f.note }] : []
  })
  const featuredIds = new Set(featuredRows.map((f) => f.postingId))
  const [feeds, inst] = await Promise.all([
    prisma.groupJobFeed.findMany({ where: { institutionId: ctx.institution.id }, orderBy: { createdAt: 'asc' }, take: 25 }).catch(() => []),
    prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } }),
  ])
  const place = readLocal(inst.enabledFeatures)?.anchorCity ?? ''
  const label = (r: (typeof rows)[number]) => jobStatusLabel(r.status, false, !!r.expiresAt && r.expiresAt <= now)
  const live = rows.filter((r) => label(r) === 'Live for your group').length
  const waiting = rows.filter((r) => label(r) === 'Waiting for NextChapter review').length
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Jobs you add here, or bring in from an employer’s job board, are shown to the people in your group, ahead of the open board. NextChapter reviews each one first, so nothing goes out unchecked. Employers can also post their own jobs from the Employer view.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Live for your group" value={live} />
        <StatTile label="Waiting for review" value={waiting} />
        <StatTile label="All you have added" value={rows.length} />
        <StatTile label="Featured" value={`${featured.length} of ${MAX_FEATURED}`} note="Shown first to your group" />
      </div>

      <section className="space-y-3" aria-labelledby="feat">
        <h2 id="feat" className="text-base font-semibold">
          Featured for your group
        </h2>
        {featured.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            Nothing featured yet. Feature a job from the region list or from your own listings below, and your group sees it first, marked as chosen by {ctx.institution.name}.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {featured.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1 basis-64">
                  <a href={j.url} target="_blank" rel="noreferrer" className="font-medium text-[color:var(--accent-text,var(--primary))] hover:underline">
                    {j.title}
                  </a>
                  <p className="text-muted-foreground">{[j.companyName, j.location].filter(Boolean).join(' · ')}</p>
                  {j.note && <p className="text-muted-foreground">“{j.note}”</p>}
                </div>
                {!ctx.readOnly && <FeatureJobButton slug={slug} postingId={j.id} title={j.title} featured />}
              </li>
            ))}
          </ul>
        )}
      </section>

      {!ctx.readOnly ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <details className="rounded-lg border border-border bg-card p-4" open={rows.length === 0}>
            <summary className="cursor-pointer text-sm font-medium text-[color:var(--accent-text,var(--primary))]">Add a job</summary>
            <div className="pt-3">
              <GroupJobForm slug={slug} />
            </div>
          </details>
          <details className="rounded-lg border border-border bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium text-[color:var(--accent-text,var(--primary))]">Add listings from elsewhere</summary>
            <div className="pt-3">
              <ImportJobsForm slug={slug} />
            </div>
          </details>
          <details className="rounded-lg border border-border bg-card p-4 lg:col-span-2" open={feeds.length === 0}>
            <summary className="cursor-pointer text-sm font-medium text-[color:var(--accent-text,var(--primary))]">Connect an employer’s job board</summary>
            <div className="pt-3">
              <ConnectFeedForm slug={slug} defaultPlace={place} />
            </div>
          </details>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Adding jobs is off in this read-only preview. In your own account, a staff member adds a job or pastes a list here.</p>
      )}

      {feeds.length > 0 && (
        <section className="space-y-3" aria-labelledby="feeds">
          <h2 id="feeds" className="text-base font-semibold">
            Connected job boards
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {feeds.map((fd) => (
              <li key={fd.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="font-medium">{fd.companyName}</p>
                  <p className="text-muted-foreground">
                    {providerLabel(fd.provider)} · {fd.locationFilter ? `jobs in ${fd.locationFilter}${fd.includeRemote ? ' and remote' : ''}` : 'every job on the board'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fd.lastError ? fd.lastError : fd.lastSyncedAt ? `Refreshed ${day(fd.lastSyncedAt)}: ${fd.lastSeen} near you, ${fd.lastAdded} new. Refreshes every day.` : 'Not read yet.'}
                  </p>
                </div>
                {!ctx.readOnly && (
                  <div className="flex flex-wrap items-center gap-2">
                    <RefreshFeedButton slug={slug} id={fd.id} />
                    <DisconnectFeedButton slug={slug} id={fd.id} name={fd.companyName} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3" aria-labelledby="mine">
        <h2 id="mine" className="text-base font-semibold">
          Your listings
        </h2>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No jobs yet. Add one, or paste a list from a spreadsheet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['Job', 'Employer', 'Where', 'Added', 'Status', ''].map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="min-w-48 px-3 py-2">
                      <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-[color:var(--accent-text,var(--primary))] hover:underline">
                        {r.title}
                      </a>
                    </td>
                    <td className="px-3 py-2">{r.companyName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.location ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{day(r.createdAt)}</td>
                    <td className="px-3 py-2">
                      {label(r)}
                      {r.status === 'rejected' && r.rejectionReason && <span className="block text-xs text-muted-foreground">{r.rejectionReason}</span>}
                    </td>
                    <td className="px-3 py-2">
                      {!ctx.readOnly && (
                        <div className="flex flex-wrap items-center gap-2">
                          {label(r) === 'Live for your group' && !featuredIds.has(r.id) && <FeatureJobButton slug={slug} postingId={r.id} title={r.title} featured={false} />}
                          <ArchiveJobButton slug={slug} id={r.id} title={r.title} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------

// Employers' jobs: approved employers post from their own view; the organization looks first, then NextChapter.
export async function HubEmployerJobs({ ctx }: Props) {
  const slug = ctx.institution.slug
  const rows = await prisma.exclusiveJobPosting.findMany({
    where: { institutionScopeId: ctx.institution.id, addedBy: { startsWith: 'employer:' }, archivedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, title: true, companyName: true, location: true, url: true, status: true, createdAt: true, rejectionReason: true },
  })
  const waiting = rows.filter((r) => r.status === ORG_PENDING)
  const decided = rows.filter((r) => r.status !== ORG_PENDING).slice(0, 20)
  const statusWord = (s: string) => (s === 'approved' ? 'Live for your group' : s === 'rejected' ? 'Not approved' : 'Waiting for NextChapter review')
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Employers you have approved post jobs from their own view. You look at each one first. Approve it and NextChapter checks it next; then the people in your group see it. Decline it and the employer sees your reason.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Waiting for you" value={waiting.length} />
        <StatTile label="With NextChapter" value={rows.filter((r) => r.status === 'pending').length} note="You approved; being checked" />
        <StatTile label="Live for your group" value={rows.filter((r) => r.status === 'approved').length} />
      </div>

      <section className="space-y-3" aria-labelledby="ej-wait">
        <h2 id="ej-wait" className="text-base font-semibold">
          Waiting for you
        </h2>
        {waiting.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">Nothing to review. When an approved employer posts a job, it shows up here.</p>
        ) : (
          <ul className="space-y-3">
            {waiting.map((j) => (
              <li key={j.id} className="rounded-lg border border-border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <a href={j.url} target="_blank" rel="noreferrer" className="font-medium text-[color:var(--accent-text,var(--primary))] hover:underline">
                    {j.title}
                  </a>
                  <p className="text-xs text-muted-foreground">Posted {waitedLabel(hoursWaiting(j.createdAt))}</p>
                </div>
                <p className="text-muted-foreground">{[j.companyName, j.location].filter(Boolean).join(' · ')}</p>
                <p className="mt-1 text-xs text-muted-foreground">Open the link to check it goes to the employer’s own posting, with the pay and location it states.</p>
                {!ctx.readOnly && (
                  <div className="mt-3">
                    <EmployerJobDecision slug={slug} id={j.id} title={j.title} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {decided.length > 0 && (
        <section className="space-y-3" aria-labelledby="ej-done">
          <h2 id="ej-done" className="text-base font-semibold">
            Already decided
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['Job', 'Employer', 'Where it stands'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {decided.map((j) => (
                  <tr key={j.id} className="border-t border-border">
                    <td className="min-w-48 px-3 py-2">{j.title}</td>
                    <td className="px-3 py-2">{j.companyName}</td>
                    <td className="px-3 py-2">
                      {statusWord(j.status)}
                      {j.status === 'rejected' && j.rejectionReason && <span className="block text-xs text-muted-foreground">{j.rejectionReason}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
