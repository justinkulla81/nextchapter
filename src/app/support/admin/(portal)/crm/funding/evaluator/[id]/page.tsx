import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { SubmitButton } from '@/components/ui/submit-button'
import { formatDate } from '@/lib/crm/labels'
import { getEvaluation } from '@/lib/bid-evaluator/store'
import { FACT_DEFS } from '@/lib/bid-evaluator/facts'
import { ROUTE_LABEL, VERDICT_LABEL, type EvalResult, type GateStatus, type Route, type Verdict } from '@/lib/bid-evaluator/evaluate'
import type { Profile } from '@/lib/bid-evaluator/profile'
import type { Draft } from '@/lib/bid-evaluator/draft'
import { draftAction, evaluateOneAction } from '../actions'

export const maxDuration = 300

const GATE_TONE: Record<GateStatus, string> = {
  PASS: 'text-emerald-800', FIXABLE: 'text-amber-800', SUB_ONLY: 'text-sky-800', BLOCK: 'text-rose-800', UNKNOWN: 'text-muted-foreground',
}
const GATE_LABEL: Record<GateStatus, string> = { PASS: 'Met', FIXABLE: 'Fixable', SUB_ONLY: 'Sub only', BLOCK: 'Blocks us', UNKNOWN: 'Unknown' }
const STATUS_LABEL: Record<string, string> = { FILLED: 'Filled', DRAFTED: 'Drafted', MISSING_FACT: 'Missing fact', OWNER_ACTION: 'You do this' }

export default async function EvaluationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireAdmin()
  const { id } = await params
  const sp = await searchParams
  const row = await getEvaluation(id)
  if (!row) notFound()
  const p = row.profile as unknown as Profile | null
  const r = row.result as unknown as (EvalResult & { competitorsInText?: string[] }) | null
  const d = row.draft as unknown as Draft | null
  const canDraft = !!p && !!r && ['GO', 'GO_SUB', 'RFI', 'WATCH'].includes(row.verdict ?? '')
  const factLabel = (k: string) => FACT_DEFS.find((f) => f.key === k)?.label ?? k

  return (
    <div className="max-w-4xl space-y-8">
      <header className="space-y-2">
        <p className="text-sm"><Link href="/support/admin/crm/funding/evaluator" className="underline">← Evaluator</Link></p>
        <h1 className="text-2xl font-semibold">{row.title}</h1>
        <p className="text-sm text-muted-foreground">
          {row.issuer ?? 'Unknown issuer'}{row.state ? ` · ${row.state}` : ''} · {row.dueAt ? `Due ${formatDate(row.dueAt)}` : 'No due date'} ·{' '}
          <a href={row.url} target="_blank" rel="noreferrer" className="underline">Listing</a>
          {row.docUrls.slice(1).map((u, i) => <span key={u}> · <a href={u} target="_blank" rel="noreferrer" className="underline">Document {i + 1}</a></span>)}
        </p>
        {sp.error && <p className="rounded-md bg-rose-50 p-2 text-sm text-rose-900">{sp.error}</p>}
      </header>

      {/* Act on this */}
      <section className="space-y-3 rounded-lg bg-amber-50/60 p-4">
        <p className="text-lg font-medium">{VERDICT_LABEL[(row.verdict ?? 'UNREAD') as Verdict]}{row.route && row.route !== 'NONE' ? ` · ${ROUTE_LABEL[row.route as Route]}` : ''}</p>
        <p className="text-sm">{row.fetchError ? `Could not read the document: ${row.fetchError} Open the listing and paste the document link into the CRM row, or read it by hand.` : r?.headline}</p>
        {p?.summary && <p className="text-sm text-muted-foreground">{p.summary}</p>}
        {r && r.nextSteps.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm">{r.nextSteps.map((s) => <li key={s}>{s}</li>)}</ul>
        )}
        {r && r.missingFacts.length > 0 && (
          <p className="text-sm">Facts that would settle the unknowns: {r.missingFacts.map(factLabel).join(', ')}. <Link href="/support/admin/crm/funding/company-facts" className="underline">Fill in company facts</Link></p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {canDraft && (
            <form action={draftAction}>
              <input type="hidden" name="id" value={row.id} />
              <SubmitButton pendingLabel="Drafting (1–3 minutes)…" savedLabel="Drafted">{d ? 'Redraft the response' : 'Draft the response'}</SubmitButton>
            </form>
          )}
          {!canDraft && p && <span className="text-sm text-muted-foreground">Drafting is offered for Go, Go as sub, RFI and Watch verdicts.</span>}
          <form action={evaluateOneAction}>
            <input type="hidden" name="kind" value={row.sourceKind} />
            <input type="hidden" name="sourceId" value={row.sourceId} />
            <SubmitButton variant="outline" pendingLabel="Reading…" savedLabel="Read">Read the document again</SubmitButton>
          </form>
        </div>
      </section>

      {r && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">The questions</h2>
          <dl className="divide-y divide-border rounded-lg border border-border text-sm">
            {r.answers.map((a) => (
              <div key={a.question} className="grid gap-1 p-3 sm:grid-cols-[14rem_1fr]">
                <dt className="font-medium">{a.question}</dt>
                <dd className="text-muted-foreground">{a.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {r && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Gates</h2>
          {r.gates.length === 0 ? <p className="text-sm text-muted-foreground">No conditions found in the document.</p> : (
            <ul className="space-y-1 text-sm">
              {r.gates.map((g) => (
                <li key={g.key}><span className={`font-medium ${GATE_TONE[g.status]}`}>{GATE_LABEL[g.status]}</span> · {g.label}: {g.detail}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {r && (r.partners.length > 0 || r.pastWinners.length > 0) && (
        <section className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Who has won before</h2>
            {r.pastWinners.length === 0 ? <p className="text-sm text-muted-foreground">None found in our award data or the document.</p> : (
              <ul className="space-y-1 text-sm">{r.pastWinners.map((w, i) => (
                <li key={`${w.name}-${i}`}><span className="font-medium">{w.name}</span>{w.isCompetitor ? ' (competitor)' : ''}: {w.detail}{w.amount ? `, $${Math.round(w.amount).toLocaleString('en-US')}` : ''}</li>
              ))}</ul>
            )}
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Possible primes and partners</h2>
            {r.partners.length === 0 ? <p className="text-sm text-muted-foreground">None found in the CRM for this state.</p> : (
              <ul className="space-y-1 text-sm">{r.partners.map((pt, i) => (
                <li key={`${pt.name}-${i}`}>
                  {pt.orgId ? <Link href={`/support/admin/crm/organizations/${pt.orgId}`} className="font-medium underline">{pt.name}</Link> : <span className="font-medium">{pt.name}</span>}
                  {pt.warm ? ' (warm)' : ''}: {pt.why}
                </li>
              ))}</ul>
            )}
          </div>
        </section>
      )}

      {r && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Fit: {r.score}/100</h2>
          <ul className="space-y-1 text-sm">{r.fit.map((f) => <li key={f.factor}>{f.factor}: {f.points}/{f.max}. <span className="text-muted-foreground">{f.why}</span></li>)}</ul>
        </section>
      )}

      {d && (
        <section id="draft" className="space-y-4 rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Response draft{row.draftedAt ? ` (${formatDate(row.draftedAt)})` : ''}</h2>
            <a href={`/support/admin/crm/funding/evaluator/${row.id}/draft`} className="text-sm underline">Download as Markdown</a>
          </div>
          <div>
            <h3 className="font-medium">Checklist</h3>
            <ul className="mt-1 space-y-1 text-sm">{d.compliance.map((c, i) => <li key={i}><span className="font-medium">{STATUS_LABEL[c.status]}</span> · {c.item}: <span className="text-muted-foreground">{c.note}</span></li>)}</ul>
          </div>
          {d.sections.map((s, i) => (
            <div key={i} className="space-y-1">
              <h3 className="font-medium">{s.heading}{s.pageLimit ? ` · limit ${s.pageLimit}` : ''}{s.points != null ? ` · ${s.points} pts` : ''}</h3>
              <div className="whitespace-pre-wrap text-sm">{s.body}</div>
            </div>
          ))}
          <div>
            <h3 className="font-medium">Budget</h3>
            <ul className="mt-1 space-y-1 text-sm">{d.budget.map((b, i) => <li key={i}>{b.item} ({b.basis}): {b.amountUsd != null ? `$${b.amountUsd.toLocaleString('en-US')}` : 'rate needed'}</li>)}</ul>
            <p className="mt-1 text-sm text-muted-foreground">{d.budgetNote}</p>
          </div>
          {d.questions.length > 0 && <div><h3 className="font-medium">Questions to send</h3><ul className="list-disc pl-5 text-sm">{d.questions.map((q) => <li key={q}>{q}</li>)}</ul></div>}
          {d.missingFacts.length > 0 && <div><h3 className="font-medium">Missing</h3><ul className="list-disc pl-5 text-sm">{d.missingFacts.map((q) => <li key={q}>{q}</li>)}</ul></div>}
        </section>
      )}

      {p && (
        <details className="rounded-lg bg-muted/40 p-4 text-sm">
          <summary className="cursor-pointer font-medium">What the document asks for</summary>
          <div className="mt-3 space-y-3">
            <p>Submission: {p.submission.method ?? 'not stated'}. {p.submission.format ?? ''} {p.submission.pageLimit ? `Page limit: ${p.submission.pageLimit}.` : ''}</p>
            <p>Money: {p.money.contractType ?? 'type not stated'}{p.money.ceilingUsd ? `, up to $${p.money.ceilingUsd.toLocaleString('en-US')}` : ''}{p.money.term ? `, ${p.money.term}` : ''}{p.money.rateCaps ? `. Caps: ${p.money.rateCaps}` : ''}.</p>
            {p.scoring.length > 0 && <div><p className="font-medium">Scoring</p><ul className="list-disc pl-5">{p.scoring.map((s) => <li key={s.criterion}>{s.criterion}{s.points != null ? `: ${s.points}` : ''}</li>)}</ul>{p.minimumScore && <p>Minimum: {p.minimumScore}</p>}</div>}
            {p.responseComponents.length > 0 && <div><p className="font-medium">Response contents</p><ul className="list-disc pl-5">{p.responseComponents.map((c, i) => <li key={i}>{c.name}{c.pageLimit ? ` (${c.pageLimit})` : ''}{c.required ? '' : ' (optional)'}</li>)}</ul></div>}
            <p>Contact: {[p.contact.name, p.contact.email, p.contact.phone].filter(Boolean).join(', ') || 'not stated'}</p>
            {[p.whoCanApply.quote, p.trainingList.quote, p.subcontracting.quote, p.place.quote, p.requirements.quote, p.money.quote].filter(Boolean).length > 0 && (
              <div><p className="font-medium">Quotes</p><ul className="list-disc pl-5 text-muted-foreground">{[p.whoCanApply.quote, p.trainingList.quote, p.subcontracting.quote, p.place.quote, p.requirements.quote, p.money.quote].filter(Boolean).map((q) => <li key={q!}>“{q}”</li>)}</ul></div>
            )}
          </div>
        </details>
      )}
    </div>
  )
}
