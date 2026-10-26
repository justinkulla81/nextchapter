import 'server-only'
import { prisma } from '@/lib/prisma'

// The dashboard bell. Anything that wants to tell a member something calls notifyMember(); the same dedupeKey
// never lands twice for one member. Links are same-site paths only. Reading is capped at 20, newest first.

export interface MemberNotificationInput {
  kind: string
  title: string
  body?: string
  /** A path on this site, starting with a single slash. */
  href: string
  /** One event, one key (for example `layoff:<id>`), so reruns do not repeat it. */
  dedupeKey: string
}

export const isSafeHref = (href: string) => href.startsWith('/') && !href.startsWith('//')

/** Adds a notification unless one with the same key exists. Returns true when a new one was written. */
export async function notifyMember(candidateId: string, n: MemberNotificationInput): Promise<boolean> {
  if (!isSafeHref(n.href)) return false
  const res = await prisma.memberNotification.createMany({
    data: [{ candidateId, kind: n.kind.slice(0, 40), title: n.title.slice(0, 160), body: (n.body ?? '').slice(0, 300), href: n.href, dedupeKey: n.dedupeKey.slice(0, 120) }],
    skipDuplicates: true,
  })
  return res.count > 0
}

export interface BellItem {
  id: string
  kind: string
  title: string
  body: string
  href: string
  createdAt: string
  unread: boolean
}

export async function listMemberNotifications(candidateId: string): Promise<{ items: BellItem[]; unread: number }> {
  const [rows, unread] = await Promise.all([
    prisma.memberNotification.findMany({ where: { candidateId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.memberNotification.count({ where: { candidateId, readAt: null } }),
  ])
  return {
    unread,
    items: rows.map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, href: r.href, createdAt: r.createdAt.toISOString(), unread: r.readAt === null })),
  }
}
