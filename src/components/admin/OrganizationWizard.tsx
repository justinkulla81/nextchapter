'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { usePostHog } from '@/lib/posthog/client'
import { PORTALS, type PortalType } from '@/lib/organizations/portals'
import { stagedSummary } from '@/lib/forms/staged'
import { accentReadableOnWhite, normalizeHex } from '@/lib/partners/brand'
import { createOrganizationAction } from '@/app/support/admin/(portal)/organizations/actions'

const STEPS = [
  { label: 'Organization', minutes: 1 },
  { label: 'Portals', minutes: 1 },
  { label: 'Brand', minutes: 1 },
  { label: 'Live or demo', minutes: 1 },
]
const SWATCHES = ['#1d6fb8', '#7a1f2b', '#0f6b4d', '#5b3a8c', '#b4531a', '#1f2937']
const SCENARIOS = ['Light', 'Realistic', 'Large']

type Result = Awaited<ReturnType<typeof createOrganizationAction>>

export function OrganizationWizard({ crm }: { crm?: { id: string; name: string; domain: string | null } | null }) {
  const posthog = usePostHog()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(crm?.name ?? '')
  const [domain, setDomain] = useState(crm?.domain ?? '')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [portals, setPortals] = useState<PortalType[]>([])
  const [brandName, setBrandName] = useState('')
  const [accent, setAccent] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [logo, setLogo] = useState<File | null>(null)
  const [mode, setMode] = useState<'demo' | 'live'>('demo')
  const [scenario, setScenario] = useState('Realistic')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [pending, start] = useTransition()

  const accentOk = !accent || !!normalizeHex(accent)
  const needsContact = mode === 'live' && portals.some((p) => p !== 'HIGHER_ED')

  function next() {
    setError(null)
    if (step === 0 && !name.trim()) return setError('Enter the organization’s name to continue.')
    if (step === 1 && portals.length === 0) return setError('Choose at least one portal to continue.')
    if (step === 2 && !accentOk) return setError('Brand color must look like #1d6fb8.')
    setStep((s) => Math.min(STEPS.length - 1, s + 1))
  }

  function create() {
    setError(null)
    if (needsContact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) return setError('Enter the first admin’s email so they can be invited.')
    const fd = new FormData()
    fd.set('name', name)
    fd.set('domain', domain)
    fd.set('contactName', contactName)
    fd.set('contactEmail', contactEmail)
    portals.forEach((p) => fd.append('portal', p))
    fd.set('brandName', brandName)
    fd.set('accent', accent)
    fd.set('logoUrl', logoUrl)
    if (logo) fd.set('logo', logo)
    fd.set('mode', mode)
    fd.set('demoScenario', scenario)
    if (crm) fd.set('crmOrganizationId', crm.id)
    start(async () => {
      const r = await createOrganizationAction(fd)
      if (!r.ok) return setError(r.error)
      posthog?.capture('organization_wizard_completed', { portals, mode, fromCrm: Boolean(crm) })
      setResult(r)
    })
  }

  if (result?.ok) {
    return (
      <div className="space-y-4 rounded-lg border border-border p-5" role="status">
        <h2 className="text-lg font-semibold">Created {name}</h2>
        <p className="text-sm text-muted-foreground">
          {mode === 'demo' ? 'A demo organization, marked as sample data and set to expire in 30 days.' : 'A live organization.'} Address:{' '}
          <code className="rounded bg-muted px-1.5 py-0.5">/p/{result.slug}</code>
        </p>
        <ul className="space-y-2">
          {result.links.map((l) => (
            <li key={l.type} className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">{l.label}</p>
              <p className="text-muted-foreground">{l.note}</p>
              <p className="mt-1 break-all">
                {l.href.startsWith('http') ? <code className="text-xs">{l.href}</code> : <Link href={l.href} className="font-medium text-primary underline underline-offset-4">Open {l.href}</Link>}
              </p>
            </li>
          ))}
        </ul>
        <div className="flex gap-3">
          <Link href={`/support/admin/organizations/${result.organizationId}`} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            Open the organization
          </Link>
          <Link href="/support/admin/organizations/new" className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold">
            Create another
          </Link>
        </div>
      </div>
    )
  }

  const input = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm'
  return (
    <div className={`space-y-5 rounded-lg border border-border p-5 ${pending ? 'cursor-wait' : ''}`}>
      <ol className="flex flex-wrap gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s.label} aria-current={i === step ? 'step' : undefined} className={`rounded-full px-3 py-1 text-xs font-medium ${i === step ? 'bg-navy text-white' : 'bg-muted text-muted-foreground'}`}>
            {s.label}
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">{stagedSummary(STEPS, step)} Your answers are kept if you go back.</p>

      {step === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium" htmlFor="o-name">
            Organization name
            <input id="o-name" className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </label>
          <label className="space-y-1.5 text-sm font-medium" htmlFor="o-domain">
            Email domain (identifies their people)
            <input id="o-domain" className={input} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="riverside.edu" autoComplete="off" />
          </label>
          <label className="space-y-1.5 text-sm font-medium" htmlFor="o-cn">
            First admin’s name
            <input id="o-cn" className={input} value={contactName} onChange={(e) => setContactName(e.target.value)} autoComplete="off" />
          </label>
          <label className="space-y-1.5 text-sm font-medium" htmlFor="o-ce">
            First admin’s email
            <input id="o-ce" className={input} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} autoComplete="off" />
          </label>
        </div>
      )}

      {step === 1 && (
        <fieldset className="space-y-2">
          <legend className="sr-only">Portals</legend>
          {PORTALS.map((p) => (
            <label key={p.type} className={`flex items-start gap-3 rounded-md border border-border p-3 text-sm ${p.available ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
              <input
                type="checkbox"
                className="mt-1"
                disabled={!p.available}
                checked={portals.includes(p.type)}
                onChange={(e) => setPortals((cur) => (e.target.checked ? [...cur, p.type] : cur.filter((t) => t !== p.type)))}
              />
              <span>
                <span className="font-medium">{p.label}</span>
                <span className="block text-muted-foreground">{p.available ? p.blurb : 'Being built separately. It will reuse the higher-ed engine and be addable here when ready.'}</span>
              </span>
            </label>
          ))}
          <p className="text-xs text-muted-foreground">Choose one or several. One organization, one brand, a switcher between portals.</p>
        </fieldset>
      )}

      {step === 2 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium" htmlFor="o-bn">
            Brand name (shown in the portal’s top bar)
            <input id="o-bn" className={input} value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder={name} autoComplete="off" />
          </label>
          <label className="space-y-1.5 text-sm font-medium" htmlFor="o-ac">
            Brand color
            <input id="o-ac" className={input} value={accent} onChange={(e) => setAccent(e.target.value)} placeholder="#1d6fb8" maxLength={7} autoComplete="off" aria-invalid={!accentOk} />
            {accent && accentOk && !accentReadableOnWhite(normalizeHex(accent) as string) && (
              <span className="block text-xs font-normal text-muted-foreground">Very light against white, so links and charts in it may be hard to see. The top-bar rule still looks fine.</span>
            )}
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2" role="group" aria-label="Quick colors">
            {SWATCHES.map((c) => (
              <button key={c} type="button" onClick={() => setAccent(c)} aria-label={`Use ${c}`} aria-pressed={accent.toLowerCase() === c} className={`size-8 rounded-md border-2 ${accent.toLowerCase() === c ? 'border-foreground' : 'border-transparent'}`} style={{ backgroundColor: c }} />
            ))}
          </div>
          <label className="space-y-1.5 text-sm font-medium" htmlFor="o-logo">
            Logo (png or jpg, up to 3 MB)
            <input id="o-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} className="block text-sm font-normal" />
          </label>
          <label className="space-y-1.5 text-sm font-medium" htmlFor="o-logo-url">
            Or a logo link (https)
            <input id="o-logo-url" className={input} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" autoComplete="off" />
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">This organization is</legend>
            <div className="flex flex-wrap gap-2">
              {(['demo', 'live'] as const).map((m) => (
                <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`rounded-full border px-4 py-2 text-sm font-medium ${mode === m ? 'border-navy bg-navy text-white' : 'border-border'}`}>
                  {m === 'demo' ? 'A demo' : 'Live (a real customer)'}
                </button>
              ))}
            </div>
          </fieldset>
          {mode === 'demo' ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Sample data only, kept out of real numbers, no real emails sent, expires in 30 days. Uses the brand from the last step so the prospect sees their own logo and color.</p>
              <fieldset>
                <legend className="mb-1 text-sm font-medium">Amount of sample data</legend>
                <div className="flex flex-wrap gap-2">
                  {SCENARIOS.map((s) => (
                    <button key={s} type="button" aria-pressed={scenario === s} onClick={() => setScenario(s)} className={`rounded-full border px-4 py-1.5 text-sm ${scenario === s ? 'border-navy bg-navy text-white' : 'border-border'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Real customer. Each portal is created and the first admin gets an invite link. Outplacement still needs a contract (tier, seats, term) after this.</p>
          )}
          <div className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{name || 'Unnamed organization'}</p>
            <p className="text-muted-foreground">
              {portals.length ? PORTALS.filter((p) => portals.includes(p.type)).map((p) => p.label).join(', ') : 'No portals chosen'} · {mode === 'demo' ? `demo, ${scenario.toLowerCase()} data` : 'live'}
            </p>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => { setError(null); setStep((s) => Math.max(0, s - 1)) }} disabled={step === 0 || pending} className="rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={next} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            Continue
          </button>
        ) : (
          <button type="button" onClick={create} disabled={pending} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-wait disabled:opacity-60">
            {pending ? 'Creating…' : mode === 'demo' ? 'Create demo site' : 'Create organization'}
          </button>
        )}
      </div>
    </div>
  )
}
