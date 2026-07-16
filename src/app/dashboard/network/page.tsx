import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { CsvImportForm } from '@/components/dashboard/CsvImportForm'
import { NetworkComfortCheck } from '@/components/dashboard/NetworkComfortCheck'
import { NetworkEncouragement } from '@/components/dashboard/NetworkEncouragement'
import { NetworkingAnxietySelector } from '@/components/dashboard/NetworkingAnxietySelector'
import { NetworkConnectPreferenceSelector } from '@/components/dashboard/NetworkConnectPreferenceSelector'
import { ContactRow } from '@/components/dashboard/ContactRow'
import { CopyableTemplateCard } from '@/components/dashboard/CopyableTemplateCard'
import { OutreachPlanCard } from '@/components/dashboard/OutreachPlanCard'
import { OutreachCheatSheetCard } from '@/components/dashboard/OutreachCheatSheetCard'
import { EmailTrackingCard } from '@/components/dashboard/EmailTrackingCard'
import { GuideCard } from '@/components/dashboard/GuideCard'
import { fillHelpScriptTemplate } from '@/lib/constants/help-script-template'
import { NETWORK_CSV_AI_PROMPT_TEMPLATE } from '@/lib/constants/network-ai-prompt-template'
import { GUIDES } from '@/lib/constants/guides'
import { markAskedForHelp } from '@/app/dashboard/actions'
import {
  fillIntroRequestTemplate,
  fillGoodWordTemplate,
  fillCheckingInTemplate,
} from '@/lib/constants/network-email-templates'

const CATEGORY_ORDER = [
  'FORMER_COLLEAGUE',
  'HIRING_CONNECTION',
  'OWES_A_FAVOR',
  'RECENT_TRANSITION',
  'COULD_HELP_IN_RETURN',
  null,
] as const

const CATEGORY_LABEL: Record<string, string> = {
  FORMER_COLLEAGUE: 'Former colleagues who respected your work',
  HIRING_CONNECTION: 'People who hire at your level, or know people who do',
  OWES_A_FAVOR: 'People who owe you a favor or would take a call',
  RECENT_TRANSITION: "People who've made a successful transition recently",
  COULD_HELP_IN_RETURN: 'People you could genuinely help in return',
}

export default async function NetworkPage() {
  const profile = await getDashboardData()
  const contacts = await prisma.supportNetworkContact.findMany({
    where: { candidateId: profile.id },
    orderBy: { createdAt: 'desc' },
  })

  const scriptContext = {
    candidateFirstName: profile.firstName,
    targetRoleType: profile.targetRoleType,
    knownFor: profile.knownFor,
  }

  const networkScriptsGuide = GUIDES.find((g) => g.slug === 'network-scripts')

  if (!profile.networkComfortLevel) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activate My Network</h1>
          <p className="mt-1 text-muted-foreground">
            Networking is the single highest-leverage thing you can do in a search — most roles get
            filled through a connection, not a cold application. It also happens to be the part most
            people avoid the longest.
          </p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <NetworkComfortCheck />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Build your networking list</h1>
        <p className="mt-1 text-muted-foreground">
          The people most likely to help you find your next role probably aren&apos;t your closest
          friends — they&apos;re the people you sort of know. This is the highest-leverage work in
          your search; don&apos;t let it sit untouched.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Every contact you add and outreach you log counts toward the connecting signal in your
          Search Execution Grade.
        </p>
      </div>

      <NetworkEncouragement comfortLevel={profile.networkComfortLevel} />

      <div className="space-y-4 rounded-lg border border-border p-4">
        <NetworkingAnxietySelector current={profile.networkingConcerns} />
        <NetworkConnectPreferenceSelector current={profile.networkConnectPreferences} />
      </div>

      <OutreachPlanCard
        concerns={profile.networkingConcerns}
        connectPreferences={profile.networkConnectPreferences}
      />

      {networkScriptsGuide && <GuideCard guide={networkScriptsGuide} unlocked />}

      <OutreachCheatSheetCard />

      {/* Steps 1-3 are one workflow: export → clean up → import. The
          connecting line + numbered circles below are the only thing that
          changed visually from three separate cards — same components,
          wrapped in a positioned container so the "why" captions and
          connector read as one continuous task. */}
      <div>
        <h2 className="text-lg font-semibold">Build your list from LinkedIn</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Three steps, about 15 minutes total. You don&apos;t need to be technical for any of this —
          just follow along in order.
        </p>
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
                Why: this is what turns a spreadsheet into an actual, workable list below — with
                outreach scripts ready for each person.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Email Templates</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CopyableTemplateCard
            title="Ask someone for help"
            description="Pick one person from your list below and send this."
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

      <EmailTrackingCard />

      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No contacts yet — import your LinkedIn connections above to get started.
        </p>
      ) : (
        CATEGORY_ORDER.map((category) => {
          const categoryContacts = contacts.filter((c) => c.category === category)
          if (categoryContacts.length === 0) return null
          return (
            <div key={category ?? 'uncategorized'} className="space-y-3">
              <h2 className="text-lg font-semibold">
                {category ? CATEGORY_LABEL[category] : 'Uncategorized — sort these into a category'}
              </h2>
              <div className="space-y-3">
                {categoryContacts.map((contact) => (
                  <ContactRow
                    key={contact.id}
                    contact={contact}
                    networkingConcerns={profile.networkingConcerns}
                    scriptContext={scriptContext}
                  />
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
