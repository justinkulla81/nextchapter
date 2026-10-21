import type { Metadata } from 'next'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { SUPPRESSED_SENDER_REASONS } from '@/lib/network/suppressed-sender-reasons'
import { UnblockSenderButton } from '@/components/dashboard/UnblockSenderButton'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ListRow, RowList } from '@/components/candidate/ListRow'
import { EmptyCard } from '@/components/candidate/EmptyCard'
import { TrackedAction } from '@/components/candidate/TrackedAction'

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
    <div className="space-y-8">
      <PageHeader
        title="Blocked senders"
        intro="Senders you told us are not part of your job search. They stay out of your follow-ups and suggested contacts, so what you see is what matters."
        action={
          <TrackedAction variant="secondary" href="/dashboard/network/contacts" event="contacts_opened" properties={{ source: 'blocked_senders' }}>
            Back to people you know
          </TrackedAction>
        }
      />
      {senders.length === 0 ? (
        <EmptyCard title="Nobody is blocked" why='Use "Not job-related" on a follow-up and the sender shows up here. You can unblock anyone, and that only applies to future email.' />
      ) : (
        <RowList label="Blocked senders">
          {senders.map((s) => (
            <ListRow
              key={s.id}
              title={s.isDomain ? `Everyone at ${s.value}` : s.value}
              fact={`${SUPPRESSED_SENDER_REASONS.find((r) => r.reason === s.reason)?.label ?? 'Not job-related'} · blocked ${s.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
              actions={<UnblockSenderButton id={s.id} value={s.value} />}
            />
          ))}
        </RowList>
      )}
    </div>
  )
}
