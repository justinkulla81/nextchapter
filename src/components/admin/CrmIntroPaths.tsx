'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { SubmitButton } from '@/components/ui/submit-button'
import { addIntroPath, updateIntroPathStatus, deleteIntroPath } from '@/app/support/admin/(portal)/crm/actions'

interface Candidate { id: string; name: string; detail: string | null; isConnection: boolean }

export interface IntroPathRow {
  id: string
  connectorPersonId: string | null
  connectorName: string | null
  connectorRecordName: string | null
  relationshipNote: string | null
  strength: string
  status: string
  askedAt: string | null
}

const STRENGTH_LABEL: Record<string, string> = {
  STRONG: 'Strong', MEDIUM: 'Medium', WEAK: 'Weak', UNVERIFIED: 'Unverified',
}
const STATUS_LABEL: Record<string, string> = {
  IDENTIFIED: 'Identified', ASKED: 'Asked', INTRO_MADE: 'Intro made', DECLINED: 'Declined',
}
const STATUS_ORDER = ['IDENTIFIED', 'ASKED', 'INTRO_MADE', 'DECLINED'] as const

// "Who knows her." A target can carry several stacked routes — the source
// sheets held one free-text guess that couldn't be searched or marked asked.
export function CrmIntroPaths({
  targetPersonId, targetOrgId, targetName, paths,
}: {
  targetPersonId?: string
  targetOrgId?: string
  targetName: string
  paths: IntroPathRow[]
}) {
  const add = addIntroPath.bind(null, { personId: targetPersonId, orgId: targetOrgId })

  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">
        {targetPersonId ? `Who knows ${targetName.split(' ')[0]}` : `Who can reach ${targetName}`}
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Routes in, strongest first. A connector can be someone already in the Ecosystem, or just a name you&apos;ve heard.
      </p>

      {paths.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          No route recorded yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {paths.map((p) => <PathRow key={p.id} path={p} />)}
        </ul>
      )}

      <form action={add} className="mt-3 rounded-lg border border-border p-4">
        <h3 className="text-sm font-medium">Add a route</h3>
        <ConnectorPicker excludeId={targetPersonId ?? ''} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs">
            <span className="mb-1 block font-medium">How they know each other</span>
            <input
              name="relationshipNote" type="text"
              placeholder="Overlapping workforce-policy circles"
              className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium">How strong is it</span>
            <select name="strength" defaultValue="UNVERIFIED" className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm">
              {Object.entries(STRENGTH_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3"><SubmitButton size="sm" pendingLabel="Adding…">Add route</SubmitButton></div>
      </form>
    </section>
  )
}

function PathRow({ path }: { path: IntroPathRow }) {
  const [pending, start] = useTransition()
  const label = path.connectorRecordName ?? path.connectorName ?? 'Unknown'

  return (
    <li className={`rounded-lg border p-3 ${path.status === 'DECLINED' ? 'border-border opacity-60' : path.strength === 'STRONG' ? 'border-brand/50' : 'border-border'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {path.connectorPersonId ? (
              <Link href={`/support/admin/crm/people/${path.connectorPersonId}`} className="hover:underline">{label}</Link>
            ) : (
              <>{label} <span className="font-normal text-muted-foreground">(not a record yet)</span></>
            )}
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal">{STRENGTH_LABEL[path.strength]}</span>
          </p>
          {path.relationshipNote && <p className="mt-0.5 text-xs text-muted-foreground">{path.relationshipNote}</p>}
          {path.askedAt && (
            <p className="mt-0.5 text-xs text-muted-foreground">Asked {new Date(path.askedAt).toLocaleDateString()}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Four discrete states -> a dropdown, per design-principles.md. */}
          <select
            aria-label={`Status of the route via ${label}`}
            defaultValue={path.status}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.value as (typeof STATUS_ORDER)[number]
              start(() => { void updateIntroPathStatus(path.id, next) })
            }}
            className={`h-7 rounded border border-input bg-transparent px-1.5 text-xs ${pending ? 'cursor-progress opacity-60' : ''}`}
          >
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <form action={deleteIntroPath.bind(null, path.id)}>
            <SubmitButton size="sm" variant="outline" pendingLabel="Removing…">Remove</SubmitButton>
          </form>
        </div>
      </div>
    </li>
  )
}

// Typeahead over the CRM, with a free-text fallback. Shipping a datalist of
// 3,688 people to the browser would be absurd, so matches are fetched as you
// type; anything not picked from the list is stored as a plain name.
function ConnectorPicker({ excludeId }: { excludeId: string }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Candidate[]>([])
  const [picked, setPicked] = useState<Candidate | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(0)

  // Debounced in the change handler rather than in an effect: searching is a
  // response to the user typing, not to state settling, and driving it from an
  // effect means setting state during render-triggered work.
  function onType(value: string) {
    setPicked(null)
    setQuery(value)
    if (timer.current) clearTimeout(timer.current)
    if (value.trim().length < 2) { setResults([]); return }
    const seq = ++latest.current
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/support/admin/crm/people/search?q=${encodeURIComponent(value)}&exclude=${excludeId}`)
        // Ignore a slow response that a newer keystroke has already superseded.
        if (!res.ok || seq !== latest.current) return
        setResults(((await res.json()).people ?? []) as Candidate[])
      } catch {
        if (seq === latest.current) setResults([])
      }
    }, 200)
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <div className="mt-3">
      <label htmlFor="connector" className="mb-1 block text-xs font-medium">Who could make the introduction</label>
      <input type="hidden" name="connectorPersonId" value={picked?.id ?? ''} />
      <input type="hidden" name="connectorName" value={picked ? '' : query} />
      <input
        id="connector"
        type="text"
        autoComplete="off"
        value={picked ? picked.name : query}
        onChange={(e) => onType(e.target.value)}
        placeholder="Start typing a name, or write one that isn't in the Ecosystem"
        className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
      />
      {picked && (
        <p className="mt-1 text-xs text-muted-foreground">
          Linked to their record.{' '}
          <button type="button" onClick={() => { setPicked(null); setQuery(''); setResults([]) }} className="underline">
            Clear
          </button>
        </p>
      )}
      {!picked && results.length > 0 && (
        <ul className="mt-1 divide-y divide-border rounded-md border border-border">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => { setPicked(r); setResults([]) }}
                className="block w-full px-2 py-1.5 text-left text-xs hover:bg-muted focus-visible:bg-muted"
              >
                <span className="font-medium">{r.name}</span>
                {r.isConnection && <span className="ml-1.5 text-brand">· your connection</span>}
                {r.detail && <span className="block text-muted-foreground">{r.detail}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!picked && query.trim().length >= 2 && results.length === 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          No match — this will be saved as a name only, which is fine for a lead on a lead.
        </p>
      )}
    </div>
  )
}
