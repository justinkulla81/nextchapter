'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  AUDIENCE_LABELS,
  CUSTOM_GROUP,
  MOMENT_LABELS,
  PRICING_LABELS,
  PROVIDER_LABELS,
  SERVICE_GROUPS,
  servicesFor,
  officesFor,
  serviceTarget,
  defaultSetting,
  describeTargeting,
  type Audience,
  type Moment,
  type Pricing,
  type Provider,
  type Service,
  type ServiceSetting,
} from '@/lib/higher-ed/services'
import type { OrgKind } from '@/lib/higher-ed/workspaces'
import { LockedFeature } from '@/components/plans/LockedFeature'
import { addOffering, removeOffering, saveService } from '@/app/i/[slug]/(portal)/actions'
import { ConfirmActionButton } from './ConfirmActionButton'
import { parseMajors } from '@/lib/higher-ed/major-groups-shared'

type RosterOption = { value: string; n: number }
type RosterOptions = { majors: RosterOption[]; schools: RosterOption[]; departments: RosterOption[] }

// Admin › Services (product design, "Admin screen"): one row per service with
// an on/off switch, and for each one that's on: who it's for, which office
// owns it, free / paid / donor-funded, where the card links, and how many
// members opened it in the last 30 days.
export function ServicesPanel({
  slug,
  initial,
  custom: initialCustom = [],
  rosterOptions,
  usage,
  canEdit,
  kind = 'college',
  plan = 'PAID',
}: {
  slug: string
  initial: Record<string, ServiceSetting>
  custom?: Service[]
  rosterOptions?: RosterOptions
  usage: Record<string, number>
  canEdit: boolean
  kind?: OrgKind
  plan?: string
}) {
  const ownOnly = plan === 'FREE'
  const [custom, setCustom] = useState<Service[]>(initialCustom)
  const catalog = [...servicesFor(kind), ...custom]
  const offices = officesFor(kind)
  const ours = kind === 'workforce' ? 'Your organization' : 'Your college'
  const [settings, setSettings] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<{ key: string; message: string } | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  function save(key: string, patch: Partial<ServiceSetting>) {
    const before = settings[key]
    setSettings((cur) => ({ ...cur, [key]: { ...cur[key], ...patch } }))
    setError(null)
    startTransition(async () => {
      const result = await saveService(slug, key, patch)
      if (result.error) {
        setSettings((cur) => ({ ...cur, [key]: before }))
        setError({ key, message: result.error })
      }
    })
  }

  const onCount = catalog.filter((s) => settings[s.key]?.on).length

  function added(service: Service) {
    setCustom((cur) => [...cur, service])
    setSettings((cur) => ({ ...cur, [service.key]: defaultSetting(service) }))
    setOpen(service.key)
  }
  function removed(key: string) {
    setCustom((cur) => cur.filter((s) => s.key !== key))
  }

  return (
    <div className={cn('space-y-8', pending && 'cursor-wait')}>
      <p className="text-sm text-muted-foreground">
        {onCount} of {catalog.length} on. {canEdit ? 'Switching one on adds its card to the Candidate home for the audiences you pick.' : 'Only an institution admin can change these.'}
      </p>
      {[...SERVICE_GROUPS, CUSTOM_GROUP].map((g) => (
        <section key={g.key} aria-labelledby={`group-${g.key}`} className="space-y-3">
          <div>
            <h2 id={`group-${g.key}`} className="text-base font-semibold">
              {g.label}
            </h2>
            <p className="text-sm text-muted-foreground">{g.blurb}</p>
          </div>
          {g.key === 'custom' && canEdit && <AddOfferingForm slug={slug} onAdded={added} />}
          {g.key === 'custom' && !custom.length && <p className="text-sm text-muted-foreground">None yet. Add an Exec Ed program, a partner’s course platform, an insurance plan or anything else with a link.</p>}
          <ul className={cn('divide-y divide-border rounded-lg border border-border bg-card', g.key === 'custom' && !custom.length && 'hidden')}>
            {catalog.filter((s) => s.group === g.key).map((s) => (
              <ServiceRow
                key={s.key}
                service={s}
                setting={settings[s.key]}
                opens={usage[s.key] ?? 0}
                canEdit={canEdit}
                pending={pending}
                expanded={open === s.key}
                onToggleExpanded={() => setOpen(open === s.key ? null : s.key)}
                onSave={(patch) => save(s.key, patch)}
                error={error?.key === s.key ? error.message : null}
                ours={ours}
                offices={offices}
                ownOnly={ownOnly}
                slug={slug}
                plan={plan}
                rosterOptions={rosterOptions}
                onRemoved={removed}
                audiences={kind === 'workforce' ? ['job_seekers', 'in_transition'] : (Object.keys(AUDIENCE_LABELS) as Audience[]).filter((a) => a !== 'job_seekers')}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function ServiceRow({
  service: s,
  setting,
  opens,
  canEdit,
  pending,
  expanded,
  onToggleExpanded,
  onSave,
  error,
  ours,
  offices,
  audiences,
  ownOnly,
  slug,
  plan,
  rosterOptions,
  onRemoved,
}: {
  service: Service
  setting: ServiceSetting
  opens: number
  canEdit: boolean
  pending: boolean
  expanded: boolean
  onToggleExpanded: () => void
  onSave: (patch: Partial<ServiceSetting>) => void
  error: string | null
  ours: string
  offices: readonly string[]
  audiences: Audience[]
  ownOnly: boolean
  slug: string
  plan: string
  rosterOptions?: RosterOptions
  onRemoved: (key: string) => void
}) {
  const id = `svc-${s.key}`
  const targeting = describeTargeting(setting.targeting)
  const needsLink = setting.on && s.memberCard && !serviceTarget(s, setting)
  const summary = [
    setting.audience.length ? setting.audience.map((a) => AUDIENCE_LABELS[a]).join(', ') : s.memberCard ? 'No audience' : null,
    s.memberCard
      ? setting.provider === 'partner'
        ? `By ${setting.partnerName ?? 'a partner'}`
        : `By ${(setting.provider === 'college' ? ours : PROVIDER_LABELS[setting.provider]).replace(/^Your /, 'your ')}`
      : null,
    targeting ? `Only ${targeting}` : null,
    setting.ownerName ? `${setting.ownerOffice} (${setting.ownerName})` : setting.ownerOffice,
    PRICING_LABELS[setting.pricing],
    s.memberCard && setting.on ? `${opens} ${opens === 1 ? 'open' : 'opens'} in 30 days` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="p-4">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p id={`${id}-name`} className="text-sm font-medium">
            {s.name}
          </p>
          <p id={`${id}-pitch`} className="mt-0.5 text-sm text-muted-foreground">
            {s.pitch}
          </p>
          {setting.on && <p className="mt-1 text-xs text-muted-foreground">{summary}</p>}
          {needsLink && <p className="mt-1 text-xs font-medium text-amber-800">Add a link in settings: members won&apos;t see this card until it has one.</p>}
        </div>
        {setting.on && canEdit && (
          <Button variant="ghost" size="sm" onClick={onToggleExpanded} aria-expanded={expanded} aria-controls={`${id}-settings`}>
            {expanded ? 'Close settings' : 'Settings'}
          </Button>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={setting.on}
          aria-labelledby={`${id}-name`}
          aria-describedby={`${id}-pitch`}
          disabled={!canEdit}
          title={canEdit ? undefined : 'Only an institution admin can change services'}
          onClick={() => onSave({ on: !setting.on })}
          className={cn(
            'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60',
            setting.on ? 'bg-primary' : 'bg-muted',
            pending && 'cursor-wait',
          )}
        >
          <span className={cn('inline-block size-5 rounded-full bg-white shadow transition-transform', setting.on ? 'translate-x-5' : 'translate-x-0')} />
          <span className="sr-only">{setting.on ? 'On' : 'Off'}</span>
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {expanded && setting.on && canEdit && (
        <ServiceSettingsForm id={id} service={s} setting={setting} onSave={onSave} pending={pending} ours={ours} offices={offices} audiences={audiences} ownOnly={ownOnly} slug={slug} plan={plan} rosterOptions={rosterOptions} />
      )}
      {s.group === 'custom' && canEdit && (
        <div className="mt-2">
          <ConfirmActionButton
            variant="outline"
            label="Remove"
            confirm={`Remove ${s.name}? Its card disappears for members; switch it off instead to keep its settings.`}
            confirmLabel="Remove offering"
            run={async () => {
              const r = await removeOffering(slug, s.key)
              if (!r.error) onRemoved(s.key)
              return r.error ? { error: r.error } : { message: 'Removed.' }
            }}
          />
        </div>
      )}
    </li>
  )
}

function ServiceSettingsForm({
  id,
  service: s,
  setting,
  onSave,
  pending,
  ours,
  offices,
  audiences,
  ownOnly,
  slug,
  plan,
  rosterOptions,
}: {
  id: string
  service: Service
  setting: ServiceSetting
  onSave: (patch: Partial<ServiceSetting>) => void
  pending: boolean
  ours: string
  offices: readonly string[]
  audiences: Audience[]
  ownOnly: boolean
  slug: string
  plan: string
  rosterOptions?: RosterOptions
}) {
  const [audience, setAudience] = useState<Audience[]>(setting.audience)
  const [ownerOffice, setOwnerOffice] = useState(setting.ownerOffice)
  const [ownerName, setOwnerName] = useState(setting.ownerName ?? '')
  const [pricing, setPricing] = useState<Pricing>(setting.pricing)
  const [linkUrl, setLinkUrl] = useState(setting.linkUrl ?? '')
  const [provider, setProvider] = useState<Provider>(ownOnly && setting.provider !== 'partner' ? 'college' : setting.provider)
  const [partnerName, setPartnerName] = useState(setting.partnerName ?? '')
  const t = setting.targeting
  const [target, setTarget] = useState({
    majors: t.majors.join(', '),
    schools: t.schools.join(', '),
    departments: t.departments.join(', '),
    cities: t.cities.join(', '),
    classYearFrom: t.classYearFrom ? String(t.classYearFrom) : '',
    classYearTo: t.classYearTo ? String(t.classYearTo) : '',
  })
  const [moments, setMoments] = useState<Moment[]>(t.moments)
  const [skills, setSkills] = useState(setting.skills.join(', '))
  // Who can provide it: NextChapter's options only for its built-in screens; a partner for anything.
  const providers: Provider[] = s.builtIn && !ownOnly ? ['college', 'nextchapter', 'both', 'partner'] : ['college', 'partner']

  return (
    <form
      id={`${id}-settings`}
      className="mt-4 grid gap-4 rounded-md border border-border bg-background p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault()
        const year = (v: string) => (/^\d{4}$/.test(v.trim()) ? Number(v.trim()) : null)
        const targeting = {
          majors: parseMajors(target.majors),
          schools: parseMajors(target.schools),
          departments: parseMajors(target.departments),
          cities: parseMajors(target.cities),
          classYearFrom: year(target.classYearFrom),
          classYearTo: year(target.classYearTo),
          moments,
        }
        onSave({ audience, ownerOffice, ownerName: ownerName || null, pricing, linkUrl: linkUrl || null, provider, partnerName: partnerName || null, targeting, skills: parseMajors(skills) })
      }}
    >
      {s.memberCard && (
        <fieldset className="space-y-1.5 sm:col-span-2">
          <legend className="text-sm font-medium">Who provides it</legend>
          <div className="flex flex-wrap gap-2">
            {providers.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={provider === p}
                onClick={() => setProvider(p)}
                className={cn('rounded-md border px-3 py-1.5 text-sm', provider === p ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}
              >
                {p === 'college' ? ours : PROVIDER_LABELS[p]}
              </button>
            ))}
          </div>
          {s.builtIn && ownOnly && (
            <>
              <p className="text-sm text-muted-foreground">Using NextChapter’s version is part of the paid plan.</p>
              <LockedFeature feature="nextchapterServices" slug={slug} plan={plan} compact />
            </>
          )}
          {provider === 'partner' && (
            <div className="max-w-sm space-y-1.5 pt-2">
              <Label htmlFor={`${id}-partner`}>Partner’s name</Label>
              <Input id={`${id}-partner`} value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="The company members will see" />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {provider === 'college' ? 'Your own office delivers it; the card opens your link.' : provider === 'partner' ? 'A partner delivers it; the card says “From” the partner and opens their link.' : provider === 'nextchapter' ? 'NextChapter delivers it inside the portal at no extra work for your staff.' : 'Members get yours first, and NextChapter’s too.'}
          </p>
        </fieldset>
      )}
      {s.memberCard && (
        <fieldset className="space-y-1.5 sm:col-span-2">
          <legend className="text-sm font-medium">Who sees the card</legend>
          <div className="flex flex-wrap gap-2">
            {audiences.map((a) => {
              const on = audience.includes(a)
              return (
                <button
                  key={a}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setAudience(on ? audience.filter((x) => x !== a) : [...audience, a])}
                  className={cn('rounded-md border px-3 py-1.5 text-sm', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}
                >
                  {AUDIENCE_LABELS[a]}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}
      {s.memberCard && (
        <fieldset className="space-y-3 sm:col-span-2">
          <legend className="text-sm font-medium">Only for (optional)</legend>
          <p className="text-xs text-muted-foreground">
            Narrow who sees the card within the audiences above. Every box you fill must match; within a box, any entry does. Separate entries with commas. City
            and career moment come from a member’s own NextChapter profile, so they apply to alumni who have joined.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ['majors', 'Majors', 'English, History', rosterOptions?.majors],
                ['schools', 'Schools or colleges', 'Tepper School of Business', rosterOptions?.schools],
                ['departments', 'Departments', 'Department of Statistics', rosterOptions?.departments],
                ['cities', 'Cities', 'Miami, Pittsburgh', undefined],
              ] as const
            ).map(([k, label, ph, opts]) => (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={`${id}-t-${k}`}>{label}</Label>
                <Input id={`${id}-t-${k}`} list={opts?.length ? `${id}-t-${k}-list` : undefined} value={target[k]} onChange={(e) => setTarget({ ...target, [k]: e.target.value })} placeholder={ph} />
                {opts?.length ? (
                  <datalist id={`${id}-t-${k}-list`}>
                    {opts.map((o) => (
                      <option key={o.value} value={o.value}>{`${o.n.toLocaleString()} on the roster`}</option>
                    ))}
                  </datalist>
                ) : null}
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-t-from`}>Class years</Label>
              <div className="flex items-center gap-2">
                <Input id={`${id}-t-from`} inputMode="numeric" aria-label="First class year" value={target.classYearFrom} onChange={(e) => setTarget({ ...target, classYearFrom: e.target.value })} placeholder="2000" />
                <span className="text-sm text-muted-foreground">to</span>
                <Input inputMode="numeric" aria-label="Last class year" value={target.classYearTo} onChange={(e) => setTarget({ ...target, classYearTo: e.target.value })} placeholder="2015" />
              </div>
            </div>
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-sm">Career moment</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {(Object.keys(MOMENT_LABELS) as Moment[]).map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={moments.includes(m)} onChange={(e) => setMoments(e.target.checked ? [...moments, m] : moments.filter((x) => x !== m))} />
                  {MOMENT_LABELS[m]}
                </label>
              ))}
            </div>
          </fieldset>
        </fieldset>
      )}
      {s.memberCard && (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${id}-skills`}>Skills it teaches (optional)</Label>
          <Input id={`${id}-skills`} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Python, project management, financial modeling" aria-describedby={`${id}-skills-help`} />
          <p id={`${id}-skills-help`} className="text-xs text-muted-foreground">
            For the skills bridge: an alum whose target jobs ask for one of these skills, and who doesn’t show it yet, is pointed to this offering. Use the words job postings use.
          </p>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-office`}>Owning office</Label>
        <select
          id={`${id}-office`}
          value={ownerOffice}
          onChange={(e) => setOwnerOffice(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          {[...new Set([ownerOffice, ...offices])].map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-owner`}>Owner&apos;s name (optional)</Label>
        <Input id={`${id}-owner`} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Who members' questions go to" />
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Pricing</legend>
        <div className="flex gap-2">
          {(Object.keys(PRICING_LABELS) as Pricing[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={pricing === p}
              onClick={() => setPricing(p)}
              className={cn('rounded-md border px-3 py-1.5 text-sm', pricing === p ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}
            >
              {PRICING_LABELS[p]}
            </button>
          ))}
        </div>
      </fieldset>
      {s.memberCard && provider !== 'nextchapter' && (
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-link`}>{provider === 'both' ? 'Your link (optional)' : provider === 'partner' ? 'Partner’s link' : 'Your link'}</Label>
          <Input id={`${id}-link`} type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" />
          <p className="text-xs text-muted-foreground">
            {provider === 'both' ? 'Leave empty to use only NextChapter’s screen.' : 'Where the card sends members, such as your office’s booking page.'}
          </p>
        </div>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending} className={cn(pending && 'cursor-wait')}>
          {pending ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </form>
  )
}

function AddOfferingForm({ slug, onAdded }: { slug: string; onAdded: (s: Service) => void }) {
  const [name, setName] = useState('')
  const [pitch, setPitch] = useState('')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className={cn('grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end', pending && 'cursor-wait')}
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        start(async () => {
          const r = await addOffering(slug, { name, pitch })
          if (r.error || !r.key) return setError(r.error ?? 'That didn’t save. Try again.')
          onAdded({ key: r.key, group: 'custom', name: name.trim(), pitch: pitch.trim(), defaultOwner: 'Alumni Relations', defaultAudience: ['alumni'], defaultPricing: 'free', builtIn: null, memberCard: true, defaultOn: true })
          setName('')
          setPitch('')
        })
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="offer-name">Offering</Label>
        <Input id="offer-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="AI for leaders certificate" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="offer-pitch">One line for members</Label>
        <Input id="offer-pitch" value={pitch} onChange={(e) => setPitch(e.target.value)} placeholder="Six weeks, online, at the alumni rate." />
      </div>
      <Button type="submit" disabled={pending} className={cn(pending && 'cursor-wait')}>
        {pending ? 'Adding…' : 'Add offering'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-3">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground sm:col-span-3">Then open its settings to add the link, the provider (yours or a partner’s), who sees it and the price.</p>
    </form>
  )
}
