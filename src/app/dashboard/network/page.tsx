import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { CsvImportForm } from '@/components/dashboard/CsvImportForm'
import { AddContactForm } from '@/components/dashboard/AddContactForm'
import { NetworkingAnxietySelector } from '@/components/dashboard/NetworkingAnxietySelector'
import { ContactRow } from '@/components/dashboard/ContactRow'

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Support Network</h1>
        <p className="mt-1 text-muted-foreground">
          The people most likely to help you find your next role probably aren&apos;t your closest friends —
          they&apos;re the people you sort of know. Build your list of 25 across these 5 categories.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-foreground">Import from LinkedIn</h2>
        <p className="text-sm text-muted-foreground">
          Settings &amp; Privacy → Data Privacy → Get a copy of your data → Connections → Request archive. LinkedIn
          emails a download link within 10-24 minutes.
        </p>
        <CsvImportForm />
      </div>

      <div className="rounded-lg border border-border p-4">
        <NetworkingAnxietySelector current={profile.networkingAnxiety} />
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium text-foreground">Add a contact manually</h2>
        <AddContactForm />
      </div>

      {CATEGORY_ORDER.map((category) => {
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
                  networkingAnxiety={profile.networkingAnxiety}
                  scriptContext={scriptContext}
                />
              ))}
            </div>
          </div>
        )
      })}

      {contacts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No contacts yet — import your LinkedIn connections or add people manually above.
        </p>
      )}
    </div>
  )
}
