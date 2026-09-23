import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { SubmitButton } from '@/components/ui/submit-button'
import { markRuleReviewed } from './actions'

const REASON_LABEL: Record<string, string> = {
  NOT_A_REJECTION: 'Not a rejection', NOT_AN_INTERVIEW: 'Not an interview', NOT_AN_OFFER: 'Not an offer',
  NOT_AN_APPLICATION: 'Not an application', NOT_JOB_RELATED: 'Not job-related', DUPLICATE: 'Duplicate',
  WRONG_COMPANY: 'Wrong company', OTHER: 'Other',
}

/**
 * Every "this detection is wrong" a candidate reported, grouped by the rule
 * that fired. A rule with several reports is a rule to fix in
 * src/lib/email-tracking/ats-patterns.ts; one report is often a one-off.
 */
export default async function ClassificationFeedbackPage() {
  await requireAdmin()
  const open = await prisma.classificationFeedback.findMany({
    where: { reviewedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
  const groups = new Map<string, typeof open>()
  for (const f of open) {
    const key = f.matchedRule ?? '__none__'
    groups.set(key, [...(groups.get(key) ?? []), f])
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Detection feedback</h1>
        <p className="mt-1 max-w-3xl text-muted-foreground">
          Applications, rejections and interviews that candidates removed as detected wrongly, grouped by the rule
          that fired. Fix a rule with repeat reports in the email classifier, then mark it reviewed.
        </p>
      </div>
      {sorted.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">Nothing reported.</p>
      )}
      {sorted.map(([rule, items]) => (
        <section key={rule} className="rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {items.length} report{items.length === 1 ? '' : 's'} · detected as {[...new Set(items.map((i) => i.detectedAs))].join(', ')}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                {rule === '__none__' ? 'No rule recorded (detected before rules were logged)' : rule}
              </p>
            </div>
            <form action={markRuleReviewed.bind(null, rule)}>
              <SubmitButton size="sm" variant="outline" pendingLabel="Saving…">Mark reviewed</SubmitButton>
            </form>
          </div>
          <ul className="mt-3 divide-y divide-border text-sm">
            {items.slice(0, 15).map((f) => (
              <li key={f.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="font-medium">{f.subject ?? '(no subject)'}</span>
                  <span className="block text-xs text-muted-foreground">
                    {f.fromAddress ?? 'unknown sender'}{f.companyName ? ` · company read as “${f.companyName}”` : ''}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">{REASON_LABEL[f.reason] ?? f.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
