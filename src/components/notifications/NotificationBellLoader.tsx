import { listMemberNotifications } from '@/lib/notifications/member-notifications'
import { NotificationBell } from '@/components/notifications/NotificationBell'

/** Server half of the bell. Any error reads as "nothing new": the bell never blocks a page. */
export async function NotificationBellLoader({ candidateId }: { candidateId: string }) {
  const data = await listMemberNotifications(candidateId).catch(() => ({ items: [], unread: 0 }))
  return <NotificationBell items={data.items} unread={data.unread} />
}
