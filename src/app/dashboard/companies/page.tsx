import type { Metadata } from 'next'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Minus, Users } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SIZE_BAND_LABEL } from '@/components/companies/CompanyMetaLine'
import {
  getCandidateContactCountsByCompany,
  getCompaniesWithAnyMemberContact,
} from '@/lib/companies/candidate-contacts-at-company'

export const metadata: Metadata = { title: 'Companies' }

const PAGE_SIZE = 25
// A signal older than this doesn't say much about "right now" — same
// recency bar as the "Available jobs" and "Exclude contracting" filters use.
const RECENT_SIGNAL_WINDOW_MS = 8 * 7 * 24 * 60 * 60 * 1000 // 8 weeks

const TRAJECTORY_ICON = { growing: TrendingUp, flat: Minus, contracting: TrendingDown } as const
const TRAJECTORY_LABEL: Record<string, string> = { growing: 'Growing', flat: 'Flat', contracting: 'Contracting' }
const TRAJECTORY_COLOR: Record<string, string> = {
  growing: 'text-success',
  flat: 'text-muted-foreground',
  contracting: 'text-destructive',
}

interface SearchParams {
  q?: string
  page?: string
  jobs?: string
  nc1?: string
  nc2?: string
  mine?: string
  noContracting?: string
}

// Module-level helper, not called inline inside the component body —
// Date.now() is an impure call the react-hooks/purity rule flags wherever a
// component function reads it directly.
function recentSignalCutoff(): number {
  return Date.now() - RECENT_SIGNAL_WINDOW_MS
}

function buildQuery(params: SearchParams, overrides: Partial<SearchParams>): string {
  const merged = { ...params, ...overrides }
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(merged)) {
    if (value) usp.set(key, value)
  }
  return usp.toString()
}

export default async function CompaniesIndexPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const query = params.q?.trim() ?? ''
  const page = Math.max(1, Number(params.page) || 1)
  const filterJobs = params.jobs === '1'
  const filterNc1 = params.nc1 === '1'
  const filterNc2 = params.nc2 === '1'
  const filterMine = params.mine === '1'
  const filterNoContracting = params.noContracting === '1'

  const profile = await getDashboardData()

  // Small table (low hundreds of rows in production) — cheap to fetch in
  // full and filter/paginate in application code rather than building a
  // half-dozen conditional Prisma `where` branches for signals that live on
  // a related, weekly-snapshot table Prisma can't easily filter "latest row
  // only" against.
  const allCompanies = await prisma.company.findMany({
    where: query ? { name: { contains: query, mode: 'insensitive' as const } } : {},
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      industry: true,
      sizeBand: true,
      hqMetro: true,
      signals: { orderBy: { weekStartDate: 'desc' }, take: 1, select: { trajectory: true, openRolesTotal: true, weekStartDate: true } },
      _count: { select: { memberEmployment: true } },
    },
  })

  const companyNames = allCompanies.map((c) => c.name)
  const recentCutoff = recentSignalCutoff()

  // Always computed (cheap — one query for the viewer's own contacts,
  // matched in memory against ~100 companies) since it powers both the
  // "Your connections" filter and the per-row contact count everyone sees.
  const [contactCountsByCompany, membersWithContact] = await Promise.all([
    getCandidateContactCountsByCompany(profile.id, companyNames),
    // Only fetched when the filter is actually on — a full contacts-table
    // scan isn't worth it for a filter most visits won't use.
    filterNc2 ? getCompaniesWithAnyMemberContact(profile.id, companyNames) : Promise.resolve(new Set<string>()),
  ])

  const filtered = allCompanies.filter((company) => {
    const signal = company.signals[0]
    const signalIsRecent = signal && signal.weekStartDate.getTime() >= recentCutoff
    if (filterJobs && !(signalIsRecent && signal.openRolesTotal > 0)) return false
    if (filterNoContracting && signalIsRecent && signal.trajectory === 'contracting') return false
    if (filterNc1 && company._count.memberEmployment === 0) return false
    if (filterNc2 && !membersWithContact.has(company.name)) return false
    if (filterMine && !contactCountsByCompany.has(company.name)) return false
    return true
  })

  const totalCount = filtered.length
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const companies = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const filterCheckboxes: { key: keyof SearchParams; label: string; checked: boolean }[] = [
    { key: 'jobs', label: 'Has open roles', checked: filterJobs },
    { key: 'nc1', label: 'NC members worked here', checked: filterNc1 },
    { key: 'nc2', label: 'NC members have a contact here', checked: filterNc2 },
    { key: 'mine', label: 'You have a contact here', checked: filterMine },
    { key: 'noContracting', label: 'Hide contracting companies', checked: filterNoContracting },
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
        <p className="text-muted-foreground">
          Hiring signal, who to talk to, and how members have fared — for any company you&apos;re targeting.
        </p>
      </div>

      <form className="space-y-3">
        <Input name="q" defaultValue={query} placeholder="Search companies…" className="max-w-sm" />
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {filterCheckboxes.map(({ key, label, checked }) => (
            <div key={key} className="flex items-center gap-2">
              {/* Plain native input, not the design system's Checkbox — this
                  is a no-JS GET form (query params on submit), and a native
                  checkbox is the one guaranteed-correct way to get that
                  submission behavior without depending on how a headless
                  component's hidden input forwards `value`. */}
              <input
                type="checkbox"
                id={key}
                name={key}
                value="1"
                defaultChecked={checked}
                className="size-4 rounded border-input"
              />
              <Label htmlFor={key} className="text-sm font-normal">
                {label}
              </Label>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          &quot;Hide contracting&quot; is based on real posting-activity trends only — no WARN-filing data source
          exists yet, so this isn&apos;t a layoff-notice filter.
        </p>
        <Button type="submit" size="sm" variant="outline">
          Apply
        </Button>
      </form>

      {companies.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          {query || filterJobs || filterNc1 || filterNc2 || filterMine || filterNoContracting
            ? 'No companies match your search and filters.'
            : 'No companies yet.'}
        </p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {companies.map((company) => {
            const signal = company.signals[0]
            const Icon = signal ? TRAJECTORY_ICON[signal.trajectory as keyof typeof TRAJECTORY_ICON] : null
            const myContactCount = contactCountsByCompany.get(company.name) ?? 0
            return (
              <Link
                key={company.id}
                href={`/dashboard/companies/${company.id}`}
                className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{company.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[company.industry, company.sizeBand ? SIZE_BAND_LABEL[company.sizeBand] : null, company.hqMetro]
                      .filter(Boolean)
                      .join(' · ') || 'Details still filling in'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-sm">
                  {myContactCount > 0 && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Users className="size-3.5" aria-hidden="true" />
                      {myContactCount} your contact{myContactCount === 1 ? '' : 's'}
                    </span>
                  )}
                  {company._count.memberEmployment > 0 && (
                    <span className="text-muted-foreground">
                      {company._count.memberEmployment} NextChapter member{company._count.memberEmployment === 1 ? '' : 's'}
                    </span>
                  )}
                  {signal && Icon && (
                    <span className={`flex items-center gap-1 font-medium ${TRAJECTORY_COLOR[signal.trajectory]}`}>
                      <Icon className="size-4" aria-hidden />
                      {TRAJECTORY_LABEL[signal.trajectory]}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(totalCount, page * PAGE_SIZE)} of {totalCount}
          </span>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Button
                nativeButton={false}
                render={<Link href={`/dashboard/companies?${buildQuery(params, { page: String(page - 1) })}`} />}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
            )}
            <span className="tabular-nums">
              Page {page} of {pageCount}
            </span>
            {page < pageCount && (
              <Button
                nativeButton={false}
                render={<Link href={`/dashboard/companies?${buildQuery(params, { page: String(page + 1) })}`} />}
                variant="outline"
                size="sm"
              >
                Next
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
