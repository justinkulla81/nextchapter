'use client'

import { useActionState, useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import {
  createCollege,
  saveCollegeBranding,
  inviteCollegeStaff,
  saveCollegeLicense,
  saveCollegeRegion,
  countiesInState,
  searchCrmColleges,
  type CrmCollegeOption,
  type InstitutionFormState,
} from '@/app/support/admin/(portal)/institutions/actions'

// One option per /i/[slug] staff role. VIEWER is left out until the form can
// pick its one workspace (InstitutionUser.workspace); without it a viewer
// opens nothing.
const ROLE_OPTIONS = [
  ['INSTITUTION_ADMIN', 'Administrator'],
  ['CAREER_SERVICES', 'Career services'],
  ['EMPLOYER_RELATIONS', 'Employer relations'],
  ['ALUMNI_RELATIONS', 'Alumni relations'],
  ['DEVELOPMENT', 'Development'],
  ['COACH', 'Coach'],
  ['FACULTY', 'Faculty (Teaching)'],
  ['EXEC_ED', 'Executive education'],
] as const

function Status({ state }: { state: InstitutionFormState }) {
  if (state?.error) return <p className="text-sm text-destructive">{state.error}</p>
  if (state?.ok) return <p className="text-sm text-muted-foreground">{state.ok}</p>
  return null
}

function BrandFields({ defaults }: { defaults?: { programBrandName: string | null; accentColor: string | null; tagline: string | null } }) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="programBrandName">Program name (optional)</Label>
        <Input id="programBrandName" name="programBrandName" defaultValue={defaults?.programBrandName ?? ''} placeholder="e.g. Presidents Career Network" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="accentColor">Brand colour</Label>
        <div className="flex items-center gap-2">
          <input id="accentColor" name="accentColor" type="color" defaultValue={defaults?.accentColor ?? '#1E4B8C'} className="h-10 w-14 rounded border border-input" />
          <span className="text-xs text-muted-foreground">Use the college’s primary colour.</span>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="tagline">Tagline (optional)</Label>
        <Input id="tagline" name="tagline" defaultValue={defaults?.tagline ?? ''} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="logo">Logo</Label>
        <Input id="logo" name="logo" type="file" accept="image/*" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="hero">Hero image</Label>
        <Input id="hero" name="hero" type="file" accept="image/*" />
      </div>
    </>
  )
}

const slugFromDomain = (d: string | null) => (d ? d.replace(/\.(edu|org|com)$/, '').split('.').pop()!.replace(/[^a-z0-9-]/g, '') : '')

export function CreateCollegeForm() {
  const [state, action] = useActionState(createCollege, undefined)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<CrmCollegeOption[]>([])
  const [picked, setPicked] = useState<CrmCollegeOption | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [domains, setDomains] = useState('')

  // Searches only once two letters are typed and nothing is picked yet; stale
  // results are hidden by `shown` below rather than cleared in the effect.
  const searching = !picked && query.trim().length >= 2
  useEffect(() => {
    if (!searching) return
    const t = setTimeout(() => searchCrmColleges(query).then(setOptions).catch(() => setOptions([])), 200)
    return () => clearTimeout(t)
  }, [query, searching])
  const shown = searching ? options : []

  function pick(o: CrmCollegeOption) {
    setPicked(o)
    setOptions([])
    setQuery(o.name)
    setName(o.name)
    setSlug(slugFromDomain(o.domain))
    setDomains(o.domain ?? '')
  }

  return (
    <form action={action} className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
      <input type="hidden" name="localCollegeId" value={picked?.id ?? ''} />
      <div className="relative space-y-1 sm:col-span-2">
        <Label htmlFor="crmCollege">College from the CRM</Label>
        <Input
          id="crmCollege"
          value={query}
          autoComplete="off"
          placeholder="Search the CRM's colleges and universities"
          onChange={(e) => {
            setQuery(e.target.value)
            setPicked(null)
          }}
        />
        {shown.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-background shadow-md">
            {shown.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  disabled={!!o.linkedTo}
                  onClick={() => pick(o)}
                  className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>{o.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {[o.location, o.domain, o.linkedTo ? 'already has a workspace' : null].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          {picked
            ? 'Linked to this CRM record. Name, slug and domain were filled from it.'
            : 'Not in the CRM yet? Type the name below and a CRM record is created for it.'}
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="name">College name</Label>
        <Input id="name" name="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Washington & Jefferson College" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="slug">Slug</Label>
        <Input id="slug" name="slug" required value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="washjeff" />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="domains">Email domains (staff and alumni)</Label>
        <Input id="domains" name="domains" value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="washjeff.edu" />
      </div>
      <BrandFields />
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="isDemo" defaultChecked /> Demo (not a signed customer)
      </label>
      <div className="space-y-2 sm:col-span-2">
        <Status state={state} />
        <SubmitButton pendingLabel="Creating…">Create college</SubmitButton>
      </div>
    </form>
  )
}

export function BrandingForm({
  institutionId,
  defaults,
}: {
  institutionId: string
  defaults: { programBrandName: string | null; accentColor: string | null; tagline: string | null }
}) {
  const [state, action] = useActionState(saveCollegeBranding.bind(null, institutionId), undefined)
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <BrandFields defaults={defaults} />
      <div className="space-y-2 sm:col-span-2">
        <Status state={state} />
        <SubmitButton size="sm" pendingLabel="Saving…">Save branding</SubmitButton>
      </div>
    </form>
  )
}

export function InviteStaffForm({ institutionId }: { institutionId: string }) {
  const [state, action] = useActionState(inviteCollegeStaff.bind(null, institutionId), undefined)
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor={`email-${institutionId}`}>Email</Label>
        <Input id={`email-${institutionId}`} name="email" type="email" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`fn-${institutionId}`}>Name (optional)</Label>
        <Input id={`fn-${institutionId}`} name="fullName" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`role-${institutionId}`}>Role</Label>
        <select id={`role-${institutionId}`} name="role" defaultValue="INSTITUTION_ADMIN" className="h-10 rounded-md border border-input bg-transparent px-3 text-sm">
          {ROLE_OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
      <SubmitButton size="sm" pendingLabel="Sending…">Send invite</SubmitButton>
      <div className="w-full"><Status state={state} /></div>
    </form>
  )
}

const TIERS = [
  ['CAREER', 'Career', 'Candidate, Alumni Relations, Career Services, Employer, Admin'],
  ['ADVANCEMENT', 'Advancement', '+ Development'],
  ['INSTITUTION', 'Institution', '+ Teaching, Exec Ed, Workforce board'],
] as const

// The license: which workspaces open (tier), seats, term, priced-on alumni count.
export function LicenseForm({ institutionId, defaults }: { institutionId: string; defaults: { tier: string; includedSeats: number; alumniCount: number | null; licenseStartAt: string; licenseEndAt: string } }) {
  const [state, action] = useActionState(saveCollegeLicense.bind(null, institutionId), undefined)
  const [v, setV] = useState({ ...defaults, includedSeats: String(defaults.includedSeats), alumniCount: defaults.alumniCount === null ? '' : String(defaults.alumniCount) })
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="tier" value={v.tier} />
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Tier</legend>
        <div className="flex flex-wrap gap-2">
          {TIERS.map(([key, label, what]) => (
            <button
              key={key}
              type="button"
              aria-pressed={v.tier === key}
              onClick={() => setV({ ...v, tier: key })}
              className={`rounded-md border px-3 py-1.5 text-left text-sm ${v.tier === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}
            >
              <span className="font-medium">{label}</span>
              <span className="block text-xs opacity-80">{what}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor={`seats-${institutionId}`}>Included seats</Label>
          <Input id={`seats-${institutionId}`} name="includedSeats" inputMode="numeric" value={v.includedSeats} onChange={(e) => setV({ ...v, includedSeats: e.target.value })} className="w-28" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`alumni-${institutionId}`}>Alumni count (priced on)</Label>
          <Input id={`alumni-${institutionId}`} name="alumniCount" inputMode="numeric" value={v.alumniCount} onChange={(e) => setV({ ...v, alumniCount: e.target.value })} className="w-32" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`start-${institutionId}`}>Starts</Label>
          <Input id={`start-${institutionId}`} name="licenseStartAt" type="date" value={v.licenseStartAt} onChange={(e) => setV({ ...v, licenseStartAt: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`end-${institutionId}`}>Ends</Label>
          <Input id={`end-${institutionId}`} name="licenseEndAt" type="date" value={v.licenseEndAt} onChange={(e) => setV({ ...v, licenseEndAt: e.target.value })} />
        </div>
        <SubmitButton size="sm" pendingLabel="Saving…">Save license</SubmitButton>
      </div>
      <Status state={state} />
    </form>
  )
}

const US_STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'PR']

type Area = { state: string; counties: string[] }

// Local market: the states a college serves and the counties in each.
export function RegionForm({ institutionId, defaults }: { institutionId: string; defaults: { name: string; areas: Area[] } }) {
  const [name, setName] = useState(defaults.name)
  const [areas, setAreas] = useState<Area[]>(defaults.areas)
  const [options, setOptions] = useState<Record<string, { key: string; name: string }[]>>({})
  const [adding, setAdding] = useState('')
  const [filter, setFilter] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<{ error?: string; message?: string } | null>(null)

  const load = async (state: string) => {
    if (options[state]) return
    const list = await countiesInState(state)
    setOptions((o) => ({ ...o, [state]: list }))
  }
  useEffect(() => {
    defaults.areas.forEach((a) => void load(a.state))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = (state: string, key: string) =>
    setAreas(areas.map((a) => (a.state !== state ? a : { ...a, counties: a.counties.includes(key) ? a.counties.filter((c) => c !== key) : [...a.counties, key] })))

  return (
    <div className={`space-y-3 ${pending ? 'cursor-wait' : ''}`}>
      <div className="space-y-1">
        <Label htmlFor={`rname-${institutionId}`}>Region name</Label>
        <Input id={`rname-${institutionId}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Louisville area (KY and IN)" className="max-w-md" />
      </div>
      {areas.map((a) => {
        const list = (options[a.state] ?? []).filter((c) => !filter[a.state] || c.name.toLowerCase().includes(filter[a.state].toLowerCase()))
        return (
          <fieldset key={a.state} className="space-y-2 rounded-md border border-border p-3">
            <legend className="px-1 text-sm font-medium">
              {a.state} · {a.counties.length} {a.counties.length === 1 ? 'county' : 'counties'}
            </legend>
            <div className="flex flex-wrap items-center gap-2">
              <Input aria-label={`Filter ${a.state} counties`} placeholder="Filter counties" value={filter[a.state] ?? ''} onChange={(e) => setFilter({ ...filter, [a.state]: e.target.value })} className="h-8 w-48" />
              <button type="button" className="text-xs underline" onClick={() => setAreas(areas.filter((x) => x.state !== a.state))}>
                Remove {a.state}
              </button>
            </div>
            {!options[a.state] ? (
              <p className="text-xs text-muted-foreground">Loading counties…</p>
            ) : (
              <div className="grid max-h-48 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto text-sm sm:grid-cols-4">
                {list.map((c) => (
                  <label key={c.key} className="flex items-center gap-1.5">
                    <input type="checkbox" checked={a.counties.includes(c.key)} onChange={() => toggle(a.state, c.key)} />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        )
      })}
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Add a state" value={adding} onChange={(e) => setAdding(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Add a state…</option>
          {US_STATES.filter((s) => !areas.some((a) => a.state === s)).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!adding}
          title={!adding ? 'Pick a state first' : undefined}
          className="h-9 rounded-md border border-border px-3 text-sm disabled:opacity-50"
          onClick={() => {
            setAreas([...areas, { state: adding, counties: [] }])
            void load(adding)
            setAdding('')
          }}
        >
          Add state
        </button>
        <button
          type="button"
          disabled={pending}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          onClick={async () => {
            setPending(true)
            setResult(await saveCollegeRegion(institutionId, { name, areas }))
            setPending(false)
          }}
        >
          {pending ? 'Saving…' : 'Save region'}
        </button>
        {result && (
          <p role={result.error ? 'alert' : 'status'} className={`text-sm ${result.error ? 'text-destructive' : 'text-muted-foreground'}`}>
            {result.error ?? result.message}
          </p>
        )}
      </div>
    </div>
  )
}
