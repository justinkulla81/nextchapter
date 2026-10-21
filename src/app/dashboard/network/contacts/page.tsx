import type { Metadata } from 'next'
import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { NextChapterMembersSection } from '@/components/dashboard/NextChapterMembersSection'
import { lookupNextChapterMemberships } from '@/lib/network/member-lookup'
import { CopyableTemplateCard } from '@/components/dashboard/CopyableTemplateCard'
import { GuideCard } from '@/components/dashboard/GuideCard'
import { fillHelpScriptTemplate } from '@/lib/constants/help-script-template'
import { GUIDES } from '@/lib/constants/guides'
import { markAskedForHelp } from '@/app/dashboard/actions'
import {
  fillIntroRequestTemplate,
  fillGoodWordTemplate,
  fillCheckingInTemplate,
} from '@/lib/constants/network-email-templates'
import { getSuggestedContactsToAdd } from '@/lib/network/suggested-contacts'
import { SuggestedContactsCard } from '@/components/dashboard/SuggestedContactsCard'
import { PRIORITY_CONTACT_TARGET_COUNT } from '@/lib/network/priority-contacts'
import { isSuppressed, loadSuppression } from '@/lib/network/suppressed-senders'
import { getCurrentEmployerName, companyMatchesCurrentEmployer } from '@/lib/network/current-employer-flag'
import { ConfidentialModeIndicator } from '@/components/dashboard/ConfidentialModeIndicator'
import { contactsIntro } from '@/lib/redesign/network-pages'
import { captureServerEvent } from '@/lib/posthog/server'
import { PageHeader } from '@/components/candidate/PageHeader'
import { TrackedAction } from '@/components/candidate/TrackedAction'
import { ShowMore } from '@/components/candidate/ShowMore'
import { NetworkParts } from '@/components/network/NetworkParts'
import { ContactDirectory } from '@/components/network/ContactDirectory'
import { ImportContacts } from '@/components/network/ImportContacts'
import { SectionPills } from '@/components/candidate/SectionPills'
import { Section } from '@/components/candidate/ui'
import { CONTACT_SCOPES } from '@/lib/redesign/network-account'

export const metadata: Metadata = { title: 'Contact Directory' }

const PAGE_SIZE = 50
const SORT_KEYS = ['name', 'company', 'date', 'priority'] as const
export type ContactSortKey = (typeof SORT_KEYS)[number]

export default async function ContactDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const [sp, profile] = await Promise.all([searchParams, getDashboardProfile()])

  const scope: 'mine' | 'nextchapter' | 'all' =
    sp.scope === 'nextchapter' || sp.scope === 'all' ? sp.scope : 'mine'

  // Scope=nextchapter skips every SupportNetworkContact query entirely
  // rather than fetching-and-hiding — this candidate's SupportNetworkContact
  // table can be 27,000+ rows (a real LinkedIn export, see the perf
  // comment below), and browsing NextChapter members shouldn't pay that
  // cost just because it happens to share a page with the contact
  // directory. scope=all still pays it (it genuinely needs both lists).
  if (scope === 'nextchapter') {
    return (
      <div className="space-y-8">
        <PageHeader title="People you know" intro="Other members of NextChapter you can meet. Each one is a warm way in." />
        <NetworkParts current="know" />
        <SectionPills label="Which contacts" current={scope} items={CONTACT_SCOPES} />
        <NextChapterMembersSection
          viewerCandidateId={profile.id}
          query={typeof sp.mq === 'string' ? sp.mq.trim() : ''}
          page={Math.max(1, Number(sp.mpage) || 1)}
        />
      </div>
    )
  }

  const q = typeof sp.q === 'string' ? sp.q.trim() : ''
  const sortKey: ContactSortKey = (SORT_KEYS as readonly string[]).includes(sp.sort as string)
    ? (sp.sort as ContactSortKey)
    : 'name'
  const dir: 'asc' | 'desc' = sp.dir === 'desc' ? 'desc' : 'asc'
  const pin = sp.pin !== '0'
  const emailFilter: 'all' | 'has' | 'missing' = sp.email === 'has' || sp.email === 'missing' ? sp.email : 'all'
  const reachedFilter: 'all' | 'yes' | 'no' = sp.reached === 'yes' || sp.reached === 'no' ? sp.reached : 'all'
  const relFilter: 'all' | 'yes' | 'no' = sp.rel === 'yes' || sp.rel === 'no' ? sp.rel : 'all'
  const ncFilter: 'all' | 'yes' | 'no' = sp.nc === 'yes' || sp.nc === 'no' ? sp.nc : 'all'
  const page = Math.max(1, Number(sp.page) || 1)

  // Deliberately filtered/sorted/paginated at the DB level, not fetched in
  // full and sliced in the browser — this candidate has 27,000+ contacts
  // (a real LinkedIn export), and shipping every row to the client on every
  // page visit was the actual cause of "this page is slow", not the DB
  // query itself (which runs in well under 50ms even unindexed at this
  // scale — confirmed via EXPLAIN ANALYZE). Only relationship/reached-out/
  // membership stay display-only (not sortable) since they're derived from
  // a relation or an external lookup rather than a plain column.
  const where: Prisma.SupportNetworkContactWhereInput = {
    candidateId: profile.id,
    removedAt: null,
  }
  if (emailFilter === 'has') where.email = { not: null }
  if (emailFilter === 'missing') where.email = null
  if (reachedFilter === 'yes') where.outreachLogs = { some: {} }
  if (reachedFilter === 'no') where.outreachLogs = { none: {} }
  if (relFilter === 'yes') where.relationshipTags = { isEmpty: false }
  if (relFilter === 'no') where.relationshipTags = { isEmpty: true }

  // AND-ed together (rather than assigned to where.OR/where.email directly)
  // so the free-text search and the "On NextChapter" membership check can
  // both contribute their own OR clauses without clobbering each other.
  const andConditions: Prisma.SupportNetworkContactWhereInput[] = []
  if (q) {
    andConditions.push({
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { company: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    })
  }

  // "On NextChapter" can't be a plain column filter — membership is
  // resolved by looking emails up against candidate/coach/recruiter/
  // employer accounts (see lookupNextChapterMemberships), not stored on
  // the contact row. Resolve it up front against every email that matches
  // the filters so far, then fold the result back in as an email-in-set
  // filter before paginating — otherwise "on NextChapter" could only ever
  // filter the 50 rows already on the current page.
  if (ncFilter !== 'all') {
    const candidateEmails = await prisma.supportNetworkContact.findMany({
      where: { ...where, AND: andConditions, email: { not: null } },
      select: { email: true },
    })
    const memberships = await lookupNextChapterMemberships(candidateEmails.map((c) => c.email))
    const memberEmails = [...memberships.keys()]
    if (ncFilter === 'yes') {
      andConditions.push({ email: { in: memberEmails, mode: 'insensitive' } })
    } else {
      andConditions.push({ OR: [{ email: null }, { email: { notIn: memberEmails, mode: 'insensitive' } }] })
    }
  }
  if (andConditions.length > 0) where.AND = andConditions

  const orderBy: Prisma.SupportNetworkContactOrderByWithRelationInput[] = []
  if (pin) orderBy.push({ isPriority: 'desc' })
  if (sortKey === 'priority') orderBy.push({ isPriority: dir })
  else if (sortKey === 'date') orderBy.push({ connectedAt: dir }, { createdAt: dir })
  else orderBy.push({ [sortKey]: dir })

  const [totalCount, removedCount, rawContacts, starredCount, suggestions, hasAnyContacts] = await Promise.all([
    prisma.supportNetworkContact.count({ where }),
    prisma.supportNetworkContact.count({ where: { candidateId: profile.id, removedAt: { not: null } } }),
    prisma.supportNetworkContact.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        outreachLogs: { orderBy: { loggedAt: 'desc' }, take: 1 },
        _count: { select: { outreachLogs: true } },
      },
    }),
    prisma.supportNetworkContact.count({ where: { candidateId: profile.id, priorityPointsAwardedAt: { not: null } } }),
    getSuggestedContactsToAdd(profile.id),
    // Unfiltered — distinct from totalCount (which reflects the current
    // search/filter) so the search bar and filter row can hide entirely
    // when the candidate genuinely has zero contacts, instead of just
    // zero matches for their current filter.
    prisma.supportNetworkContact.count({ where: { candidateId: profile.id, removedAt: null } }).then((c) => c > 0),
  ])
  const [memberships, currentEmployerName] = await Promise.all([
    // Only looked up for the ~50 contacts on the current page, not the whole
    // list — this used to run against all 27,000+ emails at once.
    lookupNextChapterMemberships(rawContacts.map((c) => c.email)),
    // §4.4 — only fetched (and only ever true) for Confidential Search Mode
    // candidates, so this is free for everyone else.
    profile.confidentialSearchMode ? getCurrentEmployerName(profile.id) : Promise.resolve(null),
  ])
  const suppression = await loadSuppression(profile.id)
  const contacts = rawContacts.map((c) => ({
    ...c,
    hasReachedOut: c.outreachLogs.length > 0,
    lastOutreachChannel: c.outreachLogs[0]?.channel ?? null,
    lastOutreachAt: c.outreachLogs[0]?.loggedAt ?? null,
    outreachCount: c._count.outreachLogs,
    membership: c.email ? (memberships.get(c.email.toLowerCase()) ?? null) : null,
    isAtCurrentEmployer:
      companyMatchesCurrentEmployer(currentEmployerName, c.company) ||
      companyMatchesCurrentEmployer(currentEmployerName, c.inferredCompany),
  }))
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const networkScriptsGuide = GUIDES.find((g) => g.slug === 'network-scripts')

  // The redesign (docs/candidate-redesign.md): People you know. One primary action, the directory and who to add
  // on the first view; importing, templates, the other lists and the tidy-up pages sit behind Show more.
  captureServerEvent(profile.id, 'contacts_viewed', { total: totalCount, hasAnyContacts, suggestions: suggestions.length, starred: starredCount })
  return (
    <div className="space-y-8">
      <PageHeader
        title="People you know"
        intro={contactsIntro(totalCount)}
        action={
          hasAnyContacts ? (
            <TrackedAction variant="primary" href="/dashboard/network/this-week" event="this_week_opened" properties={{ source: 'contacts_primary' }}>
              See who to write to first
            </TrackedAction>
          ) : (
            <TrackedAction variant="primary" href="/dashboard/network/contacts?buildList=1#import" event="contacts_import_opened" properties={{ source: 'contacts_primary' }}>
              Add people
            </TrackedAction>
          )
        }
      />
      <NetworkParts current="know" />
      {profile.confidentialSearchMode && <ConfidentialModeIndicator redesign />}
      {!hasAnyContacts && (
        <Section id="import-title" title="Add people from LinkedIn">
          <ImportContacts />
        </Section>
      )}
      <SuggestedContactsCard suggestions={suggestions} />
      {hasAnyContacts && (
        <Section id="contacts-title" title="Your contacts">
          <ContactDirectory
            contacts={contacts}
            totalCount={totalCount}
            page={Math.min(page, pageCount)}
            pageCount={pageCount}
            pageSize={PAGE_SIZE}
            state={{ q, sort: sortKey, dir, pin, email: emailFilter, reached: reachedFilter, rel: relFilter, nc: ncFilter, page: Math.min(page, pageCount) }}
            hasAnyContacts={hasAnyContacts}
            mutedIds={contacts.filter((c) => [c.email, ...c.emails].some((e) => isSuppressed(suppression, e))).map((c) => c.id)}
          />
        </Section>
      )}
      <ShowMore page="contacts" label="Import, templates and other lists" defaultOpen={Boolean(sp.buildList) || scope === 'all'}>
        {hasAnyContacts && starredCount < PRIORITY_CONTACT_TARGET_COUNT && (
          <p className="text-base text-ink">
            {`Star ${PRIORITY_CONTACT_TARGET_COUNT} people and they rise to the top of your list, so the ones you most want to write to are always first. You have starred ${starredCount} so far.`}
          </p>
        )}
        <SectionPills label="Which contacts" current={scope} items={CONTACT_SCOPES} />
        {hasAnyContacts && (
          <Section id="import-more-title" title="Add people from LinkedIn">
            <ImportContacts />
          </Section>
        )}
        {scope === 'all' && (
          <NextChapterMembersSection
            viewerCandidateId={profile.id}
            query={typeof sp.mq === 'string' ? sp.mq.trim() : ''}
            page={Math.max(1, Number(sp.mpage) || 1)}
          />
        )}
        <Section id="scripts-title" title="Scripts and templates">
          <div className="space-y-4">
            {networkScriptsGuide && <GuideCard guide={networkScriptsGuide} redesign />}
            <CopyableTemplateCard title="Ask someone for help" description="Pick one person from your list and send this." template={fillHelpScriptTemplate(profile)} templateType="ask_for_help" outreach onCopy={markAskedForHelp} />
            <CopyableTemplateCard title="Asking for an intro" template={fillIntroRequestTemplate({ ...profile, discreet: profile.confidentialSearchMode })} templateType="intro_request" outreach />
            <CopyableTemplateCard title="Putting in a good word" template={fillGoodWordTemplate({ ...profile, discreet: profile.confidentialSearchMode })} templateType="good_word" outreach />
            <CopyableTemplateCard title="Checking in about interim work" template={fillCheckingInTemplate({ ...profile, discreet: profile.confidentialSearchMode })} templateType="checking_in" outreach />
          </div>
        </Section>
        <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <Link href="/dashboard/network/contacts/removed" className="font-medium text-brand underline underline-offset-4">
            Removed contacts{removedCount > 0 ? ` (${removedCount})` : ''}
          </Link>
          <Link href="/dashboard/network/blocked-senders" className="font-medium text-brand underline underline-offset-4">
            Blocked senders
          </Link>
        </p>
      </ShowMore>
    </div>
  )
}
