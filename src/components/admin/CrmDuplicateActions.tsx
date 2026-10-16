'use client'

import { useState, useTransition } from 'react'
import { decideAbbreviation, mergeOrganizationGroup, type DuplicateResult } from '@/app/support/admin/(portal)/crm/duplicates/actions'

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

/** "Keep this one" for each record in a duplicate group, with a confirmation before anything merges. */
export function MergeGroupActions({ members }: { members: { id: string; name: string }[] }) {
  const { pending, result, run } = useAction()
  const [choice, setChoice] = useState<string | null>(null)
  const keep = members.find((m) => m.id === choice)
  const others = members.filter((m) => m.id !== choice)
  if (result?.ok) return <Result result={result} />
  return (
    <div className={`space-y-2 ${pending ? 'cursor-wait' : ''}`}>
      {!keep ? (
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Keep one record">
          <span className="text-xs text-muted-foreground">Merge, keeping:</span>
          {members.map((m) => (
            <button key={m.id} type="button" className={quiet} onClick={() => setChoice(m.id)}>{m.name}</button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span>
            Merge {others.length === 1 ? `“${others[0].name}”` : `${others.length} records`} into “{keep.name}”? Their people, deals and
            activity move to it. This can’t be undone.
          </span>
          <button type="button" autoFocus className={quiet} disabled={pending} onClick={() => setChoice(null)}>Cancel</button>
          <button type="button" className={danger} disabled={pending} onClick={() => run(() => mergeOrganizationGroup(keep.id, members.map((m) => m.id)))}>
            {pending ? 'Merging…' : 'Merge records'}
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
