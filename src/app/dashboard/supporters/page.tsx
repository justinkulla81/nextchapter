import type { Metadata } from 'next'
import { after } from 'next/server'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { MAX_SUPPORTERS } from '@/lib/supporters/supporters'
import { InviteSupporterForm, RemoveSupporterButton } from './SupporterForms'
import { isRedesignOn } from '@/lib/redesign/flag'
import { supportersIntro } from '@/lib/redesign/network-pages'
import { captureServerEvent } from '@/lib/posthog/server'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Section } from '@/components/candidate/ui'
import { ListRow, RowList } from '@/components/candidate/ListRow'
import { TrackedAction } from '@/components/candidate/TrackedAction'
import { NetworkParts } from '@/components/network/NetworkParts'

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

  // The redesign (docs/candidate-redesign.md): one headline, one primary action (invite), who is in your corner.
  if (isRedesignOn(profile.email)) {
    const canInvite = !profile.confidentialSearchMode && supporters.length < MAX_SUPPORTERS
    captureServerEvent(profile.id, 'supporters_viewed', { supporters: supporters.length, cheers: cheers.length, canInvite })
    return (
      <div className="space-y-8">
        <PageHeader
          title="Your people"
          intro={supportersIntro(supporters.length)}
          action={
            canInvite ? (
              <TrackedAction variant="primary" href="#invite" event="supporter_invite_started" properties={{ source: 'supporters_primary', supporters: supporters.length }}>
                Invite someone
              </TrackedAction>
            ) : undefined
          }
        />
        <NetworkParts current="close" />
        {profile.confidentialSearchMode && (
          <p className="text-base text-ink">
            Confidential mode is on, so nothing about your search is shared outside NextChapter. Turn it off in{' '}
            <TrackedAction variant="text" href="/dashboard/privacy" event="privacy_opened" properties={{ source: 'supporters_confidential' }}>
              privacy settings
            </TrackedAction>{' '}
            when you want to invite someone.
          </p>
        )}
        {cheers.length > 0 && (
          <Section id="cheers" title="Cheers for you">
            <RowList label="Cheers for you">
              {cheers.map((c) => (
                <ListRow
                  key={c.id}
                  name={c.supporter.name}
                  title={c.message}
                  fact={`${c.supporter.name} · ${c.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                />
              ))}
            </RowList>
          </Section>
        )}
        {supporters.length > 0 && (
          <Section id="who" title="In your corner">
            <RowList label="Your supporters">
              {supporters.map((s) => (
                <ListRow key={s.id} name={s.name} title={s.name} fact={s.email} actions={<RemoveSupporterButton id={s.id} name={s.name} />} />
              ))}
            </RowList>
          </Section>
        )}
        {canInvite && (
          <div id="invite" className="scroll-mt-4">
            <Section id="invite-title" title="Invite someone">
              <p className="max-w-xl text-sm text-muted-foreground">
                They get one short note a week about your effort, in numbers only, and can send you a cheer. They never see names, companies or messages, and you can remove them any time.
              </p>
              <InviteSupporterForm redesign />
            </Section>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          A coach is part of your close circle too.{' '}
          <TrackedAction variant="text" href="/dashboard/my-coaching" event="coaching_opened" properties={{ source: 'supporters' }}>
            See coaching
          </TrackedAction>
        </p>
      </div>
    )
  }

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
