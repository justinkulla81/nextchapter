import { requireOutplacementRole } from '@/lib/employer/outplacement-auth'
import { orgProgram } from '@/lib/employer/program-server'
import { PROGRAM_FEATURES, tierIncludes } from '@/lib/employer/program-settings'
import { ProgramDetailsForm, ProgramFeatureToggle } from '@/components/employer/ProgramForms'

const TIER_LABEL = { CORE: 'Core', PLUS: 'Plus', PREMIUM: 'Premium' } as const

// What this company offers the people it enrolls: the program name and
// welcome they see, and which services in the contract to offer.
export default async function EmployerProgramPage() {
  const orgUser = await requireOutplacementRole(['ADMIN'])
  const p = await orgProgram(orgUser.orgId)
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Program</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          What your people see when they sign in to NextChapter: your program name, a welcome from you, and the services you offer. Switching a service off
          removes it from their program page; it doesn’t change your contract or price.
        </p>
      </div>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Name and welcome</h2>
        <ProgramDetailsForm programBrandName={p.programBrandName} welcome={p.settings.welcome} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Services {p.tier ? <span className="text-sm font-normal text-muted-foreground">· your contract: {TIER_LABEL[p.tier]}</span> : null}</h2>
        {!p.tier && <p className="text-sm text-muted-foreground">No active contract yet, so there’s nothing to offer. Your NextChapter contact sets up the contract.</p>}
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {PROGRAM_FEATURES.map((f) => {
            const included = tierIncludes(p.tier, f.key)
            return (
              <li key={f.key} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <span>
                  <span className="text-sm font-medium">{f.label}</span>
                  <span className="block text-xs text-muted-foreground">{f.what}</span>
                </span>
                {included ? (
                  <ProgramFeatureToggle featureKey={f.key} label={f.label} on={p.settings.features[f.key] !== false} />
                ) : (
                  <span className="text-xs text-muted-foreground">In {TIER_LABEL[f.minTier]} and up</span>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
