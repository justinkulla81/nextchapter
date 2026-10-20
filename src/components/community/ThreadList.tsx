import Link from 'next/link'
import type { ReactNode } from 'react'
import { AvatarDisplay } from '@/components/ui/avatar-display'
import { threadFact } from '@/lib/redesign/network-account'
import { cn } from '@/lib/utils'

export interface ThreadListItem {
  id: string
  name: string
  avatarUrl?: string | null
  unread: boolean
  /** Who they are to you, for example "Coach". */
  kind: string | null
  href: string
}

// The conversations on the left of Messages. Each row is a name and one fact; "New reply waiting" is said in words and
// in bold instead of an orange "NEW" badge. Same links and same unread logic as before.
export function ThreadList({ label, emptyText, activeId, threads, children }: { label: string; emptyText: string; activeId?: string; threads: ThreadListItem[]; children?: ReactNode }) {
  return (
    <div className="shrink-0 space-y-4 md:w-72">
      <ul aria-label={label} className="divide-y divide-border rounded-2xl border border-border">
        {threads.length === 0 ? (
          <li className="p-4 text-base text-muted-foreground">{emptyText}</li>
        ) : (
          threads.map((t) => {
            const fact = threadFact(t.unread, t.kind)
            return (
              <li key={t.id}>
                <Link href={t.href} aria-current={t.id === activeId ? 'true' : undefined} className={cn('flex items-center gap-3 p-4 hover:bg-muted', t.id === activeId && 'bg-muted')}>
                  <AvatarDisplay name={t.name} url={t.avatarUrl} size={40} />
                  <span className="min-w-0">
                    <span className="block truncate text-base font-semibold text-ink">{t.name}</span>
                    {fact && <span className={cn('block truncate text-sm', t.unread ? 'font-semibold text-ink' : 'text-muted-foreground')}>{fact}</span>}
                  </span>
                </Link>
              </li>
            )
          })
        )}
      </ul>
      {children}
    </div>
  )
}
