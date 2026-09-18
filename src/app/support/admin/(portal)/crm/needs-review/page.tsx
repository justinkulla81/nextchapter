import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { CrmNeedsReviewList, type ReviewRow } from '@/components/admin/CrmNeedsReviewList'

export const maxDuration = 30

/**
 * Outbound emails the sync logged but couldn't confirm are about
 * NextChapter — see CrmActivity.needsReview. Real mail you sent, just not
 * yet counted as CRM outreach until a human says it belongs.
 */
export default async function CrmNeedsReviewPage() {
  await requireAdmin()

  const rows = await prisma.crmActivity.findMany({
    where: { needsReview: true, person: { deletedAt: null } },
    orderBy: { occurredAt: 'desc' },
    take: 500,
    select: {
      id: true, occurredAt: true, subject: true, body: true,
      person: { select: { id: true, fullName: true, priority: true } },
    },
  })

  const list: ReviewRow[] = rows
    .filter((r) => r.person)
    .map((r) => ({
      id: r.id,
      occurredAt: r.occurredAt.toISOString(),
      subject: r.subject,
      body: r.body,
      personId: r.person!.id,
      personName: r.person!.fullName,
      priority: r.person!.priority,
    }))

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/support/admin/crm/home" className="text-muted-foreground hover:underline">← Ecosystem</Link>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold">Needs review</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Outbound emails the sync found but couldn&apos;t confirm are about NextChapter — real mail you sent,
          not yet counted toward touch counts or &quot;waiting on a reply&quot; until you say it belongs.
          Approving confirms it; discarding removes it, same as it having never been logged.
        </p>
      </header>

      <CrmNeedsReviewList rows={list} />
    </div>
  )
}
