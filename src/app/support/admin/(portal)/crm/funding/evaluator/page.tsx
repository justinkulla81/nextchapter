import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { SubmitButton } from '@/components/ui/submit-button'
import { formatDate } from '@/lib/crm/labels'
import { evaluatedKeys, listEvaluations, loadCandidates, loadFacts } from '@/lib/bid-evaluator/store'
import { FACT_DEFS, isKnown } from '@/lib/bid-evaluator/facts'
import { ROUTE_LABEL, VERDICT_LABEL, type Route, type Verdict } from '@/lib/bid-evaluator/evaluate'
import { evaluateNextAction, evaluateOneAction } from './actions'

export const maxDuration = 300

const FILTERS = ['ACT', 'GO', 'GO_SUB', 'RFI', 'WATCH', 'NO', 'CLOSED', 'NOT_A_BID', 'UNREAD', 'QUEUE'] as const
const FILTER_LABEL: Record<(typeof FILTERS)[number], string> = { ACT: 'To act on', QUEUE: 'Not read yet', ...VERDICT_LABEL }
const SOURCE_LABEL: Record<string, string> = { FEDERAL: 'Federal', BOARD_BID: 'Board bid', CRM_GRANT: 'Grant / program' }
const VERDICT_TONE: Record<string, string> = {
  GO: 'bg-emerald-100 text-emerald-900', GO_SUB: 'bg-emerald-50 text-emerald-900', RFI: 'bg-sky-100 text-sky-900', WATCH: 'bg-amber-100 text-amber-900',
  NO: 'bg-muted text-muted-foreground', CLOSED: 'bg-muted text-muted-foreground', NOT_A_BID: 'bg-muted text-muted-foreground', UNREAD: 'bg-rose-50 text-rose-900',
}

/** Every open RFP, bid and grant, read and scored against NextChapter's facts. */
export default async function EvaluatorPage({ searchParams }: { searchParams: Promise<{ v?: string; error?: string; done?: string }> }) {
  await requireAdmin()
  const sp = await searchParams
  const filter = (FILTERS as readonly string[]).includes(sp.v ?? '') ? (sp.v as (typeof FILTERS)[number]) : 'ACT'

  const [evalsOrNull, cands, done, facts] = await Promise.all([
    listEvaluations().catch(() => null),
    loadCandidates(),
    evaluatedKeys().catch(() => new Set<string>()),
    loadFacts().catch(() => ({} as Record<string, string>)),
  ])
  const missingTable = evalsOrNull === null
  const evals = evalsOrNull ?? []
  const queue = cands.filter((c) => !done.has(`${c.sourceKind}:${c.sourceId}`))
  const factsMissing = FACT_DEFS.filter((d) => !isKnown(facts, d.key)).length
  const counts = Object.fromEntries(FILTERS.map((f) => [f, f === 'QUEUE' ? queue.length : f === 'ACT' ? evals.filter((e) => ['GO', 'GO_SUB', 'RFI', 'WATCH'].includes(e.verdict ?? '')).length : evals.filter((e) => e.verdict === f).length]))
  const shown = filter === 'ACT'
    ? evals.filter((e) => ['GO', 'GO_SUB', 'RFI', 'WATCH'].includes(e.verdict ?? '')).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    : evals.filter((e) => e.verdict === filter)

  const chip = (active: boolean) => `rounded-md border px-2.5 py-1 text-xs ${active ? 'border-foreground bg-muted font-medium' : 'border-border hover:bg-muted'}`

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm"><Link href="/support/admin/crm/funding" className="underline">← Open funding</Link></p>
        <h1 className="text-2xl font-semibold">RFP and grant evaluator</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Reads each opportunity’s own document and checks it against our facts: who can apply, training lists, subcontracting, who is trained
          and on what, required results, past winners, SOC 2, years in business, insurance. {queue.length} open opportunities not read yet.
        </p>
        {factsMissing > 0 && (
          <p className="max-w-2xl rounded-md bg-amber-50 p-2 text-sm text-amber-900">
            {factsMissing} of {FACT_DEFS.length} company facts are blank, so those checks show “unknown”.{' '}
            <Link href="/support/admin/crm/funding/company-facts" className="underline">Fill in company facts</Link>
          </p>
        )}
        {sp.error && <p className="rounded-md bg-rose-50 p-2 text-sm text-rose-900">{sp.error}</p>}
        {sp.done && <p className="rounded-md bg-emerald-50 p-2 text-sm text-emerald-900">Read {sp.done} more.</p>}
        {missingTable && <p className="rounded-md bg-rose-50 p-2 text-sm text-rose-900">The evaluator tables are not applied yet (prisma/manual/2026-11-24-bid-evaluator.sql).</p>}
      </header>

      <form action={evaluateNextAction}>
        <SubmitButton pendingLabel="Reading documents (about a minute each)…" savedLabel="Done" disabled={queue.length === 0}>
          Read the next 2 (soonest due)
        </SubmitButton>
        {queue.length === 0 && <span className="ml-3 text-sm text-muted-foreground">Everything open has been read.</span>}
      </form>

      <nav className="flex flex-wrap gap-2" aria-label="Filter by verdict">
        {FILTERS.map((f) => <Link key={f} href={`?v=${f}`} className={chip(filter === f)}>{FILTER_LABEL[f]} ({counts[f]})</Link>)}
      </nav>

      {filter === 'QUEUE' ? (
        queue.length === 0 ? <p className="text-sm text-muted-foreground">Nothing waiting.</p> : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {queue.slice(0, 200).map((c) => (
              <li key={`${c.sourceKind}:${c.sourceId}`} className="flex items-start justify-between gap-4 p-3 text-sm">
                <div className="min-w-0 space-y-1">
                  <a href={c.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{c.title}</a>
                  <div className="text-xs text-muted-foreground">
                    {SOURCE_LABEL[c.sourceKind]} · {c.issuer ?? 'Unknown issuer'}{c.state ? ` · ${c.state}` : ''} · {c.dueAt ? `Due ${formatDate(c.dueAt)}` : 'No due date listed'}
                  </div>
                </div>
                <form action={evaluateOneAction}>
                  <input type="hidden" name="kind" value={c.sourceKind} />
                  <input type="hidden" name="sourceId" value={c.sourceId} />
                  <SubmitButton variant="outline" size="sm" pendingLabel="Reading…" aria-label={`Read and evaluate ${c.title}`}>Read and evaluate</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{filter === 'ACT' ? 'Nothing to act on yet. Read the next few above.' : 'None.'}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {shown.map((e) => {
            const headline = (e.result as { headline?: string } | null)?.headline
            return (
              <li key={e.id} className="space-y-1 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${VERDICT_TONE[e.verdict ?? 'UNREAD']}`}>{VERDICT_LABEL[(e.verdict ?? 'UNREAD') as Verdict]}</span>
                  {e.score != null && <span className="text-xs text-muted-foreground">{e.score}/100</span>}
                  <Link href={`/support/admin/crm/funding/evaluator/${e.id}`} className="font-medium hover:underline">{e.title}</Link>
                </div>
                <div className="text-xs text-muted-foreground">
                  {SOURCE_LABEL[e.sourceKind]} · {e.issuer ?? 'Unknown issuer'}{e.state ? ` · ${e.state}` : ''} · {e.dueAt ? `Due ${formatDate(e.dueAt)}` : 'No due date'}
                  {e.route && e.route !== 'NONE' ? ` · ${ROUTE_LABEL[e.route as Route]}` : ''}{e.draftedAt ? ' · Draft ready' : ''}
                </div>
                {(headline || e.fetchError) && <p className="text-xs text-muted-foreground">{e.fetchError ? `Could not read the document: ${e.fetchError}` : headline}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
