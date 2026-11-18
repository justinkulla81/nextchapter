'use client'

import { useActionState, useCallback, useEffect, useId, useRef, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { posthog } from '@/lib/posthog/client'
import { orgAppPath } from '@/lib/org-hosts'
import { createDemoFromOrg, createWorkforceDemo, findDemoOrgs, type DemoFormState, type DemoOrgResult } from '@/app/demo/workforce/actions'

const TYPES = [
  { key: 'WORKFORCE_BOARD', label: 'Workforce board' },
  { key: 'ECONOMIC_DEVELOPMENT', label: 'Economic development' },
  { key: 'CHAMBER', label: 'Chamber of commerce' },
  { key: 'COMMUNITY_ORG', label: 'Community organization' },
]

type Defaults = { name: string; city: string; state: string; from: string }

// The demo page (owner decision, 2026-11-17): find the organization already on file and build its demo from that record.
// Typing the organization in is the fallback, for one that is not on file. A NextChapter admin also sees demos already
// built for an organization, to open instead of making another, and does not need to give an email.
export function WorkforceDemoForm({ defaults, admin = false }: { defaults?: Defaults; admin?: boolean }) {
  const [mode, setMode] = useState<'find' | 'manual'>('find')
  const [manualPrefill, setManualPrefill] = useState<Record<string, string> | null>(null)
  const openManual = useCallback((prefill: Record<string, string> | null, reason: string) => {
    setManualPrefill(prefill)
    setMode('manual')
    posthog.capture('workforce_demo_manual_opened', { reason })
  }, [])
  return mode === 'find' ? (
    <FindOrg defaults={defaults} admin={admin} onManual={openManual} />
  ) : (
    <ManualForm defaults={defaults} admin={admin} prefill={manualPrefill} onBack={() => setMode('find')} />
  )
}

function FindOrg({ defaults, admin, onManual }: { defaults?: Defaults; admin: boolean; onManual: (prefill: Record<string, string> | null, reason: string) => void }) {
  const [q, setQ] = useState(defaults?.name ?? '')
  const [results, setResults] = useState<DemoOrgResult[] | null>(null)
  const [picked, setPicked] = useState<DemoOrgResult | null>(null)
  const [searching, startSearch] = useTransition()
  const [state, action] = useActionState<DemoFormState, FormData>(createDemoFromOrg, undefined)
  const seq = useRef(0)
  const listId = useId()
  // Results only show for a term long enough to search; set state from the search callback, never in the effect body.
  const shown = q.trim().length < 2 ? null : results

  // Search after a pause in typing; only the latest answer is kept.
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      seq.current++ // drop any answer still in flight; a short term shows no results (see shown below)
      return
    }
    const n = ++seq.current
    const t = setTimeout(() => {
      startSearch(async () => {
        const r = await findDemoOrgs(term)
        if (n === seq.current) setResults(r)
      })
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  // The server could not build from the record (no city on file, or the record is gone): carry on in the typed form.
  useEffect(() => {
    if (state?.manual) onManual(state.values ?? null, 'record_incomplete')
  }, [state, onManual])

  if (picked) {
    return (
      <form action={action} className="space-y-5">
        <input type="hidden" name="kind" value={picked.kind} />
        <input type="hidden" name="orgId" value={picked.id} />
        <input type="hidden" name="from" value={defaults?.from ?? ''} />
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Building the demo for</p>
          <p className="mt-1 text-lg font-semibold">{picked.name}</p>
          <p className="text-sm text-muted-foreground">
            {[picked.officialName, picked.typeLabel, [picked.city, picked.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
          </p>
          <button type="button" onClick={() => setPicked(null)} className="mt-3 text-sm font-medium text-primary underline underline-offset-4">
            Pick a different organization
          </button>
        </div>
        {picked.existing.length > 0 && (
          <div className="rounded-xl border border-border p-4 text-sm">
            <p className="font-medium">
              {picked.existing.length === 1 ? 'A demo for this organization already exists.' : `${picked.existing.length} demos for this organization already exist.`} Open it instead of building another:
            </p>
            <ul className="mt-2 space-y-1">
              {picked.existing.map((d) => (
                <li key={d.slug}>
                  <a href={orgAppPath(d.slug, 'workforce', '/hub')} className="font-medium text-primary underline underline-offset-4" onClick={() => posthog.capture('workforce_demo_existing_opened', { slug: d.slug, sourceOrg: `${picked.kind}:${picked.id}` })}>
                    Open the {d.name} demo
                  </a>
                  {d.createdAt && <span className="text-muted-foreground"> · made {new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="p-for">Prepared for (optional)</Label>
            <Input id="p-for" name="preparedFor" maxLength={80} defaultValue={state?.values?.preparedFor} placeholder="Name of the person you are showing it to" />
          </div>
          {!admin && (
            <div className="space-y-1.5">
              <Label htmlFor="p-email">Your work email</Label>
              <Input id="p-email" name="email" type="email" required defaultValue={state?.values?.email} />
            </div>
          )}
        </div>
        {!admin && <p className="text-xs text-muted-foreground">We don&apos;t email you anything from the demo. We may follow up once to see if it was useful.</p>}
        <SubmitButton size="lg" pendingLabel="Building the demo (about 20 seconds)…">
          {picked.existing.length > 0 ? 'Build a new demo anyway' : `Build the ${picked.name} demo`}
        </SubmitButton>
        {state?.error && !state.manual && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
      </form>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="d-find">Find your organization</Label>
        <Input
          id="d-find"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Workforce board or economic development organization, e.g. KentuckianaWorks"
          autoComplete="off"
          aria-controls={listId}
          aria-describedby="d-find-help"
        />
        <p id="d-find-help" className="text-xs text-muted-foreground">
          Every workforce board in the U.S. and the economic development organizations we know of. Type at least two letters.
        </p>
      </div>
      <div id={listId} aria-live="polite" className={searching ? 'cursor-progress' : undefined}>
        {searching && shown === null && <p className="text-sm text-muted-foreground">Searching…</p>}
        {shown !== null && shown.length === 0 && !searching && <p className="text-sm text-muted-foreground">Nothing on file matches &ldquo;{q.trim()}&rdquo;.</p>}
        {shown !== null && shown.length > 0 && (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {shown.map((r) => (
              <li key={`${r.kind}:${r.id}`}>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(r)
                    posthog.capture('workforce_demo_org_picked', { kind: r.kind, orgId: r.id, state: r.state, hasExistingDemo: r.existing.length > 0 })
                  }}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{r.name}</span>
                    <span className="block text-sm text-muted-foreground">
                      {[r.officialName, r.typeLabel, [r.city, r.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium text-primary">{r.existing.length > 0 ? 'Has a demo' : 'Choose'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-sm">
        Not listed?{' '}
        <button type="button" onClick={() => onManual(q.trim() ? { name: q.trim() } : null, 'not_listed')} className="font-medium text-primary underline underline-offset-4">
          Enter your organization yourself
        </button>
      </p>
    </div>
  )
}

function ManualForm({ defaults, admin, prefill, onBack }: { defaults?: Defaults; admin: boolean; prefill: Record<string, string> | null; onBack: () => void }) {
  const [state, action] = useActionState<DemoFormState, FormData>(createWorkforceDemo, undefined)
  // After an error the visitor's own entries come back; before that, what the search carried over, then the link's prefill.
  const v = state?.values ?? { name: prefill?.name ?? defaults?.name ?? '', anchorCity: prefill?.anchorCity ?? defaults?.city ?? '', anchorState: prefill?.anchorState ?? defaults?.state ?? '', orgType: prefill?.orgType ?? '', email: prefill?.email ?? '', preparedFor: prefill?.preparedFor ?? '' }
  const [type, setType] = useState(v.orgType || 'ECONOMIC_DEVELOPMENT')
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="from" value={defaults?.from ?? ''} />
      <button type="button" onClick={onBack} className="text-sm font-medium text-primary underline underline-offset-4">
        Back to the search
      </button>
      {prefill && !state && (
        <p className="text-sm text-muted-foreground">We filled in what we have on file. Add the main city and build the demo.</p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="d-name">Your organization</Label>
        <Input id="d-name" name="name" required maxLength={80} defaultValue={v.name} placeholder="One Louisville" />
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">What kind of organization</legend>
        <input type="hidden" name="orgType" value={type} />
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <Button key={t.key} type="button" variant={type === t.key ? 'default' : 'outline'} aria-pressed={type === t.key} onClick={() => setType(t.key)}>
              {t.label}
            </Button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="d-city">Main city</Label>
          <Input id="d-city" name="anchorCity" required maxLength={60} defaultValue={v.anchorCity} placeholder="Louisville" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="d-state">State</Label>
          <Input id="d-state" name="anchorState" required maxLength={2} defaultValue={v.anchorState} placeholder="KY" className="uppercase" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="d-radius">Miles around it</Label>
          <Input id="d-radius" name="radiusMiles" type="number" min={10} max={100} defaultValue={v.radiusMiles || '40'} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="d-for">Prepared for (optional)</Label>
          <Input id="d-for" name="preparedFor" maxLength={80} defaultValue={v.preparedFor} placeholder="Name of the person you are showing it to" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="d-color">Brand color (optional)</Label>
          <Input id="d-color" name="accentColor" maxLength={7} defaultValue={v.accentColor} placeholder="#1F5F8B" className="font-mono" />
        </div>
      </div>
      {!admin && (
        <div className="space-y-1.5">
          <Label htmlFor="d-email">Your work email</Label>
          <Input id="d-email" name="email" type="email" required defaultValue={v.email} />
          <p className="text-xs text-muted-foreground">We don&apos;t email you anything from the demo. We may follow up once to see if it was useful.</p>
        </div>
      )}
      <SubmitButton size="lg" pendingLabel="Building your demo (about 20 seconds)…">
        Build my demo
      </SubmitButton>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  )
}
