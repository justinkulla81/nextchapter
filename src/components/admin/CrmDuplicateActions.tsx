'use client'

import { useState, useTransition } from 'react'
import { addManualAlias, decideAbbreviation, dismissDuplicateGroup, mergeCompanyGroup, mergeOrganizationGroup, type DuplicateResult } from '@/app/support/admin/(portal)/crm/duplicates/actions'

function useAction() {
  const [pending, start] = useTransition()
  const [result, setResult] = useState<DuplicateResult | null>(null)
  const run = (fn: () => Promise<DuplicateResult>) =>
    start(async () => {
      try { setResult(await fn()) } catch { setResult({ ok: false, error: 'Something went wrong and nothing was changed. Reload the page and try again.' }) }
    })
  return { pending, result, run }
}

const quiet = 'h-7 rounded-md border border-border px-2 text-xs hover:bg-muted'
const danger = 'h-7 rounded-md border border-red-600 px-2 text-xs text-red-700 hover:bg-red-50'

function Result({ result }: { result: DuplicateResult | null }) {
  if (!result) return null
  return result.ok
    ? <p role="status" className="text-xs text-muted-foreground">{result.message}</p>
    : <p role="alert" className="text-xs text-red-700">{result.error}</p>
}

export interface DuplicateMember {
  id: string
  name: string
  detail: string
  href?: string
}

/**
 * One duplicate group: the suggested record to keep is pre-selected (with the reason),
 * any other can be chosen, then Merge folds the rest into it (after a confirmation) or
 * Not duplicates dismisses the group for good.
 */
export function DuplicateGroup({
  kind, groupKey, members, suggestedId, reason, note,
}: {
  kind: 'organization' | 'company'
  groupKey: string
  members: DuplicateMember[]
  suggestedId: string
  reason: string
  note?: string
}) {
  const { pending, result, run } = useAction()
  const [keepId, setKeepId] = useState(suggestedId)
  const [confirming, setConfirming] = useState(false)
  const keep = members.find((m) => m.id === keepId) ?? members[0]
  const others = members.filter((m) => m.id !== keep.id)
  if (result?.ok) return <Result result={result} />
  return (
    <div className={`space-y-3 ${pending ? 'cursor-wait' : ''}`}>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <fieldset className="space-y-1" disabled={pending}>
        <legend className="sr-only">Record to keep. The others merge into it.</legend>
        {members.map((m) => (
          <label key={m.id} className="flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-muted/60">
            <span className="flex items-center gap-2">
              <input
                type="radio" name={`keep-${groupKey}`} value={m.id} checked={keepId === m.id}
                onChange={() => { setKeepId(m.id); setConfirming(false) }}
              />
              {m.href
                ? <a href={m.href} className="font-medium hover:underline">{m.name}</a>
                : <span className="font-medium">{m.name}</span>}
              {m.id === suggestedId && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Suggested</span>}
            </span>
            <span className="text-xs text-muted-foreground">{m.detail}</span>
          </label>
        ))}
      </fieldset>
      <p className="px-2 text-xs text-muted-foreground">Suggested: {reason}.</p>

      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 px-2 text-xs">
          <span>
            Merge {others.length === 1 ? `“${others[0].name}”` : `${others.length} records`} into “{keep.name}”?{' '}
            {kind === 'company' ? 'Their postings, resumes, intel and CRM records move to it.' : 'Their people, deals and activity move to it.'} This can’t be undone.
          </span>
          <button type="button" autoFocus className={quiet} disabled={pending} onClick={() => setConfirming(false)}>Cancel</button>
          <button
            type="button" className={danger} disabled={pending}
            onClick={() => run(() => (kind === 'company' ? mergeCompanyGroup : mergeOrganizationGroup)(keep.id, members.map((m) => m.id)))}
          >
            {pending ? 'Merging…' : 'Merge records'}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 px-2" role="group" aria-label="Decide this group">
          <button
            type="button" disabled={pending} onClick={() => setConfirming(true)}
            className="h-8 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-60"
          >
            Merge into “{keep.name}”
          </button>
          <button
            type="button" disabled={pending} className="h-8 rounded-md border border-border px-3 text-sm hover:bg-muted"
            onClick={() => run(() => dismissDuplicateGroup(kind === 'company' ? 'COMPANY' : 'ORGANIZATION', groupKey))}
          >
            {pending ? 'Saving…' : 'Not duplicates'}
          </button>
        </div>
      )}
      <Result result={result} />
    </div>
  )
}

/** Same company / Not the same, for a suggested abbreviation. */
export function AbbreviationActions({ abbreviation, full }: { abbreviation: { id: string; name: string }; full: { id: string; name: string } }) {
  const { pending, result, run } = useAction()
  const [confirming, setConfirming] = useState(false)
  if (result?.ok) return <Result result={result} />
  return (
    <div className={`space-y-1 ${pending ? 'cursor-wait' : ''}`}>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span>Treat “{abbreviation.name}” as {full.name}? Its resumes, postings and CRM record move over. This can’t be undone.</span>
          <button type="button" autoFocus className={quiet} disabled={pending} onClick={() => setConfirming(false)}>Cancel</button>
          <button type="button" className={danger} disabled={pending} onClick={() => run(() => decideAbbreviation(abbreviation.id, full.id, 'same'))}>
            {pending ? 'Saving…' : 'Yes, same company'}
          </button>
        </div>
      ) : (
        <div className="inline-flex gap-1" role="group" aria-label={`Is ${abbreviation.name} ${full.name}?`}>
          <button type="button" className={quiet} disabled={pending} onClick={() => setConfirming(true)}>Same company</button>
          <button type="button" className={quiet} disabled={pending} onClick={() => run(() => decideAbbreviation(abbreviation.id, full.id, 'different'))}>
            {pending ? 'Saving…' : 'Not the same'}
          </button>
        </div>
      )}
      <Result result={result} />
    </div>
  )
}

/** Type a name and the company it stands for, for renames the suggestions can't find. */
export function AliasForm() {
  const { pending, result, run } = useAction()
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const field = 'h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand'
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        run(async () => {
          const r = await addManualAlias(name, company)
          if (r.ok) { setName(''); setCompany('') } // keep what was typed when it fails
          return r
        })
      }}
      className={`space-y-2 ${pending ? 'cursor-wait' : ''}`}
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-xs">
          <span className="block text-muted-foreground">This name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={`${field} w-48`} placeholder="e.g. Rtx" />
        </label>
        <label className="space-y-1 text-xs">
          <span className="block text-muted-foreground">means this company</span>
          <input value={company} onChange={(e) => setCompany(e.target.value)} className={`${field} w-56`} placeholder="e.g. Raytheon" />
        </label>
        <button type="submit" disabled={pending} className="h-8 rounded-md bg-primary px-3 text-sm text-primary-foreground">
          {pending ? 'Saving…' : 'Save alias'}
        </button>
      </div>
      <Result result={result} />
    </form>
  )
}
