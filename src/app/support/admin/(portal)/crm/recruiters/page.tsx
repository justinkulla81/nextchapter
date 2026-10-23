import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { coverageCounts, recruiters } from '@/lib/crm/ecosystem'
import { FUNCTIONS, INDUSTRY_KEYS, STATE_NAMES, functionName, industryName } from '@/lib/crm/coverage'
import { RecruiterTable } from '@/components/admin/RecruiterTable'

export const maxDuration = 30
const BASE = '/support/admin/crm/recruiters'

export default async function RecruitersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin()
  const sp = await searchParams
  const state = sp.state && (STATE_NAMES[sp.state] || sp.state === 'NATIONAL') ? sp.state : ''
  const industry = sp.industry && INDUSTRY_KEYS.includes(sp.industry) ? sp.industry : ''
  const fn = sp.fn && FUNCTIONS[sp.fn] ? sp.fn : ''
  const [counts, list] = await Promise.all([coverageCounts(), recruiters({ state, industry, fn }, 500)])
  const href = (over: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ state, industry, fn, ...over }).filter(([, v]) => v) as [string, string][])
    return `${BASE}${p.size ? `?${p}` : ''}`
  }
  const chip = (active: boolean) => `rounded-md border px-2.5 py-1 text-sm ${active ? 'border-brand bg-brand text-white' : 'border-border hover:bg-muted'}`

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Recruiters</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {counts.total} recruiters, {counts.total - counts.untagged} tagged with the states, industries and functions they cover. Pick any combination; national recruiters appear under every state. These are the people the layoff alert lists for a notice in that state and industry.
        </p>
      </header>

      <section aria-labelledby="f-state" className="space-y-2">
        <h2 id="f-state" className="text-sm font-medium">State</h2>
        <div className="flex flex-wrap gap-1.5">
          <Link href={href({ state: '' })} className={chip(!state)}>Any</Link>
          <Link href={href({ state: 'NATIONAL' })} className={chip(state === 'NATIONAL')}>National ({counts.states.NATIONAL ?? 0})</Link>
          {Object.keys(STATE_NAMES).filter((s) => counts.states[s]).sort((a, b) => counts.states[b] - counts.states[a]).map((s) => (
            <Link key={s} href={href({ state: s })} className={chip(state === s)}>{s} ({counts.states[s]})</Link>
          ))}
        </div>
      </section>
      <section aria-labelledby="f-ind" className="space-y-2">
        <h2 id="f-ind" className="text-sm font-medium">Industry</h2>
        <div className="flex flex-wrap gap-1.5">
          <Link href={href({ industry: '' })} className={chip(!industry)}>Any</Link>
          {INDUSTRY_KEYS.map((k) => <Link key={k} href={href({ industry: k })} className={chip(industry === k)}>{industryName(k)} ({counts.industries[k] ?? 0})</Link>)}
        </div>
      </section>
      <section aria-labelledby="f-fn" className="space-y-2">
        <h2 id="f-fn" className="text-sm font-medium">Function</h2>
        <div className="flex flex-wrap gap-1.5">
          <Link href={href({ fn: '' })} className={chip(!fn)}>Any</Link>
          {Object.keys(FUNCTIONS).map((k) => <Link key={k} href={href({ fn: k })} className={chip(fn === k)}>{functionName(k)} ({counts.functions[k] ?? 0})</Link>)}
        </div>
      </section>

      <RecruiterTable rows={list.rows} total={list.total} localState={state && state !== 'NATIONAL' ? state : undefined} empty="No recruiters match. Widen a filter, or run the recruiter research for this state." />
    </div>
  )
}
