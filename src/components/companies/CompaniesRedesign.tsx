import Link from 'next/link'
import type { ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Avatar } from '@/components/candidate/ui'
import { ShowMore } from '@/components/candidate/ShowMore'
import { RankedCompanyLink, CompanyDirectoryViewed } from '@/components/companies/CompanyDirectoryAnalytics'
import { companyRowText, type RankingText } from '@/lib/redesign/jobs-pages'

export interface RedesignCompanyRow {
  id: string
  name: string
  canonicalNameNormalized: string
  industry: string | null
  hqMetro: string | null
  openRoles: number
  contacts: number
  rank: number | null
  band: 'strong' | 'worth_a_look' | 'long_shot' | null
  ranking: RankingText | null
}

// Companies in the redesign: a search box with one orange action, then one row per company with a single
// plain reason it is on the list and one fact. Filters, sort, market notes and member requests sit behind "Show more".
export function CompaniesRedesign({
  rows,
  query,
  sort,
  filters,
  anyFilter,
  page,
  pageCount,
  pageSize,
  totalCount,
  newStrongCount,
  buildHref,
  more,
}: {
  rows: RedesignCompanyRow[]
  query: string
  sort: 'fit' | 'az'
  filters: { key: string; label: string; checked: boolean }[]
  anyFilter: boolean
  page: number
  pageCount: number
  pageSize: number
  totalCount: number
  newStrongCount: number
  buildHref: (overrides: Record<string, string | undefined>) => string
  more: ReactNode
}) {
  const anyActive = anyFilter || !!query || sort === 'az'
  return (
    <div className="space-y-8">
      <CompanyDirectoryViewed sort={sort} resultCount={totalCount} page={page} hasFilters={anyFilter} hasQuery={!!query} />
      <PageHeader
        title="Companies"
        intro={
          newStrongCount > 0
            ? `${newStrongCount} ${newStrongCount === 1 ? 'company has' : 'companies have'} started hiring in your field since your last visit. Each one says why it is here.`
            : 'Companies worth a look, with the reason for each. Find one by name, or open one to see who you know there.'
        }
      />

      <form className="space-y-4" role="search" aria-label="Search companies">
        {sort === 'az' && <input type="hidden" name="sort" value="az" />}
        <div className="flex flex-wrap items-center gap-3">
          <Input name="q" defaultValue={query} placeholder="Search companies by name" aria-label="Search companies by name" className="h-11 max-w-sm" />
          <button type="submit" className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95">
            Search companies
          </button>
        </div>
        <ShowMore page="companies" label="Filters and sort" defaultOpen={anyFilter || sort === 'az'}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sort companies">
              <Button nativeButton={false} render={<Link href={`/dashboard/companies?${buildHref({ sort: undefined, page: undefined })}`} />} variant={sort === 'fit' ? 'default' : 'outline'} size="sm" aria-pressed={sort === 'fit'}>
                Best fit for me
              </Button>
              <Button nativeButton={false} render={<Link href={`/dashboard/companies?${buildHref({ sort: 'az', page: undefined })}`} />} variant={sort === 'az' ? 'default' : 'outline'} size="sm" aria-pressed={sort === 'az'}>
                A–Z
              </Button>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {filters.map(({ key, label, checked }) => (
                <div key={key} className="flex items-center gap-2">
                  <input type="checkbox" id={`r-${key}`} name={key} value="1" defaultChecked={checked} className="size-4 rounded border-input" />
                  <Label htmlFor={`r-${key}`} className="text-sm font-normal">
                    {label}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              &quot;Hide contracting&quot; reads posting-activity trends only. Filed layoff notices do not hide a company here; in Best fit they lower its rank and show as a note on the row.
            </p>
            <Button type="submit" size="sm" variant="outline">
              Apply filters
            </Button>
          </div>
        </ShowMore>
      </form>

      {rows.length === 0 ? (
        <section className="space-y-2 rounded-2xl border border-border p-7">
          <h2 className="font-display text-xl font-semibold text-ink">{anyActive ? 'No companies match yet' : 'No companies to show yet'}</h2>
          <p className="text-base text-muted-foreground">
            {anyActive ? 'Try a different name or turn a filter off, and companies appear here.' : 'As companies start hiring in your field they appear here, each with the reason.'}
          </p>
        </section>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border" aria-label="Companies">
          {rows.map((c) => {
            const text = companyRowText(c.ranking)
            const fact =
              c.contacts > 0
                ? `You know ${c.contacts} ${c.contacts === 1 ? 'person' : 'people'} there.`
                : c.openRoles > 0
                  ? `${c.openRoles} open ${c.openRoles === 1 ? 'role' : 'roles'}.`
                  : [c.industry, c.hqMetro].filter(Boolean).join(' · ')
            return (
              <li key={c.id}>
                <RankedCompanyLink
                  href={`/dashboard/companies/${encodeURIComponent(c.canonicalNameNormalized)}`}
                  companyId={c.id}
                  rank={c.rank}
                  band={c.band}
                  sort={sort}
                  className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50"
                >
                  <span className="flex min-w-0 items-center gap-4">
                    <Avatar name={c.name} />
                    <span className="min-w-0">
                      <span className="block truncate text-base font-semibold text-ink">{c.name}</span>
                      {c.ranking && <span className="block text-sm text-ink">{text.reason}</span>}
                      {(fact || text.note) && (
                        <span className="block text-sm text-muted-foreground">
                          {fact}
                          {text.note ? ` ${text.note}` : ''}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium text-brand underline underline-offset-4">Open</span>
                </RankedCompanyLink>
              </li>
            )
          })}
        </ul>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            Showing {(page - 1) * pageSize + 1}–{Math.min(totalCount, page * pageSize)} of {totalCount}
          </span>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Button nativeButton={false} render={<Link href={`/dashboard/companies?${buildHref({ page: String(page - 1) })}`} />} variant="outline" size="sm">
                Previous
              </Button>
            )}
            {page < pageCount && (
              <Button nativeButton={false} render={<Link href={`/dashboard/companies?${buildHref({ page: String(page + 1) })}`} />} variant="outline" size="sm">
                Next
              </Button>
            )}
          </div>
        </div>
      )}

      <ShowMore page="companies" label="More about your local market and pay">
        {more}
      </ShowMore>
    </div>
  )
}
