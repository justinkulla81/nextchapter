import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { SUPPRESSED_SENDER_REASONS } from '@/lib/network/suppressed-sender-reasons'
import { UnblockSenderButton } from '@/components/dashboard/UnblockSenderButton'

export const metadata: Metadata = { title: 'Blocked senders' }

export default async function BlockedSendersPage() {
  const profile = await getDashboardProfile()
  // Fails soft like loadSuppression: before the table exists this shows the
  // empty state instead of an error page.
  const senders = await prisma.suppressedSender
    .findMany({
      where: { candidateId: profile.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, value: true, isDomain: true, reason: true, createdAt: true },
      take: 500,
    })
    .catch(() => [])

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/network/contacts"
          className="text-sm font-medium text-primary underline underline-offset-4"
        >
          ← Back to Contact Directory
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Blocked senders</h1>
        <p className="mt-1 text-muted-foreground">
          Senders you told us aren&apos;t part of your job search. They never show up as follow-ups or suggested
          contacts. Unblock one if it was a mistake; that only applies to future email.
        </p>
      </div>

      {senders.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nobody&apos;s blocked. Use &quot;Not job-related&quot; on a follow-up and the sender will appear here.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {senders.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{s.isDomain ? `Everyone at ${s.value}` : s.value}</p>
                <p className="text-xs text-muted-foreground">
                  {SUPPRESSED_SENDER_REASONS.find((r) => r.reason === s.reason)?.label} · blocked{' '}
                  {s.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <UnblockSenderButton id={s.id} value={s.value} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
