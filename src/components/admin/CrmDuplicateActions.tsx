'use client'

import { useState, useTransition } from 'react'
import { addManualAlias, decideAbbreviation, mergeCompanyGroup, mergeOrganizationGroup, type DuplicateResult } from '@/app/support/admin/(portal)/crm/duplicates/actions'

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
export function MergeGroupActions({ members, kind = 'organization' }: { members: { id: string; name: string }[]; kind?: 'organization' | 'company' }) {
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
            Merge {others.length === 1 ? `“${others[0].name}”` : `${others.length} records`} into “{keep.name}”?{' '}
            {kind === 'company' ? 'Their postings, resumes, intel and CRM records move to it.' : 'Their people, deals and activity move to it.'} This can’t be undone.
          </span>
          <button type="button" autoFocus className={quiet} disabled={pending} onClick={() => setChoice(null)}>Cancel</button>
          <button type="button" className={danger} disabled={pending} onClick={() => run(() => (kind === 'company' ? mergeCompanyGroup : mergeOrganizationGroup)(keep.id, members.map((m) => m.id)))}>
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
