import { requireOutplacementRole } from '@/lib/employer/outplacement-auth'
import { orgProgram } from '@/lib/employer/program-server'
import { PROGRAM_FEATURES, tierIncludes } from '@/lib/employer/program-settings'
import { PackagesEditor, ProgramDetailsForm, ProgramLookForm, ServiceMenuRow } from '@/components/employer/ProgramForms'

const TIER_LABEL = { CORE: 'Core', PLUS: 'Plus', PREMIUM: 'Premium' } as const

// The services menu for the people this company enrolls: the program name
// and welcome, each service on or off and who provides it (NextChapter or the
// company's own), and packages for who gets what.
export default async function EmployerProgramPage() {
  const orgUser = await requireOutplacementRole(['ADMIN'])
  const p = await orgProgram(orgUser.orgId)
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Program</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Choose what your people get, who provides each service (NextChapter, or your own team), and which groups get what. They see it on their NextChapter
          dashboard and in their invite email. Changes don’t alter your contract or price.
        </p>
      </div>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Name and welcome</h2>
        <ProgramDetailsForm programBrandName={p.programBrandName} welcome={p.settings.welcome} />
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Logo and color</h2>
        <ProgramLookForm logoUrl={p.settings.brand.logoUrl} accentColor={p.settings.brand.accentColor} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Services</h2>
          <p className="text-sm text-muted-foreground">
            {p.tier ? `Your contract: ${TIER_LABEL[p.tier]}. ` : 'No active contract yet: NextChapter services turn on once your contract starts. '}
            For anything your company already provides (an EAP, your benefits team, internal openings), choose “Your own” and say how to reach it.
          </p>
        </div>
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {PROGRAM_FEATURES.map((f) => (
            <ServiceMenuRow
              key={f.key}
              featureKey={f.key}
              label={f.label}
              what={f.what}
              choice={p.settings.services[f.key]}
              nextchapter={f.nextchapter ? { included: tierIncludes(p.tier, f.key), tierNeeded: TIER_LABEL[f.nextchapter.minTier] } : null}
              ownAllowed={f.ownAllowed}
            />
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Who gets what</h2>
          <p className="text-sm text-muted-foreground">
            Packages give a group its own set of services, for example coaching for directors and up. You pick a package when you enroll someone, and can change it
            on the Roster. A service you switched off above stays off in every package.
          </p>
        </div>
        <PackagesEditor packages={p.settings.packages} services={PROGRAM_FEATURES.map((f) => ({ key: f.key, label: f.label }))} />
      </section>
    </div>
  )
}
