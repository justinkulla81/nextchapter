'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/candidate/PageHeader'
import { RowList, type RowItem } from '@/components/candidate/RowList'
import { EmptyNote, PlainNote, SectionBlock } from '@/components/candidate/Blocks'
import { ExpansionToggle } from '@/components/dashboard/ExpansionToggle'
import { stateName } from '@/lib/pivots/scoring'
import { cityLabel } from '@/lib/jobs/added-cities'
import { strategySummary, joinList, inSentence, type SkillsIntel, type StrategyPicks, type WidenCity, type WidenStrategyView } from '@/lib/jobs/widen-strategy'
import { finishWidenStrategy } from '@/app/dashboard/find-my-job/widen/actions'

const n = (x: number) => x.toLocaleString()
const pctOf = (share: number) => `${Math.round(share)}%`

const ROUNDS = [
  { key: 'where', label: 'Where to look' },
  { key: 'what', label: 'What else to look for' },
  { key: 'skills', label: 'Your skills for it' },
] as const
type Round = (typeof ROUNDS)[number]['key']

// The Widen your search page: three short rounds (where, what else, skills), the picks summarised at the top as they are
// made, and one primary action that takes the strategy into Find a job. `preview` runs it without the server (dev-preview).
export function WidenStrategyFlow({ view, from = 'direct', preview = false }: { view: WidenStrategyView; from?: string; preview?: boolean }) {
  const router = useRouter()
  const [round, setRound] = useState<Round>('where')
  const [picks, setPicks] = useState<StrategyPicks>({ remote: view.on.remote, states: view.on.states, cities: view.on.cities, industries: view.on.industries, roles: view.on.roles })
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const roleLabel = useMemo(() => new Map(view.roles.map((r) => [r.role, r.label])), [view.roles])
  const summary = strategySummary(picks, { state: stateName, city: cityLabel, role: (r) => roleLabel.get(r) ?? r.replace(/_/g, ' ') })
  const fn = view.fnLabel ?? 'your kind of work'

  const setList = (k: 'states' | 'cities' | 'industries' | 'roles', v: string, on: boolean) =>
    setPicks((p) => ({ ...p, [k]: on ? [...new Set([...p[k], v])] : p[k].filter((x) => x.toLowerCase() !== v.toLowerCase()) }))
  const hasIndustry = (i: string) => picks.industries.some((x) => x.toLowerCase() === i.toLowerCase())

  function go(next: Round, source: string) {
    posthog.capture('search_strategy_round_opened', { round: next, from: round, source })
    setRound(next)
  }

  function finish() {
    const props = { from, places: picks.states.length + picks.cities.length + (picks.remote ? 1 : 0), cities: picks.cities.length, industries: picks.industries.length, roles: picks.roles.length, round }
    posthog.capture('search_strategy_applied', props)
    if (preview) return
    start(async () => {
      const r = await finishWidenStrategy().catch(() => ({ ok: false, error: 'We could not save your strategy. Try again.' }))
      if (!r.ok) {
        setError(r.error ?? 'We could not save your strategy. Try again.')
        return
      }
      router.push('/dashboard/find-my-job?scope=broader#job-recommendations')
    })
  }

  const cityRow = (c: WidenCity, list: string): RowItem => ({
    key: `${list}-${c.city}`,
    title: c.city,
    why: `${n(c.openNow)} open ${fn.toLowerCase()} roles${list === 'industry' && view.citiesForIndustry ? ` in ${view.citiesForIndustry.industry}` : ''}.`,
    fact: c.home ? `In ${c.stateName}, already in your search.` : `Adds the jobs within about 40 miles of ${cityLabel(c.city)}.`,
    actions: c.home ? undefined : (
      <ExpansionToggle
        quiet
        preview={preview}
        surface="widen_strategy"
        kind="city"
        value={`${c.city}|${c.state}`}
        on={picks.cities.includes(c.city)}
        onChange={(on) => setList('cities', c.city, on)}
        label={`Jobs in and around ${cityLabel(c.city)}`}
        addLabel={`Add ${cityLabel(c.city)}`}
        onLabel={`✓ ${cityLabel(c.city)} added`}
      />
    ),
  })

  const skillsBlock = (s: SkillsIntel, id: string) => (
    <SectionBlock id={id} title={`What ${s.label} jobs ask for`} why={`The skills named most in ${n(s.basis)} live ${s.label} postings, and whether your résumé shows them.`}>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink">You show</h3>
          {s.have.length === 0 ? (
            <p className="text-sm text-muted-foreground">None of the top skills are on your résumé yet. Add the ones you have.</p>
          ) : (
            <ul className="space-y-1.5">
              {s.have.map((k) => (
                <li key={k.slug} className="text-base text-ink">
                  <span aria-hidden>✓ </span>
                  {k.name} <span className="text-sm text-muted-foreground">· in {pctOf(k.share)} of postings</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink">Worth adding, if you have it</h3>
          <ul className="space-y-1.5">
            {s.missing.map((k) => (
              <li key={k.slug} className="text-base text-ink">
                <Link href={`/skills/${k.slug}`} className="underline-offset-4 hover:underline" onClick={() => posthog.capture('search_strategy_skill_opened', { skill: k.slug, scope: s.label, list: 'missing' })}>
                  {k.name}
                </Link>{' '}
                <span className="text-sm text-muted-foreground">· in {pctOf(k.share)} of postings</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SectionBlock>
  )

  // The bridge: the roles they switched on first, else the best three.
  const bridgeRoles = (() => {
    const on = view.roles.filter((r) => picks.roles.includes(r.role))
    return (on.length > 0 ? on : view.roles).slice(0, 3)
  })()

  return (
    <div className={cn('space-y-8', pending && 'cursor-wait')}>
      <PageHeader
        title="Widen your search"
        intro={`See where ${fn.toLowerCase()} jobs are, what else uses your skills, and what each one asks for. Pick what to add; nothing is added until you add it.`}
        action={
          <button
            type="button"
            onClick={finish}
            disabled={pending}
            aria-busy={pending}
            className={cn('inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95', pending && 'cursor-wait')}
          >
            {pending ? 'Saving your strategy…' : 'Search with this strategy'}
          </button>
        }
      />
      <div className="space-y-3">
        <p className="text-base text-ink" aria-live="polite">
          {summary ?? 'Nothing added yet. Pick a place, an industry or a role below, then search with it.'}
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div role="group" aria-label="Steps" className="flex flex-wrap gap-1">
          {ROUNDS.map((r, i) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={round === r.key}
              onClick={() => go(r.key, 'tabs')}
              className={cn('rounded-md border px-3 py-1.5 text-sm', round === r.key ? 'border-ink bg-muted font-semibold text-ink' : 'border-border bg-background text-foreground')}
            >
              {i + 1}. {r.label}
            </button>
          ))}
        </div>
      </div>

      {round === 'where' && (
        <>
          {view.citiesForFunction.length === 0 ? (
            view.fnLabel ? (
              <EmptyNote>City counts for {fn.toLowerCase()} jobs are updated each night and are not ready yet. Industries, related roles and your skills are in the next steps.</EmptyNote>
            ) : (
              <EmptyNote>
                Tell us your role and we will show the cities with the most jobs like it. <Link href="/dashboard/search-strategy" className="text-brand underline underline-offset-4">Add your role</Link>
              </EmptyNote>
            )
          ) : (
            <SectionBlock id="cities-fn-h" title={`Cities with the most ${fn.toLowerCase()} jobs`} why="Open roles at your level on the board today. A city you add goes into Find a job and your daily email on its own, not its whole state.">
              <RowList label={`Cities with the most ${fn} jobs`} items={view.citiesForFunction.map((c) => cityRow(c, 'function'))} />
            </SectionBlock>
          )}
          {view.citiesForIndustry && view.citiesForIndustry.cities.length > 0 && (
            <SectionBlock id="cities-ind-h" title={`Most ${fn.toLowerCase()} jobs in ${view.citiesForIndustry.industry}`} why="The same work inside your industry, where your background counts most.">
              <RowList label={`Cities for ${fn} in ${view.citiesForIndustry.industry}`} items={view.citiesForIndustry.cities.map((c) => cityRow(c, 'industry'))} />
            </SectionBlock>
          )}
          {view.remoteOpen > 0 && (
            <SectionBlock id="remote-h" title="Remote">
              <RowList
                label="Remote"
                items={[
                  {
                    key: 'remote',
                    title: `Remote ${fn.toLowerCase()} roles`,
                    why: `${n(view.remoteOpen)} open at your level, anywhere in the US.`,
                    actions: (
                      <ExpansionToggle quiet preview={preview} surface="widen_strategy" kind="remote" value="remote" on={picks.remote} onChange={(on) => setPicks((p) => ({ ...p, remote: on }))} label="Remote roles" addLabel="Add remote" onLabel="✓ Remote added" />
                    ),
                  },
                ]}
              />
            </SectionBlock>
          )}
          <NextButton onClick={() => go('what', 'next')}>Next: what else to look for</NextButton>
        </>
      )}

      {round === 'what' && (
        <>
          {view.industries.length > 0 && (
            <SectionBlock id="ind-h" title={`Industries hiring ${fn.toLowerCase()}`} why="Your kind of work, at your level, in industries you have not targeted. Your function carries; the industry is what changes.">
              <RowList
                label="Industries"
                items={view.industries.map((i) => ({
                  key: i.industry,
                  title: i.industry,
                  why: `${n(i.openNow)} open roles like yours.`,
                  actions: (
                    <ExpansionToggle quiet preview={preview} surface="widen_strategy" kind="industry" value={i.industry} on={hasIndustry(i.industry)} onChange={(on) => setList('industries', i.industry, on)} label={i.industry} addLabel="Add this industry" onLabel="✓ Added" />
                  ),
                }))}
              />
            </SectionBlock>
          )}
          {view.roles.length > 0 && (
            <SectionBlock id="roles-h" title="Related roles that use your skills" why="Jobs next to yours that people with your background move into. Each says what carries over.">
              <RowList
                label="Related roles"
                items={view.roles.slice(0, 6).map((r) => ({
                  key: r.role,
                  title: r.label,
                  why: r.carry.length > 0 ? `Your ${joinList(r.carry.slice(0, 2).map(inSentence))} carry over.` : 'Uses much of what you already do.',
                  fact: r.openNow ? `${n(r.openNow)} open roles.` : undefined,
                  actions: (
                    <ExpansionToggle quiet preview={preview} surface="widen_strategy" kind="role" value={r.role} on={picks.roles.includes(r.role)} onChange={(on) => setList('roles', r.role, on)} label={r.label} addLabel="Add this role" onLabel="✓ Added" />
                  ),
                }))}
              />
            </SectionBlock>
          )}
          {view.industries.length === 0 && view.roles.length === 0 && <EmptyNote>We need your role to suggest industries and related roles. <Link href="/dashboard/search-strategy" className="text-brand underline underline-offset-4">Add your role</Link></EmptyNote>}
          <NextButton onClick={() => go('skills', 'next')}>Next: your skills for it</NextButton>
        </>
      )}

      {round === 'skills' && (
        <>
          {view.skills ? skillsBlock(view.skills, 'skills-h') : <EmptyNote>Skills for your field show here once we know your role and enough postings name their skills.</EmptyNote>}
          {bridgeRoles.length > 0 && (
            <SectionBlock id="bridge-h" title="Your skills bridge" why="For each related role: what you already bring, and the few skills that close the gap.">
              <RowList
                label="Skills bridge"
                items={bridgeRoles.map((r) => ({
                  key: `bridge-${r.role}`,
                  title: `Into ${r.label}`,
                  why: r.carry.length > 0 ? `You bring ${joinList(r.carry.slice(0, 3).map(inSentence))}.` : 'Much of what you do carries over.',
                  fact:
                    r.toAdd.length > 0 ? (
                      <>
                        To add: {joinList(r.toAdd.slice(0, 3).map(inSentence))}.
                      </>
                    ) : (
                      'Nothing big to add.'
                    ),
                }))}
              />
            </SectionBlock>
          )}
          {view.industrySkills && skillsBlock(view.industrySkills, 'skills-ind-h')}
          <PlainNote className="text-muted-foreground">When your picks look right, use Search with this strategy at the top. You can change them here any time.</PlainNote>
        </>
      )}
    </div>
  )
}

function NextButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted">
      {children}
    </button>
  )
}
