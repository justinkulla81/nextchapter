// Talent Hub › Jobs: every job in the region (read-only, links out to the employer's own posting) and the jobs the organization adds
// for its group (one at a time or pasted, reviewed by NextChapter before the group sees them). Lists never read posting text.

import Link from 'next/link'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { memoTtl } from '@/lib/db/heavy'
import { readLocal } from '@/lib/workforce/local'
import { jobStatusLabel } from '@/lib/workforce/group-jobs'
import { StatTile } from './StatTile'
import { ArchiveJobButton, GroupJobForm, ImportJobsForm } from './HubFlowForms'

type Props = { ctx: WorkspaceContext; searchParams: { q?: string; page?: string }; base: string }

const PAGE = 25
const money = (n: number | null) => (n ? `$${Math.round(n / 1000)}k` : null)
const day = (d: Date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(d))
const LEVELS: Record<string, string> = { ENTRY_IC: 'Entry level', EARLY_IC: 'Early career', MID_IC: 'Mid-level', SENIOR_IC: 'Senior', STAFF_IC: 'Senior', MANAGER: 'Manager', SENIOR_MANAGER: 'Senior manager', DIRECTOR: 'Director', VP: 'Vice president', EVP_SVP: 'Executive vice president', C_SUITE: 'C-suite' }
const level = (l: string | null) => (l ? (LEVELS[l] ?? l.replace(/_IC$/, '').replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())) : null)

type RegionJob = { id: string; title: string; companyName: string; location: string | null; url: string; level: string | null; salaryMin: number | null; salaryMax: number | null; createdAt: Date }

// One bounded read per city: the newest 200 open listings in the state that name the city, narrow rows (no description),
// about 60 KB, shared for 30 minutes. Scoped (group-only) postings are never in it.
const loadRegionJobs = memoTtl(
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
  const all = await loadRegionJobs(local.anchorCity, local.anchorState).catch(() => [] as RegionJob[])
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
        The newest open jobs in {local.anchorCity}, from employers’ own career sites. Each links to the employer’s posting. Add jobs just for your group under{' '}
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
                {['Job', 'Employer', 'Where', 'Level', 'Pay', 'Posted'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium">
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
  const label = (r: (typeof rows)[number]) => jobStatusLabel(r.status, false, !!r.expiresAt && r.expiresAt <= now)
  const live = rows.filter((r) => label(r) === 'Live for your group').length
  const waiting = rows.filter((r) => label(r) === 'Waiting for NextChapter review').length
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Jobs you add here are shown to the people in your group, ahead of the open board. NextChapter reviews each one first, so nothing goes out unchecked. Employers can also post their own jobs from the Employer view.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Live for your group" value={live} />
        <StatTile label="Waiting for review" value={waiting} />
        <StatTile label="All you have added" value={rows.length} />
      </div>

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
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Adding jobs is off in this read-only preview. In your own account, a staff member adds a job or pastes a list here.</p>
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
                    <td className="px-3 py-2">{!ctx.readOnly && <ArchiveJobButton slug={slug} id={r.id} title={r.title} />}</td>
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
