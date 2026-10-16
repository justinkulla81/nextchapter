import { exploreTarget, saveExploredTarget } from '@/app/dashboard/pivot-paths/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Label } from '@/components/ui/label'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { PIVOT_REASONS, assessReason, buildPathway, costText, type PivotReason } from '@/lib/journey/pathway'
import { assessIndustryMove } from '@/lib/journey/industry-feasibility'
import { FUNCTION_PROFILES } from '@/lib/journey/pathway'
import { cn } from '@/lib/utils'

const SKIP = new Set(['General', 'Other', 'Executive Leadership'])
const selectClass = 'h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground'

function List({ title, items, empty }: { title: string; items: string[]; empty?: string }) {
  return (
    <div>
      <h4 className="text-sm font-semibold">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">{empty ?? 'Nothing to list.'}</p>
      ) : (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

// "What would it take?" The member picks a function and, if they like, why. We show what they have,
// what they need, cost, time, what is hard, and smaller ways to get what they are after. We inform and
// never block; saving puts it on their list, and committing is done on Search Strategy.
export function PathwayExplorer({
  from,
  keywords,
  seniorLevel,
  ownedFunctions,
  target,
  why,
  alreadySaved,
  currentIndustry,
  targetIndustries,
  sectorHistory,
}: {
  from: string | null
  keywords: string[]
  seniorLevel: boolean
  ownedFunctions: string[]
  target: string | null
  why: PivotReason | null
  alreadySaved: boolean
  currentIndustry: string | null
  targetIndustries: string[]
  sectorHistory: string[]
}) {
  const options = PRIMARY_FUNCTION_OPTIONS.filter((f) => f !== from && !SKIP.has(f))
  const pathway = target ? buildPathway(from, target, { keywords, seniorLevel, ownedFunctions }) : null
  const reason = pathway && why ? assessReason(from, target!, why, { seniorLevel }) : null
  const industryMoves = pathway ? targetIndustries.slice(0, 3).map((i) => assessIndustryMove(currentIndustry, i, target, { sectorHistory })) : []
  return (
    <section id="what-it-takes" className="scroll-mt-20 space-y-4 rounded-lg border border-border p-4" aria-labelledby="what-it-takes-heading">
      <div>
        <h2 id="what-it-takes-heading" className="text-lg font-semibold tracking-tight">
          What would it take?
        </h2>
        <p className="text-sm text-muted-foreground">
          Pick a field you are curious about. We show what you already have, what you would need, what it costs, how long it takes and what is hard about it.
        </p>
      </div>
      <form action={exploreTarget} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="explore-target">A field to explore</Label>
          <select id="explore-target" name="target" defaultValue={target ?? ''} className={selectClass} required>
            <option value="" disabled>
              Choose a field
            </option>
            {options.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="explore-why">What draws you to it? (optional)</Label>
          <select id="explore-why" name="why" defaultValue={why ?? ''} className={selectClass}>
            <option value="">Not sure yet</option>
            {PIVOT_REASONS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <SubmitButton size="sm">Show what it would take</SubmitButton>
      </form>

      {target && !pathway && <p className="text-sm text-muted-foreground">We do not have a map for {target} yet. Try another field.</p>}

      {pathway && (
        <div className="space-y-4">
          <div className={cn('rounded-md p-3', pathway.feasibility.tier === 'ADJACENT' ? 'bg-brand/5' : 'bg-muted/40')}>
            <p className="font-semibold">
              {from ?? 'Your field'} to {target}: {pathway.feasibility.headline}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{pathway.feasibility.detail}</p>
            {pathway.headStart && <p className="mt-1 text-sm font-medium">{pathway.headStart}</p>}
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-semibold">Time</dt>
              <dd className="text-muted-foreground">{pathway.months ? `Roughly ${pathway.months[0]} to ${pathway.months[1]} months of focused work` : 'No training needed to start looking'}</dd>
            </div>
            <div>
              <dt className="font-semibold">Pay</dt>
              <dd className="text-muted-foreground">{pathway.payNote}</dd>
            </div>
            <div>
              <dt className="font-semibold">What employers want to see</dt>
              <dd className="text-muted-foreground">{pathway.proof}</dd>
            </div>
          </dl>

          <div className="grid gap-4 sm:grid-cols-2">
            <List title="What you already have" items={pathway.have} empty="Add skills to your résumé so we can show what carries over." />
            <List title="What you would need" items={pathway.need} />
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Two ways to get there</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">Learn on your own</p>
                <p className="text-muted-foreground">{costText(pathway.cost.INFORMAL)}. {pathway.cost.INFORMAL.what}.</p>
                {pathway.feasibility.education && (
                  <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                    {pathway.feasibility.education.INFORMAL.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">Formal training</p>
                <p className="text-muted-foreground">{costText(pathway.cost.FORMAL)}. {pathway.cost.FORMAL.what}.</p>
                {pathway.feasibility.education && pathway.feasibility.education.FORMAL.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                    {pathway.feasibility.education.FORMAL.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Costs are typical ranges to plan with, not quotes. Confirm with each program.</p>
          </div>

          <List title="What is hard about it" items={pathway.challenges} />
          <List title="Roles people usually start in" items={pathway.entryRoles} />

          {industryMoves.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">The industries you picked</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {industryMoves.map((m) => (
                  <li key={m.to}>
                    <span className="font-medium text-foreground">{m.to}:</span> {m.headline}. {m.detail}
                    {m.learn.length > 0 && ` To do first: ${m.learn.join('; ')}.`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reason && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <h4 className="text-sm font-semibold">Since you said: {PIVOT_REASONS.find((r) => r.key === why)!.label.toLowerCase()}</h4>
              {reason.worth.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                  {reason.worth.map((w) => (
                    <li key={w.text}>{w.text}</li>
                  ))}
                </ul>
              )}
              {reason.alternatives.length > 0 && (
                <div>
                  <p className="text-sm font-medium">Other ways to get what you are after</p>
                  <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                    {reason.alternatives.map((a) => (
                      <li key={a.label}>
                        <span className="font-medium text-foreground">{a.label}.</span> {a.why}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {alreadySaved ? (
              <p className="text-sm text-muted-foreground">{target} is on your radar. Update how it feels in Your radar above, or plan it on Search Strategy.</p>
            ) : (
              <form action={saveExploredTarget}>
                <input type="hidden" name="target" value={target!} />
                <input type="hidden" name="why" value={why ?? ''} />
                <SubmitButton>Put {target} on my radar</SubmitButton>
              </form>
            )}
            <a href="/dashboard/search-strategy" className="text-sm font-medium text-brand underline underline-offset-4">
              Commit to a plan on Search Strategy
            </a>
          </div>
          {FUNCTION_PROFILES[target!] && <p className="text-xs text-muted-foreground">Putting it on your radar gives you a small first step to test it cheaply and no deadline. Planning it later gives you a full learning path in your weekly plan.</p>}
        </div>
      )}
    </section>
  )
}
