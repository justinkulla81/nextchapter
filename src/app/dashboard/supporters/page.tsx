import type { Metadata } from 'next'
import { after } from 'next/server'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { MAX_SUPPORTERS } from '@/lib/supporters/supporters'
import { InviteSupporterForm, RemoveSupporterButton } from './SupporterForms'

export const metadata: Metadata = { title: 'My supporters' }

// Someone to keep you going. They get one short weekly note about your effort
// (never names, companies or messages) and can send you a cheer.
export default async function SupportersPage() {
  const profile = await getDashboardProfile()
  const [supporters, cheers] = await Promise.all([
    prisma.searchSupporter.findMany({ where: { candidateId: profile.id, revokedAt: null }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, email: true, lastDigestAt: true } }),
    prisma.supporterCheer.findMany({
      where: { supporter: { candidateId: profile.id } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, message: true, createdAt: true, seenAt: true, supporter: { select: { name: true } } },
    }),
  ])
  after(() => prisma.supporterCheer.updateMany({ where: { seenAt: null, supporter: { candidateId: profile.id } }, data: { seenAt: new Date() } }))

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">My supporters</h1>
        <p className="max-w-2xl text-muted-foreground">
          People do better with someone in their corner. Invite a friend, family member or coach. They get one short note a week about your effort, in numbers only, and can send you a cheer. They never see names, companies or messages, and you can remove them any time.
        </p>
      </div>

      {profile.confidentialSearchMode && (
        <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
          Confidential mode is on, so nothing about your search can be shared with anyone outside NextChapter. Turn it off in Privacy to invite a supporter.
        </p>
      )}

      {cheers.length > 0 && (
        <section className="space-y-3" aria-labelledby="cheers">
          <h2 id="cheers" className="text-sm font-semibold">Cheers for you</h2>
          <ul className="space-y-2">
            {cheers.map((c) => (
              <li key={c.id} className="rounded-lg border border-border p-4 text-sm">
                <p>{c.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.supporter.name} · {c.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {supporters.length > 0 && (
        <section className="space-y-3" aria-labelledby="who">
          <h2 id="who" className="text-sm font-semibold">Your supporters</h2>
          <ul className="space-y-2">
            {supporters.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4 text-sm">
                <span>
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground"> · {s.email}</span>
                </span>
                <RemoveSupporterButton id={s.id} name={s.name} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {!profile.confidentialSearchMode && supporters.length < MAX_SUPPORTERS && (
        <section className="space-y-3" aria-labelledby="invite">
          <h2 id="invite" className="text-sm font-semibold">Invite a supporter</h2>
          <InviteSupporterForm />
        </section>
      )}
    </div>
  )
}
