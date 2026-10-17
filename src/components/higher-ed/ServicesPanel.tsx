'use client'

import { useState, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  AUDIENCE_LABELS,
  PRICING_LABELS,
  PROVIDER_LABELS,
  SERVICE_GROUPS,
  servicesFor,
  officesFor,
  serviceTarget,
  type Audience,
  type Pricing,
  type Provider,
  type Service,
  type ServiceSetting,
} from '@/lib/higher-ed/services'
import type { OrgKind } from '@/lib/higher-ed/workspaces'
import { saveService } from '@/app/i/[slug]/(portal)/actions'

// Admin › Services (product design, "Admin screen"): one row per service with
// an on/off switch, and for each one that's on: who it's for, which office
// owns it, free / paid / donor-funded, where the card links, and how many
// members opened it in the last 30 days.
export function ServicesPanel({
  slug,
  initial,
  usage,
  canEdit,
  kind = 'college',
}: {
  slug: string
  initial: Record<string, ServiceSetting>
  usage: Record<string, number>
  canEdit: boolean
  kind?: OrgKind
}) {
  const catalog = servicesFor(kind)
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

  return (
    <div className={cn('space-y-8', pending && 'cursor-wait')}>
      <p className="text-sm text-muted-foreground">
        {onCount} of {catalog.length} on. {canEdit ? 'Switching one on adds its card to the Candidate home for the audiences you pick.' : 'Only an institution admin can change these.'}
      </p>
      {SERVICE_GROUPS.map((g) => (
        <section key={g.key} aria-labelledby={`group-${g.key}`} className="space-y-3">
          <div>
            <h2 id={`group-${g.key}`} className="text-base font-semibold">
              {g.label}
            </h2>
            <p className="text-sm text-muted-foreground">{g.blurb}</p>
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
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
}) {
  const id = `svc-${s.key}`
  const needsLink = setting.on && s.memberCard && !serviceTarget(s, setting)
  const summary = [
    setting.audience.length ? setting.audience.map((a) => AUDIENCE_LABELS[a]).join(', ') : s.memberCard ? 'No audience' : null,
    s.memberCard ? `By ${(setting.provider === 'college' ? ours : PROVIDER_LABELS[setting.provider]).replace(/^Your /, 'your ')}` : null,
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
      {expanded && setting.on && canEdit && <ServiceSettingsForm id={id} service={s} setting={setting} onSave={onSave} pending={pending} ours={ours} offices={offices} audiences={audiences} />}
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
}: {
  id: string
  service: Service
  setting: ServiceSetting
  onSave: (patch: Partial<ServiceSetting>) => void
  pending: boolean
  ours: string
  offices: readonly string[]
  audiences: Audience[]
}) {
  const [audience, setAudience] = useState<Audience[]>(setting.audience)
  const [ownerOffice, setOwnerOffice] = useState(setting.ownerOffice)
  const [ownerName, setOwnerName] = useState(setting.ownerName ?? '')
  const [pricing, setPricing] = useState<Pricing>(setting.pricing)
  const [linkUrl, setLinkUrl] = useState(setting.linkUrl ?? '')
  const [provider, setProvider] = useState<Provider>(setting.provider)

  return (
    <form
      id={`${id}-settings`}
      className="mt-4 grid gap-4 rounded-md border border-border bg-background p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault()
        onSave({ audience, ownerOffice, ownerName: ownerName || null, pricing, linkUrl: linkUrl || null, provider })
      }}
    >
      {s.memberCard && (
        <fieldset className="space-y-1.5 sm:col-span-2">
          <legend className="text-sm font-medium">Who provides it</legend>
          {s.builtIn ? (
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PROVIDER_LABELS) as Provider[]).map((p) => (
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
          ) : (
            <p className="text-sm text-muted-foreground">{ours}. NextChapter doesn’t offer this one, so add your link below.</p>
          )}
          <p className="text-xs text-muted-foreground">
            {provider === 'college' ? 'Your own office delivers it; the card opens your link.' : provider === 'nextchapter' ? 'NextChapter delivers it inside the portal at no extra work for your staff.' : 'Members get yours first, and NextChapter’s too.'}
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
          <Label htmlFor={`${id}-link`}>{provider === 'both' ? 'Your link (optional)' : 'Your link'}</Label>
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
