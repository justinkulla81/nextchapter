import type { Metadata } from 'next'
import Link from 'next/link'
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

export default async function ContactDirectoryPage() {
  const profile = await getDashboardData()
  const [rawContacts, removedCount] = await Promise.all([
    prisma.supportNetworkContact.findMany({
      where: { candidateId: profile.id, removedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { outreachLogs: { orderBy: { loggedAt: 'desc' }, take: 1 } },
    }),
    prisma.supportNetworkContact.count({ where: { candidateId: profile.id, removedAt: { not: null } } }),
  ])
  const memberships = await lookupNextChapterMemberships(rawContacts.map((c) => c.email))
  const contacts = rawContacts.map((c) => ({
    ...c,
    hasReachedOut: c.outreachLogs.length > 0,
    lastOutreachChannel: c.outreachLogs[0]?.channel ?? null,
    membership: c.email ? (memberships.get(c.email.toLowerCase()) ?? null) : null,
  }))

  const networkScriptsGuide = GUIDES.find((g) => g.slug === 'network-scripts')
  const proTips = await getPageBoxContent(profile.id, 'network-contacts', 'WHY_IT_MATTERS')

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contact Directory</h1>
          <p className="mt-1 text-muted-foreground">
            Every contact you&apos;ve added, warmest first. Every outreach you log here counts toward
            the connecting signal in your Current Market Reality.
          </p>
        </div>
        {removedCount > 0 && (
          <Link
            href="/dashboard/network/contacts/removed"
            className="mt-1 shrink-0 text-sm font-medium text-primary underline underline-offset-4"
          >
            Removed contacts ({removedCount})
          </Link>
        )}
      </div>

      <WhyItMattersBox pageKey="network-contacts" content={proTips} />

      <ContactDirectoryTable contacts={contacts} />

      <Accordion>
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
