import { PreviewShell } from '@/components/candidate/PreviewShell'
import { PageHeader } from '@/components/candidate/PageHeader'
import { SectionPills } from '@/components/candidate/SectionPills'
import { Section } from '@/components/candidate/ui'
import { ShowMore } from '@/components/candidate/ShowMore'
import { TrackedAction } from '@/components/candidate/TrackedAction'
import { NetworkParts } from '@/components/network/NetworkParts'
import { ContactDirectory } from '@/components/network/ContactDirectory'
import { ContactDetails } from '@/components/network/ContactDetails'
import { ImportContacts } from '@/components/network/ImportContacts'
import { SuggestedContactsCard } from '@/components/dashboard/SuggestedContactsCard'
import { OutreachCoach } from '@/components/dashboard/OutreachCoach'
import { StarContactButton } from '@/components/dashboard/StarContactButton'
import type { ContactRowData } from '@/components/dashboard/ContactDetailPanel'
import { CommunityPostForm } from '@/components/dashboard/CommunityPostForm'
import { CommunityStreamItem } from '@/components/dashboard/CommunityStreamItem'
import { CommunityGroupStrip } from '@/components/dashboard/CommunityGroupStrip'
import { CommunityChips } from '@/components/dashboard/CommunityChips'
import { CommunityAutoJoinBanner } from '@/components/dashboard/CommunityAutoJoinBanner'
import { SendEncouragementForm } from '@/components/dashboard/SendEncouragementForm'
import { ThreadList } from '@/components/community/ThreadList'
import { MessageBubbles } from '@/components/messaging/MessageBubbles'
import { PeerThreadSafetyControls } from '@/components/messaging/PeerThreadSafetyControls'
import { CoachPreferencesForm, CoachShortlistRedesign } from '@/components/coaching/CoachMatchRedesign'
import { ConfidentialModeToggle } from '@/components/dashboard/ConfidentialModeToggle'
import { PrivacyTierSelector } from '@/components/candidates/PrivacyTierSelector'
import { RecruiterDatabaseOptIn } from '@/components/dashboard/RecruiterDatabaseOptIn'
import { ConnectedAccountsSettings } from '@/components/dashboard/ConnectedAccountsSettings'
import { NotificationTierSelector } from '@/components/candidates/NotificationTierSelector'
import { EmailTopicToggles } from '@/components/candidates/EmailTopicToggles'
import { ActionWindowField } from '@/components/dashboard/ActionWindowField'
import { ResumeBookOptIn } from '@/components/dashboard/ResumeBookOptIn'
import { MoreDetails } from '@/components/dashboard/MoreDetails'
import { ProfileHubRedesign } from '@/components/dashboard/ProfileHubRedesign'
import { BenefitsNetworkListingCard } from '@/components/dashboard/BenefitsNetworkListingCard'
import { BenefitsNetworkFilterBar } from '@/components/dashboard/BenefitsNetworkFilterBar'
import { CONTACT_SCOPES, DEFAULT_CONTACT_LIST } from '@/lib/redesign/network-account'
import type { SuggestedContact } from '@/lib/network/suggested-contacts'
import type { PostRowPost } from '@/components/community/PostRow'
import type { UnifiedStreamItem } from '@/lib/community/unified-feed'
import type { CoachShortlistEntry } from '@/lib/coach/matching'
import type { BenefitsNetworkListingWithAlum } from '@/lib/benefits-network/listings'

// The REAL redesigned Network and Account components, fed sample data, so the replaced old cards can be checked in a
// browser without signing in (docs/redesign-old-card-audit-network-account.md). Dev only: src/app/dev-preview is never
// reachable in production, and the buttons here change nothing.

const NOW = new Date('2026-10-20T15:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000)

function contact(o: Partial<ContactRowData> & { id: string; name: string }): ContactRowData {
  return {
    candidateId: 'me', email: `${o.name.split(' ')[0].toLowerCase()}@example.com`, emails: [], phone: null, linkedinUrl: null, title: null, company: null, inferredCompany: null, inferredSchool: null,
    notes: null, relationshipTags: [], customTags: [], warmth: 'WARM', isPriority: false, connectedAt: daysAgo(900), removedAt: null, createdAt: daysAgo(900),
    hasReachedOut: false, lastOutreachChannel: null, lastOutreachAt: null, outreachCount: 0, membership: null, isAtCurrentEmployer: false,
    ...o,
  } as unknown as ContactRowData
}

const CONTACTS: ContactRowData[] = [
  contact({ id: 'c1', name: 'Priya Shah', title: 'VP Operations', company: 'Northwind', isPriority: true, relationshipTags: ['FORMER_COLLEAGUE'], hasReachedOut: true, lastOutreachChannel: 'EMAIL', lastOutreachAt: daysAgo(40), outreachCount: 2 }),
  contact({ id: 'c2', name: 'Marcus Lee', title: 'Partner', company: 'Lee Search', relationshipTags: ['RECRUITER'], membership: 'RECRUITER' }),
  contact({ id: 'c3', name: 'Jordan Kim', title: 'Director of Finance', company: 'Meridian Group', isAtCurrentEmployer: true }),
  contact({ id: 'c4', name: 'Dana Ortiz', title: 'COO', company: 'Harbor Health', membership: 'COACH', relationshipTags: ['HELPING_ME'], hasReachedOut: true, lastOutreachChannel: 'LINKEDIN', lastOutreachAt: daysAgo(6), outreachCount: 1 }),
  contact({ id: 'c5', name: 'Sam Rivera', company: 'Ohio State University', relationshipTags: ['SAME_SCHOOL'] }),
]

const SUGGESTED = [
  { sourceKind: 'meeting', sourceId: 'm1', name: 'Alex Morgan', email: 'alex@northwind.com', inferredCompany: 'Northwind', connectedAt: daysAgo(3) },
  { sourceKind: 'email', sourceId: 'e1', name: 'Riley Chen', email: 'riley@harbor.example', inferredCompany: null, connectedAt: daysAgo(9) },
] as unknown as SuggestedContact[]

export function ContactsLive({ empty = false }: { empty?: boolean }) {
  return (
    <PreviewShell place="network" entry="circles" part="know">
      <PageHeader
        title="People you know"
        intro={empty ? 'Most jobs come through someone you already know. Add the people you know and we tell you who to write to first.' : '142 people you know. Most jobs come through someone like them, so each one is worth a note.'}
        action={
          empty ? (
            <TrackedAction variant="primary" href="#import" event="contacts_import_opened">Add people</TrackedAction>
          ) : (
            <TrackedAction variant="primary" href="/dashboard/network/this-week" event="this_week_opened">See who to write to first</TrackedAction>
          )
        }
      />
      <NetworkParts current="know" />
      {empty ? (
        <Section id="import-title" title="Add people from LinkedIn">
          <ImportContacts />
        </Section>
      ) : (
        <>
          <SuggestedContactsCard suggestions={SUGGESTED} redesign />
          <Section id="contacts-title" title="Your contacts">
            <ContactDirectory contacts={CONTACTS} totalCount={142} page={1} pageCount={3} state={{ ...DEFAULT_CONTACT_LIST }} />
          </Section>
          <ShowMore page="contacts" label="Import, templates and other lists">
            <SectionPills label="Which contacts" current="mine" items={CONTACT_SCOPES} />
          </ShowMore>
        </>
      )}
    </PreviewShell>
  )
}

export function ContactsFiltersLive() {
  return (
    <PreviewShell place="network" entry="circles" part="know">
      <PageHeader title="People you know" intro="142 people you know. Most jobs come through someone like them, so each one is worth a note." />
      <NetworkParts current="know" />
      <Section id="contacts-title" title="Your contacts">
        <ContactDirectory contacts={CONTACTS.slice(0, 2)} totalCount={2} page={1} pageCount={1} state={{ ...DEFAULT_CONTACT_LIST, email: 'has', nc: 'yes' }} />
      </Section>
    </PreviewShell>
  )
}

export function ContactDetailLive() {
  const c = CONTACTS[0]
  return (
    <PreviewShell place="network" entry="circles" part="know">
      <div className="mx-auto max-w-2xl space-y-8">
        <PageHeader title={c.name} intro="VP Operations at Northwind" action={<StarContactButton contactId={c.id} isPriority labeled />} />
        <OutreachCoach
          redesign
          contactId={c.id}
          contactName={c.name}
          contactEmail={c.email}
          contactCompany="Northwind"
          contactTitle="VP Operations"
          warmth="WARM"
          daysSinceLastContact={40}
          candidateFirstName="Justin"
          targetRole="Director of Operations"
          discreet={false}
        />
        <ShowMore page="contact_detail" label="Details and history" defaultOpen>
          <ContactDetails contact={c} membership={null} referenceHref="/dashboard/references" companyCardHref="/dashboard/companies/northwind" sharedCompany="Meridian Group" />
        </ShowMore>
      </div>
    </PreviewShell>
  )
}

const identity = (id: string, firstName: string, lastName: string) => ({ id, firstName, lastName, profilePictureUrl: null, confidentialSearchMode: false })

function post(o: Record<string, unknown> & { id: string; candidateId: string; description: string; candidate: ReturnType<typeof identity> }): PostRowPost {
  return {
    postType: 'UPDATE', title: null, externalUrl: null, imageUrl: null, postCity: null, postFunction: null, postIndustry: null,
    moderationStatus: 'PUBLISHED', moderationCategory: null, reportedAt: null, isActive: true, createdAt: daysAgo(1), reactions: [], _count: { reactions: 0 },
    ...o,
  } as unknown as PostRowPost
}

const STREAM: UnifiedStreamItem[] = [
  {
    kind: 'post', occurredAt: daysAgo(0.2),
    post: post({ id: 'p1', candidateId: 'u1', candidate: identity('u1', 'Maya', 'Patel'), postType: 'JOB', title: 'Finance director, Harbor Health', description: 'My old team is hiring a finance director. Happy to introduce anyone who has run a close at a company this size.', externalUrl: 'https://example.com/job', postCity: 'Boston', postFunction: 'Finance', postIndustry: 'Healthcare', _count: { reactions: 4 } }),
  },
  {
    kind: 'post', occurredAt: daysAgo(0.5),
    post: post({ id: 'p2', candidateId: 'me', candidate: identity('me', 'Justin', 'Kulla'), description: 'Week three of the search. Two conversations this week, both from people I had not written to in years.', postCity: 'New York', moderationStatus: 'HELD' }),
  },
  {
    kind: 'feed', occurredAt: daysAgo(1),
    item: { id: 'f1', type: 'comeback', displayName: 'Leo T.', avatarUrl: null, detail: 'accepted an offer after 11 weeks of searching.', occurredAt: daysAgo(1) },
  },
  {
    kind: 'post', occurredAt: daysAgo(2),
    post: post({ id: 'p3', candidateId: 'u3', candidate: identity('u3', 'Chris', 'Ng'), postType: 'INTRO_OFFER', description: 'I can introduce you to two search firms that place operations leaders. Reply if that helps.', reactions: [{ id: 'r' }], _count: { reactions: 2 } }),
  },
]

export function CommunityLive() {
  return (
    <PreviewShell place="network" entry="circles" part="industry">
      <PageHeader title="Industry and function" intro="People in your field. Good for learning how others got hired, and for being found." />
      <NetworkParts current="industry" />
      <div className="space-y-8">
        <CommunityAutoJoinBanner redesign notices={[{ membershipId: 'm1', label: 'Boston' }, { membershipId: 'm2', label: 'Finance' }]} />
        <Section id="post" title="Post to the community">
          <CommunityPostForm redesign />
        </Section>
        <Section id="feed" title="From your field">
          <div className="divide-y divide-border rounded-2xl border border-border">
            {STREAM.map((item) => (
              <CommunityStreamItem redesign key={item.kind === 'post' ? item.post.id : item.item.id} item={item} candidateId="me" />
            ))}
          </div>
        </Section>
        <ShowMore page="community" label="Filter by group, cohort, rankings and encouragement" defaultOpen>
          <Section id="filters" title="Filter by group">
            <div className="space-y-5">
              <CommunityGroupStrip
                redesign
                otherParams={{}}
                groups={[
                  { dimension: 'metro', value: 'boston', label: 'Boston', memberCount: 312 },
                  { dimension: 'function', value: 'finance', label: 'Finance', memberCount: 1204 },
                ] as never}
              />
              <CommunityChips redesign communities={[{ membershipId: 'a', communityId: 'c1', label: 'Boston' }, { membershipId: 'b', communityId: 'c2', label: 'Finance' }]} activeCommunityId="c2" />
            </div>
          </Section>
          <Section id="encouragement" title="Send encouragement">
            <SendEncouragementForm redesign />
          </Section>
        </ShowMore>
      </div>
    </PreviewShell>
  )
}

export function MessagesLive() {
  return (
    <PreviewShell place="network" entry="messages">
      <PageHeader title="Messages" intro="Everything from people in your network and your groups, in one place." />
      <SectionPills
        label="Who you are messaging"
        current="coaches"
        items={[
          { key: 'peers', label: 'Peers', href: '#' },
          { key: 'coaches', label: 'Coaches (1 new)', href: '#' },
          { key: 'recruiters', label: 'Recruiters', href: '#' },
          { key: 'hiring-managers', label: 'Hiring managers', href: '#' },
        ]}
      />
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        <ThreadList
          label="Conversations with coaches"
          emptyText="No conversations yet."
          activeId="t1"
          threads={[
            { id: 't1', name: 'Dana Ortiz', unread: true, kind: 'Coach', href: '#' },
            { id: 't2', name: 'Priya Shah', unread: false, kind: 'Coach', href: '#' },
          ]}
        />
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-ink">Dana Ortiz</h2>
            <PeerThreadSafetyControls threadId="t1" otherCandidateId={null} isBlocked={false} isReported={false} redesign />
          </div>
          <div className="rounded-2xl border border-border">
            <MessageBubbles
              redesign
              selfRole="CANDIDATE"
              partnerName="Dana Ortiz"
              messages={[
                { id: 'm1', senderRole: 'COACH', body: 'Great work on the intro note. Send it to Priya tomorrow morning.', createdAt: daysAgo(1) },
                { id: 'm2', senderRole: 'CANDIDATE', body: 'Will do. Should I mention the Northwind role?', createdAt: daysAgo(0.5) },
              ] as never}
            />
          </div>
        </div>
      </div>
    </PreviewShell>
  )
}

const SHORTLIST: CoachShortlistEntry[] = [
  { id: 'k1', fullName: 'Dana Ortiz', firmName: 'Ortiz Coaching', focus: 'Executive transitions', industries: ['Healthcare', 'Logistics'], seniorityFit: [], certifications: [], reasons: ['Has coached six operations leaders into director roles.', 'Pushes you the way you said you like.', 'Works in your time zone.'], collegeName: 'Ohio State' },
  { id: 'k2', fullName: 'Marcus Lee', firmName: null, focus: 'Search strategy', industries: ['Finance'], seniorityFit: [], certifications: [], reasons: ['Holds you accountable week to week.'], collegeName: null },
]

export function CoachMatchLive({ step = 'prefs' }: { step?: 'prefs' | 'shortlist' }) {
  return (
    <PreviewShell place="network" entry="circles" part="close">
      <div className="max-w-2xl space-y-8">
        {step === 'prefs' ? (
          <>
            <PageHeader title="Get matched with a coach" intro="A few quick preferences help us suggest coaches who work the way you like. Everything here is optional, so skip anything you have no preference on." />
            <CoachPreferencesForm gender="" feedbackStyle="direct" language="English" timezone="ET" savedRatings={{ 'push-1': 4, 'support-1': 2 }} />
          </>
        ) : (
          <>
            <PageHeader title="Your coach matches" intro="Chosen for your target role, your level and your preferences. Each one says why." />
            <CoachShortlistRedesign shortlist={SHORTLIST} />
          </>
        )}
      </div>
    </PreviewShell>
  )
}

export function PrivacyLive() {
  return (
    <PreviewShell place="account" entry="visibility">
      <PageHeader title="Account and privacy" intro="You decide who can see your search and what we can read. Each choice says what it changes, and you can change it any time." />
      <Section id="who-can-see" title="Who can see your search">
        <div className="space-y-8">
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-ink">Confidential Search Mode</h3>
            <p className="max-w-xl text-sm text-muted-foreground">This decides whether anyone outside NextChapter can see your search at all: the community, LinkedIn, outreach, email, Gmail and recruiter sharing.</p>
            <ConfidentialModeToggle enabled={false} redesign />
          </div>
          <PrivacyTierSelector currentTier="SEMI_PUBLIC" alreadyAwarded={false} redesign />
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-ink">Employers and recruiters</h3>
            <p className="max-w-xl text-sm text-muted-foreground">Whether employers using NextChapter&apos;s hiring tools can match you against open roles at all. It is separate from the visibility above.</p>
            <RecruiterDatabaseOptIn optedIn dossierUnlocked={false} dossierReason="You are 2 steps from Candidate+." redesign />
          </div>
        </div>
      </Section>
      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">What we can read</h2>
        <p className="max-w-xl text-base text-muted-foreground">Choose what NextChapter reads to count your search activity for you.</p>
        <ConnectedAccountsSettings
          redesign
          gmail={{ status: 'expired', account: 'justin@example.com', lastChecked: 'Oct 12, 9:14 AM' }}
          calendar={{ status: 'connected', account: 'justin@example.com', lastChecked: 'Oct 12, 9:14 AM' }}
          connectHref="#"
        />
      </section>
      <MoreDetails summary="Show more: your situation, email, coach access, your data and your account">
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-ink">Résumé Book</h2>
            <p className="max-w-xl text-base text-muted-foreground">On by default, and switched on the first time you upload a résumé. It does not depend on your dossier. Turn it off any time.</p>
            <ResumeBookOptIn optedIn redesign />
          </section>
          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold text-ink">Email</h2>
            <p className="max-w-xl text-base text-muted-foreground">How often you hear from us, and which emails. Your Market Reality Report and any reminder emails always send.</p>
            <div className="space-y-8">
              <NotificationTierSelector currentTier="FULL" redesign />
              <EmailTopicToggles redesign optedOut={{ weeklyReportOptedOut: false, marketDigestOptedOut: true, dailyEmailOptedOut: false, jobSearchDailyOptedOut: false }} />
              <ActionWindowField current="MORNING" />
            </div>
          </section>
        </div>
      </MoreDetails>
    </PreviewShell>
  )
}

export function ProfileLive() {
  return (
    <PreviewShell place="account" entry="profile">
      <ProfileHubRedesign
        parts={[
          { href: '/dashboard/profile/personal', title: 'Personal information', description: 'Basics, education, industry, function & experience, salary, LinkedIn, and photo.', allDone: false, completedAt: null },
          { href: '/dashboard/profile/screening', title: 'Screening Questions', description: 'Work authorization, drug test/background check willingness, deal-breakers, and demographics.', allDone: true, completedAt: daysAgo(30) },
        ]}
        resume={{ uploadedAt: daysAgo(12) }}
        resumeWhy="You have résumé feedback you have not acted on yet. Updating it is the quickest way to improve your matches."
        percentComplete={67}
        hasChecklist
        firstIncompleteTitle="personal information"
        next={{ href: '/dashboard/profile/personal', label: 'Finish personal information', key: '/dashboard/profile/personal' }}
        publicProfileHref="/dashboard/contacts/members/justin"
      />
    </PreviewShell>
  )
}

const LISTING = {
  id: 'l1', programName: 'Executive certificate in healthcare finance', institutionName: 'Ohio State University', discountDescription: '25% off tuition for NextChapter members.',
  description: 'A twelve week program for finance leaders moving into healthcare.', fullCostNote: '$4,800 list price, $3,600 with the discount. Books are extra.',
  function: 'Finance', level: 'Director', format: 'Live cohort', costType: 'Discounted', timeCommitment: '5-20 hours', credentialType: 'Certificate', seatCount: 12,
  institutionDomain: 'osu.edu', avgRating: 4.5, _count: { ratings: 8 }, redemptionMethod: 'CODE', redemptionValue: 'NEXT25', redemptionInstructions: 'Enter at checkout.', alum: { firstName: 'Priya', lastName: 'Shah' },
} as unknown as BenefitsNetworkListingWithAlum

export function BenefitsNetworkLive() {
  return (
    <PreviewShell place="account" entry="membership">
      <PageHeader title="Higher education benefits network" intro="Discounts and programs for NextChapter members, brought in by alumni who know the university, program or certification body." />
      <BenefitsNetworkFilterBar redesign current={{ costType: 'Discounted' }} />
      <div className="grid gap-4 sm:grid-cols-2">
        <BenefitsNetworkListingCard redesign listing={LISTING} isRedeemed={false} isMember matchedSkillGap="healthcare finance" />
        <BenefitsNetworkListingCard redesign listing={{ ...LISTING, id: 'l2', programName: 'Board readiness course' } as BenefitsNetworkListingWithAlum} isRedeemed={false} isMember={false} matchedSkillGap={null} />
      </div>
    </PreviewShell>
  )
}
