import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { CrmRemovedList, type RemovedRow } from '@/components/admin/CrmRemovedList'

export const maxDuration = 30

const LIMIT = 500

/**
 * Everyone who has been removed, newest removal first.
 *
 * Removal has always been a soft delete — nothing was ever lost — but with no
 * view of it, "removed" and "gone" looked the same. People are grouped by the
 * moment they were removed, since a bulk removal is one decision and is
 * usually undone as one.
 */
export default async function CrmRemovedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const withHistory = sp.history === '1'

  const where: Prisma.CrmPersonWhereInput = {
    deletedAt: { not: null },
    ...(withHistory ? { touchCount: { gt: 0 } } : {}),
    ...(q
      ? {
          AND: q.split(/\s+/).filter(Boolean).slice(0, 6).map((t) => ({
            OR: [
              { fullName: { contains: t, mode: 'insensitive' as const } },
              { email: { contains: t, mode: 'insensitive' as const } },
              { affiliations: { some: { org: { name: { contains: t, mode: 'insensitive' as const } } } } },
            ],
          })),
        }
      : {}),
  }

  const [rows, total, totalWithHistory] = await Promise.all([
    prisma.crmPerson.findMany({
      where,
      orderBy: [{ deletedAt: 'desc' }, { fullName: 'asc' }],
      take: LIMIT,
      select: {
        id: true, fullName: true, email: true, deletedAt: true, touchCount: true,
        lastTouchedAt: true, mergedIntoId: true, priority: true,
        affiliations: { where: { isPrimary: true }, take: 1, select: { title: true, org: { select: { name: true } } } },
      },
    }),
    prisma.crmPerson.count({ where }),
    prisma.crmPerson.count({ where: { deletedAt: { not: null }, touchCount: { gt: 0 } } }),
  ])

  const mergedIds = [...new Set(rows.map((r) => r.mergedIntoId).filter((x): x is string => Boolean(x)))]
  const mergedNames = new Map(
    (await prisma.crmPerson.findMany({ where: { id: { in: mergedIds } }, select: { id: true, fullName: true } }))
      .map((p) => [p.id, p.fullName]),
  )

  const list: RemovedRow[] = rows.map((r) => ({
    id: r.id,
    name: r.fullName,
    email: r.email,
    org: r.affiliations[0]?.org?.name ?? null,
    title: r.affiliations[0]?.title ?? null,
    priority: r.priority,
    removedAt: r.deletedAt!.toISOString(),
    touches: r.touchCount,
    lastTouchedAt: r.lastTouchedAt?.toISOString() ?? null,
    mergedInto: r.mergedIntoId ? (mergedNames.get(r.mergedIntoId) ?? 'another record') : null,
  }))

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/crm" className="text-muted-foreground hover:underline">← People</Link>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold">Removed people</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Removing someone hides them everywhere but deletes nothing — their emails and history are kept, and
          restoring brings all of it back. Someone removed is also never re-added by the email sync.
        </p>
      </header>

      <form method="get" className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
        <input
          type="search" name="q" defaultValue={q} placeholder="Search name, email or organization…"
          className="h-9 min-w-56 flex-1 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="history" value="1" defaultChecked={withHistory} />
          Only people you&apos;ve been in contact with ({totalWithHistory})
        </label>
        <button type="submit" className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted">Filter</button>
        {(q || withHistory) && (
          <Link href="/support/admin/crm/removed" className="text-sm text-muted-foreground underline underline-offset-4">Clear</Link>
        )}
      </form>

      <p className="text-sm text-muted-foreground">
        {total.toLocaleString()} removed {total === 1 ? 'person' : 'people'}
        {total > LIMIT ? ` — showing the ${LIMIT} most recently removed` : ''}
      </p>

      <CrmRemovedList rows={list} />
    </div>
  )
}
