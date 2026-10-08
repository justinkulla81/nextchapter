import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

const csv = (v: unknown) => {
  const s = v instanceof Date ? v.toISOString() : v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  // ?all=1: every version of this edition in one file, with a version column.
  const all = req.nextUrl.searchParams.get('all') === '1'
  const edition = await prisma.mailingEdition.findUniqueOrThrow({ where: { id }, select: { id: true, key: true, versionOfId: true } })
  const rootId = edition.versionOfId ?? edition.id
  const editions = await prisma.mailingEdition.findMany({
    where: all ? { OR: [{ id: rootId }, { versionOfId: rootId }] } : { id },
    orderBy: { createdAt: 'asc' },
    select: { key: true, title: true, recipients: { orderBy: { email: 'asc' }, include: { person: { select: { fullName: true } } } } },
  })
  const head = [...(all ? ['version', 'version_key'] : []), 'name', 'email', 'source', 'excluded', 'status', 'sent_at', 'delivered_at', 'first_opened_at_approx', 'open_count', 'first_clicked_at', 'click_count', 'bounced_at', 'bounce_detail', 'complained_at', 'unsubscribed_at', 'replied_at', 'error']
  const rows = editions.flatMap((e) => e.recipients.map((r) => [
    ...(all ? [e.title, e.key] : []),
    r.person?.fullName, r.email, r.source, r.excluded, r.status, r.sentAt, r.deliveredAt, r.openedAt, r.openCount,
    r.clickedAt, r.clickCount, r.bouncedAt, r.bounceDetail, r.complainedAt, r.unsubscribedAt, r.repliedAt, r.error,
  ].map(csv).join(',')))
  const name = all ? `${editions[0]?.key ?? edition.key}-all-versions` : edition.key
  return new Response([head.join(','), ...rows].join('\n'), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}-recipients.csv"` },
  })
}
