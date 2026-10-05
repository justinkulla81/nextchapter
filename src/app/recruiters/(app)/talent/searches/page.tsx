import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getTalentContext, visibleConnectionsWhere } from '@/lib/recruiter/intake/access'
import { INTAKE_LEVELS, TALENT_PRODUCT_NAME } from '@/lib/recruiter/intake/constants'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { TalentSubnav } from '@/components/recruiter/talent/TalentSubnav'
import { ConfirmingActionButton, TalentActionForm } from '@/components/recruiter/talent/TalentForms'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveSearch, setSearchStatus } from '../actions'

function CheckboxGroup({ name, options, selected }: { name: string; options: readonly string[]; selected: string[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {options.map((option) => (
        <label key={option} className="flex items-center gap-2 text-sm">
          <input type="checkbox" name={name} value={option} defaultChecked={selected.includes(option)} className="size-4 rounded border-input" />
          {option}
        </label>
      ))}
    </div>
  )
}

function SearchFields({ search }: { search?: { id: string; title: string; clientName: string | null; location: string | null; functions: string[]; levels: string[]; mustHaves: string[] } }) {
  return (
    <>
      {search && <input type="hidden" name="id" value={search.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`title-${search?.id ?? 'new'}`}>Search title</Label>
          <Input id={`title-${search?.id ?? 'new'}`} name="title" defaultValue={search?.title} placeholder="CFO, digital health" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`client-${search?.id ?? 'new'}`}>Client (never shown to candidates)</Label>
          <Input id={`client-${search?.id ?? 'new'}`} name="clientName" defaultValue={search?.clientName ?? ''} />
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Function</legend>
        <CheckboxGroup name="functions" options={PRIMARY_FUNCTION_OPTIONS} selected={search?.functions ?? []} />
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Level</legend>
        <CheckboxGroup name="levels" options={INTAKE_LEVELS} selected={search?.levels ?? []} />
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`must-${search?.id ?? 'new'}`}>Must-haves, comma separated</Label>
          <Input id={`must-${search?.id ?? 'new'}`} name="mustHaves" defaultValue={search?.mustHaves.join(', ')} placeholder="IPO readiness, healthcare" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`loc-${search?.id ?? 'new'}`}>Location</Label>
          <Input id={`loc-${search?.id ?? 'new'}`} name="location" defaultValue={search?.location ?? ''} placeholder="Boston, or Remote" />
        </div>
      </div>
    </>
  )
}

export default async function TalentSearchesPage() {
  const ctx = await getTalentContext()
  if (!ctx.firm) redirect('/recruiters/talent')

  const [searches, draftCount] = await Promise.all([
    prisma.intakeSearch.findMany({
      where: { recruiterId: ctx.recruiter.id },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { connections: true } } },
    }),
    prisma.intakeReply.count({ where: { status: 'DRAFT', connection: visibleConnectionsWhere(ctx) } }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{TALENT_PRODUCT_NAME} · {ctx.firm.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Open searches</h1>
        <p className="mt-1 text-muted-foreground">
          A resume that meets every criterion you set is tagged Fit and emailed to you right away. Anyone who meets some of
          them is held for you and never gets an automatic &quot;not a match&quot; reply.
        </p>
      </div>
      <TalentSubnav active="/recruiters/talent/searches" draftCount={draftCount} />

      <section className="rounded-lg border border-border p-6">
        <h2 className="mb-4 text-lg font-semibold">Add a search</h2>
        <TalentActionForm action={saveSearch} submitLabel="Add search" pendingLabel="Adding…">
          <SearchFields />
        </TalentActionForm>
      </section>

      {searches.length === 0 ? (
        <p className="text-sm text-muted-foreground">No searches yet. Without one, pre-scan sorts by your specialties only.</p>
      ) : (
        <ul className="space-y-3">
          {searches.map((s) => (
            <li key={s.id} className="rounded-lg border border-border p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {s.title} {s.status === 'CLOSED' && <span className="text-sm font-normal text-muted-foreground">· Closed</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[...s.functions, ...s.levels, ...s.mustHaves, s.location].filter(Boolean).join(' · ')} · {s._count.connections} tagged Fit
                  </p>
                </div>
                <ConfirmingActionButton
                  label={s.status === 'OPEN' ? 'Close search' : 'Reopen'}
                  onAction={setSearchStatus.bind(null, s.id, s.status === 'OPEN' ? 'CLOSED' : 'OPEN')}
                />
              </div>
              {s.status === 'OPEN' && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-muted-foreground">Edit</summary>
                  <TalentActionForm action={saveSearch} submitLabel="Save search" className="mt-4">
                    <SearchFields search={s} />
                  </TalentActionForm>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
