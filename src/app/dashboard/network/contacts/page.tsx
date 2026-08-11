import type { Metadata } from 'next'
import type { Prisma } from '@prisma/client'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { getPageBoxContent } from '@/lib/dashboard/page-content'
import { WhyItMattersBox } from '@/components/dashboard/WhyItMattersBox'
import { ContactDirectoryTable } from '@/components/dashboard/ContactDirectoryTable'
import { lookupNextChapterMemberships } from '@/lib/network/member-lookup'
import { CsvImportForm } from '@/components/dashboard/CsvImportForm'
import { CopyableTemplateCard } from '@/components/dashboard/CopyableTemplateCard'
import { GuideCard } from '@/components/dashboard/GuideCard'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { fillHelpScriptTemplate } from '@/lib/constants/help-script-template'
import { NETWORK_CSV_AI_PROMPT_TEMPLATE } from '@/lib/constants/network-ai-prompt-template'
import { GUIDES } from '@/lib/constants/guides'
import { markAskedForHelp } from '@/app/dashboard/actions'
import {
  fillIntroRequestTemplate,
  fillGoodWordTemplate,
  fillCheckingInTemplate,
} from '@/lib/constants/network-email-templates'
export const metadata: Metadata = { title: 'Contact Directory' }

const PAGE_SIZE = 50
const SORT_KEYS = ['name', 'company', 'date', 'priority'] as const
export type ContactSortKey = (typeof SORT_KEYS)[number]

export default async function ContactDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams
  const profile = await getDashboardData()

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

  const [totalCount, removedCount, rawContacts] = await Promise.all([
    prisma.supportNetworkContact.count({ where }),
    prisma.supportNetworkContact.count({ where: { candidateId: profile.id, removedAt: { not: null } } }),
    prisma.supportNetworkContact.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { outreachLogs: { orderBy: { loggedAt: 'desc' }, take: 1 } },
    }),
  ])
  // Only looked up for the ~50 contacts on the current page, not the whole
  // list — this used to run against all 27,000+ emails at once.
  const memberships = await lookupNextChapterMemberships(rawContacts.map((c) => c.email))
  const contacts = rawContacts.map((c) => ({
    ...c,
    hasReachedOut: c.outreachLogs.length > 0,
    lastOutreachChannel: c.outreachLogs[0]?.channel ?? null,
    membership: c.email ? (memberships.get(c.email.toLowerCase()) ?? null) : null,
  }))
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const networkScriptsGuide = GUIDES.find((g) => g.slug === 'network-scripts')
  const proTips = await getPageBoxContent(profile.id, 'network-contacts', 'WHY_IT_MATTERS')

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Contact Directory</h1>

      <WhyItMattersBox pageKey="network-contacts" content={proTips} />

      <ContactDirectoryTable
        contacts={contacts}
        totalCount={totalCount}
        removedCount={removedCount}
        page={Math.min(page, pageCount)}
        pageCount={pageCount}
        query={q}
        sortKey={sortKey}
        dir={dir}
        pin={pin}
        emailFilter={emailFilter}
        reachedFilter={reachedFilter}
        relFilter={relFilter}
        ncFilter={ncFilter}
      />

      {/* Deep-linked from the "Build Your Networking List" button on the
          Network page (?buildList=1#import) — opens straight to the import
          form instead of landing on a collapsed accordion item. */}
      <Accordion defaultValue={sp.buildList ? ['build-list'] : []}>
        <AccordionItem value="build-list">
          <AccordionTrigger>Build your list from LinkedIn</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div id="import" className="space-y-3 rounded-lg border border-border p-4">
                <h3 className="text-sm font-medium text-foreground">Import your LinkedIn connections</h3>
                <CsvImportForm />
                <p className="text-xs text-muted-foreground">
                  What happens: safe to re-upload anytime. New people are added, and any blank
                  fields on people already on your list get filled in. Anyone you&apos;ve removed
                  stays removed.
                </p>
              </div>

              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-primary underline underline-offset-4">
                  Need to export your connections first? See the step-by-step instructions.
                </summary>
                {/* Steps 1-2 are one workflow: export → clean up → (import above). The
                    connecting line + numbered circles below are the only thing that
                    changed visually from two separate cards — same components, wrapped
                    in a positioned container so the "why" captions and connector read
                    as one continuous task. */}
                <div className="relative mt-4 space-y-6 border-l-2 border-border pl-6">
                  <div className="relative">
                    <span className="absolute -left-[1.85rem] flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
                      1
                    </span>
                    <div className="space-y-2 rounded-lg border border-border p-4">
                      <h3 className="text-sm font-medium text-foreground">Export your LinkedIn connections</h3>
                      <p className="text-sm text-muted-foreground">
                        Settings &amp; Privacy → Data Privacy → Get a copy of your data → Connections →
                        Request archive. LinkedIn emails you a download link within 10-24 minutes.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Why: this pulls in everyone you&apos;re connected to at once, instead of adding
                        people one at a time.
                      </p>
                    </div>
                  </div>

                  <div className="relative">
                    <span className="absolute -left-[1.85rem] flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
                      2
                    </span>
                    <CopyableTemplateCard
                      title="Clean it up with AI (optional but worth it)"
                      description="Paste your exported CSV into ChatGPT or Claude with this prompt to get it cleaned up and prioritized before you import it above."
                      template={NETWORK_CSV_AI_PROMPT_TEMPLATE}
                      templateType="csv_cleanup_prompt"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Why: your export includes everyone you&apos;ve ever connected with — this step
                      surfaces the people actually worth reaching out to first.
                    </p>
                  </div>
                </div>
              </details>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="scripts">
          <AccordionTrigger>Scripts &amp; templates</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              {networkScriptsGuide && <GuideCard guide={networkScriptsGuide} />}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">Ready-to-send templates</h3>
                <div className="space-y-3">
                  <CopyableTemplateCard
                    title="Ask someone for help"
                    description="Pick one person from your list above and send this."
                    template={fillHelpScriptTemplate(profile)}
                    templateType="ask_for_help"
                    onCopy={markAskedForHelp}
                  />
                  <CopyableTemplateCard
                    title="Asking for an intro"
                    template={fillIntroRequestTemplate(profile)}
                    templateType="intro_request"
                  />
                  <CopyableTemplateCard
                    title="Putting in a good word"
                    template={fillGoodWordTemplate(profile)}
                    templateType="good_word"
                  />
                  <CopyableTemplateCard
                    title="Checking in about interim work"
                    template={fillCheckingInTemplate(profile)}
                    templateType="checking_in"
                  />
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
