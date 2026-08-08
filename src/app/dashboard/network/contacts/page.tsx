import type { Metadata } from 'next'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { ContactRow } from '@/components/dashboard/ContactRow'
import { CsvImportForm } from '@/components/dashboard/CsvImportForm'
import { CopyableTemplateCard } from '@/components/dashboard/CopyableTemplateCard'
import { OutreachCheatSheetCard } from '@/components/dashboard/OutreachCheatSheetCard'
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
import type { ContactWarmth } from '@prisma/client'

export const metadata: Metadata = { title: 'Contact Directory' }

const WARMTH_ORDER: ContactWarmth[] = ['HOT', 'WARM', 'COLD']

const WARMTH_LABEL: Record<ContactWarmth, string> = {
  HOT: 'Hot',
  WARM: 'Warm',
  COLD: 'Cold',
}

export default async function ContactDirectoryPage() {
  const profile = await getDashboardData()
  const contacts = await prisma.supportNetworkContact.findMany({
    where: { candidateId: profile.id },
    orderBy: { createdAt: 'desc' },
  })

  const networkScriptsGuide = GUIDES.find((g) => g.slug === 'network-scripts')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Contact Directory</h1>
        <p className="mt-1 text-muted-foreground">
          Every contact you&apos;ve added, warmest first. Every outreach you log here counts toward
          the connecting signal in your Current Market Reality.
        </p>
      </div>

      <div className="space-y-4">
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No contacts yet — import your LinkedIn connections below to get started.
          </p>
        ) : (
          WARMTH_ORDER.map((warmth) => {
            const warmthContacts = contacts.filter((c) => c.warmth === warmth)
            if (warmthContacts.length === 0) return null
            return (
              <div key={warmth} className="space-y-3">
                <h2 className="text-base font-medium text-foreground">{WARMTH_LABEL[warmth]}</h2>
                <div className="space-y-3">
                  {warmthContacts.map((contact) => (
                    <ContactRow key={contact.id} contact={contact} />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      <Accordion>
        <AccordionItem value="build-list">
          <AccordionTrigger>Build your list from LinkedIn</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Three steps, about 15 minutes total. You don&apos;t need to be technical for any of
                this — just follow along in order.
              </p>
              {/* Steps 1-3 are one workflow: export → clean up → import. The
                  connecting line + numbered circles below are the only thing
                  that changed visually from three separate cards — same
                  components, wrapped in a positioned container so the "why"
                  captions and connector read as one continuous task. */}
              <div id="import" className="relative space-y-6 border-l-2 border-border pl-6">
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
                    description="Paste your exported CSV into ChatGPT or Claude with this prompt to get it cleaned up and prioritized before you import it below."
                    template={NETWORK_CSV_AI_PROMPT_TEMPLATE}
                    templateType="csv_cleanup_prompt"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Why: your export includes everyone you&apos;ve ever connected with — this step
                    surfaces the people actually worth reaching out to first.
                  </p>
                </div>

                <div className="relative">
                  <span className="absolute -left-[1.85rem] flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
                    3
                  </span>
                  <div className="space-y-3 rounded-lg border border-border p-4">
                    <h3 className="text-sm font-medium text-foreground">Import the file</h3>
                    <CsvImportForm />
                    <p className="text-xs text-muted-foreground">
                      Why: this is what turns a spreadsheet into an actual, workable list above.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      What happens: contacts already on your list are skipped automatically (safe to
                      re-upload anytime), and any genuinely new ones are added above so you can tag
                      them.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="scripts">
          <AccordionTrigger>Scripts &amp; templates</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              {networkScriptsGuide && <GuideCard guide={networkScriptsGuide} />}
              <OutreachCheatSheetCard />
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">Ready-to-send templates</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
