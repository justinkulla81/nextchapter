import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

const csv = (v: unknown) => {
  const s = v instanceof Date ? v.toISOString() : v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const edition = await prisma.mailingEdition.findUniqueOrThrow({
    where: { id },
    include: { recipients: { orderBy: { email: 'asc' }, include: { person: { select: { fullName: true } } } } },
  })
  const head = ['name', 'email', 'source', 'excluded', 'status', 'sent_at', 'delivered_at', 'first_opened_at_approx', 'open_count', 'first_clicked_at', 'click_count', 'bounced_at', 'bounce_detail', 'complained_at', 'unsubscribed_at', 'replied_at', 'error']
  const rows = edition.recipients.map((r) => [
    r.person?.fullName, r.email, r.source, r.excluded, r.status, r.sentAt, r.deliveredAt, r.openedAt, r.openCount,
    r.clickedAt, r.clickCount, r.bouncedAt, r.bounceDetail, r.complainedAt, r.unsubscribedAt, r.repliedAt, r.error,
  ].map(csv).join(','))
  return new Response([head.join(','), ...rows].join('\n'), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${edition.key}-recipients.csv"` },
  })
}
