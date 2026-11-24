import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { SubmitButton } from '@/components/ui/submit-button'
import { FACT_DEFS, LIBRARY_DEFS, isKnown, yearsInBusiness } from '@/lib/bid-evaluator/facts'
import { MISSION, VISION } from '@/lib/bid-evaluator/capabilities'
import { loadFacts, loadLibrary } from '@/lib/bid-evaluator/store'
import { saveFactsAction, saveLibraryAction } from '../evaluator/actions'

export const maxDuration = 120

const GROUPS = ['Identity', 'Registrations', 'Insurance', 'Security', 'Money', 'Track record', 'Certifications'] as const
const field = 'w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm'

/** NextChapter's own facts and reusable answers, which the evaluator checks against and the completer writes from. */
export default async function CompanyFactsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin()
  const sp = await searchParams
  const [facts, library] = await Promise.all([loadFacts().catch(() => ({} as Record<string, string>)), loadLibrary().catch(() => ({} as Record<string, string>))])
  const known = FACT_DEFS.filter((d) => isKnown(facts, d.key)).length
  const yrs = yearsInBusiness(facts, new Date())

  return (
    <div className="max-w-3xl space-y-8">
      <header className="space-y-2">
        <p className="text-sm"><Link href="/support/admin/crm/funding/evaluator" className="underline">← Evaluator</Link></p>
        <h1 className="text-2xl font-semibold">Company facts for bids and grants</h1>
        <p className="text-sm text-muted-foreground">
          {known} of {FACT_DEFS.length} filled{yrs != null ? ` · ${yrs} years in business` : ''}. A blank fact is “unknown” to the evaluator, never a guess.
          Saving re-scores every opportunity already read (no documents are read again).
        </p>
        {sp.saved && <p className="rounded-md bg-emerald-50 p-2 text-sm text-emerald-900">Saved.</p>}
      </header>

      <form action={saveFactsAction} className="space-y-8">
        {GROUPS.map((g) => (
          <fieldset key={g} className="space-y-3">
            <legend className="text-lg font-semibold">{g}</legend>
            {FACT_DEFS.filter((d) => d.group === g).map((d) => (
              <div key={d.key} className="space-y-1">
                {d.kind === 'choice' ? <span className="block text-sm font-medium">{d.label}</span> : <label htmlFor={`f-${d.key}`} className="block text-sm font-medium">{d.label}</label>}
                {d.kind === 'choice' ? (
                  <span className="flex flex-wrap gap-3 text-sm" role="radiogroup" aria-label={d.label}>
                    {['', ...(d.options ?? [])].map((o) => (
                      <label key={o || 'blank'} className="flex items-center gap-1">
                        <input type="radio" name={d.key} value={o} defaultChecked={(facts[d.key] ?? '') === o} /> {o || 'Not set'}
                      </label>
                    ))}
                  </span>
                ) : d.kind === 'longtext' ? (
                  <textarea id={`f-${d.key}`} name={d.key} defaultValue={facts[d.key] ?? ''} rows={4} className={field} />
                ) : (
                  <input id={`f-${d.key}`} name={d.key} type={d.kind === 'date' ? 'date' : 'text'} defaultValue={facts[d.key] ?? ''} className={field} />
                )}
                {d.help && <span className="block text-xs text-muted-foreground">{d.help}</span>}
              </div>
            ))}
          </fieldset>
        ))}
        <SubmitButton pendingLabel="Saving and re-scoring…">Save facts</SubmitButton>
      </form>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Reusable answers</h2>
        <p className="text-sm text-muted-foreground">The completer writes only from these and the facts above. Mission and vision are used as written: “{MISSION}” “{VISION}”</p>
        {LIBRARY_DEFS.map((d) => (
          <form key={d.key} id={`lib-${d.key}`} action={saveLibraryAction} className="space-y-1">
            <input type="hidden" name="key" value={d.key} />
            <label className="block space-y-1">
              <span className="text-sm font-medium">{d.label}</span>
              <textarea name="body" defaultValue={library[d.key] ?? ''} rows={5} className={field} />
              <span className="block text-xs text-muted-foreground">{d.help}</span>
            </label>
            <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">Save {d.label.toLowerCase()}</SubmitButton>
          </form>
        ))}
      </section>
    </div>
  )
}
