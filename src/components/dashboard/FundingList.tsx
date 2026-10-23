import type { Goal, Match } from '@/lib/benefits/match'
import { GOAL_LABEL, GOAL_ORDER } from '@/lib/benefits/match'
import { ShowMore } from '@/components/candidate/ShowMore'
import { H2 } from '@/components/candidate/ui'
import { TrackedLink } from '@/components/marketing/TrackedLink'

// The ranked funding list: three sections (move, retrain, learn), best three of each shown, the rest one click away.
const SHOWN = 3

function Row({ m, rank }: { m: Match; rank: number }) {
  const p = m.program
  return (
    <li className="space-y-1.5 rounded-2xl border border-border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-base font-semibold text-ink">{p.name}</h3>
        <span className="text-xs text-muted-foreground">{p.scope === 'STATE' && p.state ? p.state : 'Nationwide'}</span>
      </div>
      <p className="text-sm text-ink">
        <span className="font-semibold">Why it fits:</span> {m.why}
      </p>
      {p.amount && <p className="text-sm text-muted-foreground">{p.amount.length > 140 ? `${p.amount.slice(0, 137)}…` : p.amount}</p>}
      {p.eligibility && <p className="text-sm text-muted-foreground">Who qualifies: {p.eligibility.length > 160 ? `${p.eligibility.slice(0, 157)}…` : p.eligibility}</p>}
      <div className="pt-1">
        <TrackedLink
          href={p.applyUrl || p.url!}
          event="funding_program_clicked"
          properties={{ programId: p.id, category: p.category, goal: m.goal, rank, score: m.score, scope: p.scope, state: p.state, target: p.applyUrl ? 'apply' : 'details', surface: 'dashboard_funding' }}
          className="inline-flex h-10 items-center rounded-full bg-action px-5 text-sm font-semibold text-action-foreground hover:brightness-95"
        >
          {p.applyUrl ? 'Apply now' : 'See how to apply'}
        </TrackedLink>
        {p.applyUrl && p.url && p.applyUrl !== p.url && (
          <TrackedLink
            href={p.url}
            event="funding_program_clicked"
            properties={{ programId: p.id, category: p.category, goal: m.goal, rank, target: 'details', surface: 'dashboard_funding' }}
            className="ml-3 text-sm font-medium text-brand underline underline-offset-4"
          >
            Program details
          </TrackedLink>
        )}
        {p.checkedAt && <span className="ml-3 text-xs text-muted-foreground">Checked against the official page {p.checkedAt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}
      </div>
    </li>
  )
}

function Section({ goal, matches }: { goal: Goal; matches: Match[] }) {
  const { title, blurb } = GOAL_LABEL[goal]
  return (
    <section className="space-y-4" aria-labelledby={`funding-${goal}`}>
      <div>
        <H2 id={`funding-${goal}`}>
          {title} <span className="text-base font-normal text-muted-foreground">({matches.length})</span>
        </H2>
        <p className="text-sm text-muted-foreground">{blurb}</p>
      </div>
      <ul className="space-y-3">
        {matches.slice(0, SHOWN).map((m, i) => (
          <Row key={m.program.id} m={m} rank={i + 1} />
        ))}
      </ul>
      {matches.length > SHOWN && (
        <ShowMore label={`Show ${matches.length - SHOWN} more`} event="funding_show_more_opened" properties={{ goal }}>
          <ul className="space-y-3">
            {matches.slice(SHOWN).map((m, i) => (
              <Row key={m.program.id} m={m} rank={SHOWN + i + 1} />
            ))}
          </ul>
        </ShowMore>
      )}
    </section>
  )
}


export function FundingSections({ byGoal, order = GOAL_ORDER }: { byGoal: Record<Goal, Match[]>; order?: Goal[] }) {
  return (
    <>
      {order.map((g) => (byGoal[g].length > 0 ? <Section key={g} goal={g} matches={byGoal[g]} /> : null))}
    </>
  )
}
