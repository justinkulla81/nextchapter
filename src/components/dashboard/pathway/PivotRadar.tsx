import { updateIndustryInterest, updatePivotStance } from '@/app/dashboard/pivot-paths/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Label } from '@/components/ui/label'
import { PIVOT_FEELINGS, PIVOT_STANCES, stanceLabel, stanceOf, type PivotDetails, type PivotFeeling, type PivotInterests, type PivotStance, type PivotTarget } from '@/lib/journey/pivot'
import { POSITIVE_FEELING_LABEL, POSITIVE_STANCE_LABEL } from '@/lib/journey/pivot-parts'

const month = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
// The redesigned page says every state in the direction of the next step (docs/open-decisions.md, item 11).
const feelingText = (k: PivotFeeling, positive: boolean) => (positive ? POSITIVE_FEELING_LABEL[k] : PIVOT_FEELINGS.find((f) => f.key === k)?.label ?? k)
const stanceText = (s: PivotStance, positive: boolean) => (positive ? POSITIVE_STANCE_LABEL[s] : stanceLabel(s))
const selectClass = 'h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground'

function Story({ t, positive }: { t: PivotTarget; positive: boolean }) {
  const h = (t.history ?? []).slice(-3)
  if (h.length === 0) return null
  return (
    <ul className="space-y-0.5 text-xs text-muted-foreground">
      {h.map((e) => (
        <li key={e.at}>
          {month(e.at)}: {stanceText(e.stance, positive).toLowerCase()}
          {e.feeling ? `, feeling ${feelingText(e.feeling, positive).toLowerCase()}` : ''}
          {e.note ? `. "${e.note}"` : ''}
        </li>
      ))}
    </ul>
  )
}

function Card({ t, positive }: { t: PivotTarget; positive: boolean }) {
  const stance = stanceOf(t)
  const aside = stance === 'SET_ASIDE'
  return (
    <article className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <h3 className="font-semibold">{t.function}</h3>
        <p className="text-sm text-muted-foreground">
          {stanceText(stance, positive)}
          {t.since ? ` · since ${month(t.since)}` : ''}
          {t.feeling ? ` · ${feelingText(t.feeling, positive).toLowerCase()}` : ''}
        </p>
        <p className="text-xs text-muted-foreground">{PIVOT_STANCES.find((s) => s.key === stance)!.hint}</p>
      </div>
      <Story t={t} positive={positive} />
      <form action={updatePivotStance} className="space-y-2">
        <input type="hidden" name="target" value={t.function} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`feel-${t.function}`}>How does it feel right now?</Label>
            <select id={`feel-${t.function}`} name="feeling" defaultValue={t.feeling ?? ''} className={selectClass}>
              <option value="">Skip this</option>
              {PIVOT_FEELINGS.map((f) => (
                <option key={f.key} value={f.key}>
                  {positive ? POSITIVE_FEELING_LABEL[f.key] : f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-48 flex-1 space-y-1.5">
            <Label htmlFor={`note-${t.function}`}>A note to your future self (optional)</Label>
            <input id={`note-${t.function}`} name="note" maxLength={200} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {aside ? (
            <SubmitButton size="sm" name="stance" value="WONDERING">
              Bring it back to my radar
            </SubmitButton>
          ) : (
            <>
              {stance !== 'WONDERING' && stance !== 'PREPARING' && stance !== 'GOING_FOR_IT' && (
                <SubmitButton size="sm" variant="outline" name="stance" value="WONDERING">
                  Keep it on my radar
                </SubmitButton>
              )}
              {stance === 'WONDERING' && (
                <SubmitButton size="sm" name="stance" value="TRYING">
                  I am trying it out
                </SubmitButton>
              )}
              <SubmitButton size="sm" variant="outline" name="stance" value={stance}>
                Save how I feel
              </SubmitButton>
              <SubmitButton size="sm" variant="outline" name="stance" value="SET_ASIDE">
                {positive ? 'Save it for later' : 'Set it aside for now'}
              </SubmitButton>
              <a href="/dashboard/search-strategy" className="self-center text-sm font-medium text-brand underline underline-offset-4">
                I am ready to plan it
              </a>
            </>
          )}
        </div>
      </form>
    </article>
  )
}

// Everything they are thinking about, in their words, with how it feels and how it has changed.
// Nothing is deleted: setting an idea aside keeps its story, and they can bring it back.
export function PivotRadar({ pivot, interests, positive = false }: { pivot: PivotDetails | null; interests: PivotInterests; positive?: boolean }) {
  const targets = pivot?.targets ?? []
  const active = targets.filter((t) => stanceOf(t) !== 'SET_ASIDE')
  const aside = targets.filter((t) => stanceOf(t) === 'SET_ASIDE')
  const industries = interests.industries
  if (targets.length === 0 && industries.length === 0) return null
  return (
    <section className="space-y-3" aria-labelledby="radar-heading">
      <div>
        <h2 id="radar-heading" className="text-lg font-semibold tracking-tight">
          Your radar
        </h2>
        <p className="text-sm text-muted-foreground">What you are thinking about, where you are with it, and how it feels. There is no deadline and nothing here changes your job search until you say so.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {active.map((t) => (
          <Card key={t.function} t={t} positive={positive} />
        ))}
      </div>
      {industries.filter((i) => !i.setAside).length > 0 && (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <h3 className="font-semibold">Industries you are looking into</h3>
          <ul className="space-y-2 text-sm">
            {industries
              .filter((i) => !i.setAside)
              .map((i) => (
                <li key={i.name} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {i.name} <span className="text-muted-foreground">· since {month(i.since)}</span>
                  </span>
                  <form action={updateIndustryInterest} className="flex gap-2">
                    <input type="hidden" name="industry" value={i.name} />
                    <SubmitButton size="sm" variant="outline" name="action" value="include">
                      Include in my job search
                    </SubmitButton>
                    <SubmitButton size="sm" variant="outline" name="action" value="aside">
                      Set it aside
                    </SubmitButton>
                  </form>
                </li>
              ))}
          </ul>
        </div>
      )}
      {(aside.length > 0 || industries.some((i) => i.setAside)) && (
        <details className="rounded-lg border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">{positive ? 'Saved for later' : 'Set aside'} ({aside.length + industries.filter((i) => i.setAside).length})</summary>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {aside.map((t) => (
              <Card key={t.function} t={t} positive={positive} />
            ))}
            {industries
              .filter((i) => i.setAside)
              .map((i) => (
                <form key={i.name} action={updateIndustryInterest} className="flex items-center justify-between gap-2 text-sm">
                  <span>{i.name}</span>
                  <input type="hidden" name="industry" value={i.name} />
                  <SubmitButton size="sm" variant="outline" name="action" value="add">
                    Bring it back
                  </SubmitButton>
                </form>
              ))}
          </div>
        </details>
      )}
    </section>
  )
}
