import type { Metadata } from 'next'
import { after } from 'next/server'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { MAX_SUPPORTERS } from '@/lib/supporters/supporters'
import { InviteSupporterForm, RemoveSupporterButton } from './SupporterForms'
import { supportersIntro } from '@/lib/redesign/network-pages'
import { captureServerEvent } from '@/lib/posthog/server'
import { PageHeader } from '@/components/candidate/PageHeader'
import { Section } from '@/components/candidate/ui'
import { ListRow, RowList } from '@/components/candidate/ListRow'
import { TrackedAction } from '@/components/candidate/TrackedAction'
import { NetworkParts } from '@/components/network/NetworkParts'
import { loadPartnership, pendingInviteFor } from '@/lib/partner-search/partner'
import { getVerifiedSessionUser } from '@/lib/dashboard/get-dashboard-data'
import { AcceptInviteCard } from '@/app/dashboard/move-plan/MovePlanForms'
import { InvitePartnerForm, PartnerCard } from './PartnerForms'

export const metadata: Metadata = { title: 'My supporters' }

// Someone to keep you going. They get one short weekly note about your effort
// (never names, companies or messages) and can send you a cheer.
export default async function SupportersPage() {
  const profile = await getDashboardProfile()
  const user = await getVerifiedSessionUser()
  const [partnership, partnerInvite] = await Promise.all([loadPartnership(profile.id), user?.email_confirmed_at ? pendingInviteFor(user.email) : Promise.resolve(null)])
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
      {partnerInvite && partnership?.role !== 'partner' && !partnership && <AcceptInviteCard linkId={partnerInvite.id} ownerName={partnerInvite.ownerFirstName ?? 'Your partner'} />}
      <div id="partner" className="scroll-mt-4">
        {partnership ? (
          <Section id="partner-title" title="Your partner">
            <PartnerCard
              role={partnership.role}
              linkId={partnership.link.id}
              name={partnership.role === 'owner' ? partnership.link.partnerName : partnership.ownerFirstName ?? 'Your partner'}
              joined={partnership.link.joined}
              sharePlaces={partnership.link.sharePlaces}
              shareJobsPay={partnership.link.shareJobsPay}
            />
          </Section>
        ) : canInvite ? (
          <Section id="partner-title" title="Invite your partner">
            <p className="max-w-xl text-sm text-muted-foreground">Search together, especially if you may move. Your partner gets their own free account and their own search, and sees the places you are comparing. Your applications, contacts, notes and messages stay private.</p>
            <InvitePartnerForm />
          </Section>
        ) : null}
      </div>
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
            <InviteSupporterForm />
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
