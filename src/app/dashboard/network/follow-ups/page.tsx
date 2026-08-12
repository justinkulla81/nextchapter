import type { Metadata } from 'next'
import Link from 'next/link'
import { Bell, ArrowLeft } from 'lucide-react'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { getUnifiedFollowUps } from '@/lib/dashboard/unified-follow-ups'
import { formatRelativeTime } from '@/lib/format-relative-time'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Follow-ups' }

export default async function FollowUpsPage() {
  const profile = await getDashboardData()
  const items = await getUnifiedFollowUps(profile.id)

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to dashboard
      </Link>

      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-orange/15 text-orange">
          <Bell className="size-4" aria-hidden />
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Follow-ups</h1>
          <p className="text-xs text-muted-foreground">People and applications waiting on a reply from you</p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          You&apos;re all caught up — nothing needs a reply right now.
        </p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {items.map((item, i) => {
            const isExternal = item.href.startsWith('http')
            const content = (
              <>
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                  {item.title}
                </span>
                <span
                  className="max-w-[45%] shrink-0 truncate rounded-full bg-orange/15 px-2 py-0.5 text-xs font-medium text-foreground"
                  title={item.subtitle}
                >
                  {item.subtitle}
                </span>
                {item.date && (
                  <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                    {formatRelativeTime(item.date)}
                  </span>
                )}
              </>
            )
            const className = cn(
              'flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:text-brand',
              i === 0 && 'rounded-t-lg',
              i === items.length - 1 && 'rounded-b-lg'
            )
            return isExternal ? (
              <a
                key={`${item.kind}-${item.id}`}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {content}
              </a>
            ) : (
              <Link key={`${item.kind}-${item.id}`} href={item.href} className={className}>
                {content}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
