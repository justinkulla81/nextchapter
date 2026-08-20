import type { Metadata } from 'next'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SIZE_BAND_LABEL } from '@/components/companies/CompanyMetaLine'

export const metadata: Metadata = { title: 'Companies' }

const PAGE_SIZE = 25

const TRAJECTORY_ICON = { growing: TrendingUp, flat: Minus, contracting: TrendingDown } as const
const TRAJECTORY_LABEL: Record<string, string> = { growing: 'Growing', flat: 'Flat', contracting: 'Contracting' }
const TRAJECTORY_COLOR: Record<string, string> = {
  growing: 'text-success',
  flat: 'text-muted-foreground',
  contracting: 'text-destructive',
}

export default async function CompaniesIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { q, page: pageParam } = await searchParams
  const query = q?.trim() ?? ''
  const page = Math.max(1, Number(pageParam) || 1)

  const where = query ? { name: { contains: query, mode: 'insensitive' as const } } : {}

  const [totalCount, companies] = await Promise.all([
    prisma.company.count({ where }),
    prisma.company.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        industry: true,
        sizeBand: true,
        hqMetro: true,
        signals: { orderBy: { weekStartDate: 'desc' }, take: 1, select: { trajectory: true, openRolesTotal: true } },
        _count: { select: { memberEmployment: true } },
      },
    }),
  ])
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
        <p className="text-muted-foreground">
          Hiring signal, who to talk to, and how members have fared — for any company you&apos;re targeting.
        </p>
      </div>

      <form className="max-w-sm">
        <Input name="q" defaultValue={query} placeholder="Search companies…" />
      </form>

      {companies.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          {query ? 'No companies match your search.' : 'No companies yet.'}
        </p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {companies.map((company) => {
            const signal = company.signals[0]
            const Icon = signal ? TRAJECTORY_ICON[signal.trajectory as keyof typeof TRAJECTORY_ICON] : null
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
                render={<Link href={`/dashboard/companies?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(page - 1) })}`} />}
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
                render={<Link href={`/dashboard/companies?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(page + 1) })}`} />}
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
