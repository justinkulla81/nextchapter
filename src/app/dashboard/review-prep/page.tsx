import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { buildCase } from '@/lib/review-prep/case'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Build your case' }

const STRENGTH_COPY = {
  STARTING: 'You are just starting your case. The gaps below are the fastest way to strengthen it.',
  BUILDING: 'Your case is taking shape. Close the gaps below and it will hold up in the room.',
  STRONG: 'Your case is strong. Practice saying it out loud, then ask.',
} as const

// Build your case: for a review, a raise or a promotion conversation. Pulls
// together what the member has already recorded, says plainly what is missing,
// and gives the three things to settle before they walk in.
export default async function ReviewPrepPage() {
  const profile = await getDashboardProfile()
  const [trackRecord, workSamples, quotes, completedReferences, learning] = await Promise.all([
    prisma.trackRecordResponse.findUnique({ where: { candidateId: profile.id } }),
    prisma.workSample.findMany({ where: { candidateId: profile.id }, orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.referenceQuote.findMany({ where: { candidateId: profile.id, approvedByCandidateAt: { not: null } }, orderBy: { approvedByCandidateAt: 'desc' }, take: 3 }),
    prisma.reference.count({ where: { candidateId: profile.id, status: 'COMPLETED' } }),
    prisma.learningBadge.findMany({ where: { candidateId: profile.id }, orderBy: { completedAt: 'desc' }, take: 10 }),
  ])
  const c = buildCase({ trackRecord, workSamples, quotes, completedReferences, learning })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Build your case</h1>
        <p className="mt-1 text-muted-foreground">
          For a review, a raise or a promotion conversation. This is what you have already recorded; it never leaves your account unless you share it.
        </p>
        <p className="mt-2 text-sm font-medium text-foreground">{STRENGTH_COPY[c.strength]}</p>
      </div>

      <section className="space-y-3" aria-labelledby="results">
        <h2 id="results" className="text-lg font-semibold">
          Results you can point to
        </h2>
        {c.results.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {c.results.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
        )}
        {c.samples.length > 0 && (
          <ul className="space-y-2 text-sm">
            {c.samples.map((s) => (
              <li key={s.title}>
                <span className="font-medium">{s.title}.</span> <span className="text-muted-foreground">{s.line}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="others">
        <h2 id="others" className="text-lg font-semibold">
          What others say
        </h2>
        {c.quotes.length > 0 ? (
          <ul className="space-y-3 text-sm">
            {c.quotes.map((q) => (
              <li key={q.theme + q.text.slice(0, 20)}>
                <p className="italic">&ldquo;{q.text}&rdquo;</p>
                <p className="text-xs text-muted-foreground">{q.theme}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No approved reference quotes yet.</p>
        )}
        {c.learning.length > 0 && <p className="text-sm text-muted-foreground">Learned this year: {c.learning.join(', ')}.</p>}
      </section>

      {c.gaps.length > 0 && (
        <section className="space-y-3" aria-labelledby="gaps">
          <h2 id="gaps" className="text-lg font-semibold">
            Strengthen your case
          </h2>
          <ul className="space-y-3 text-sm">
            {c.gaps.map((g) => (
              <li key={g.key}>
                <Link href={g.href} className="font-medium text-primary underline underline-offset-4">
                  {g.label}
                </Link>
                <p className="text-muted-foreground">{g.why}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3" aria-labelledby="settle">
        <h2 id="settle" className="text-lg font-semibold">
          Settle three things before you walk in
        </h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            <span className="font-medium">The ask.</span> A specific number or level, not &ldquo;more&rdquo;. Start from{' '}
            <Link href="/dashboard/pay" className="text-primary underline underline-offset-4">
              where your pay sits
            </Link>
            .
          </li>
          <li>
            <span className="font-medium">Your reasons.</span> Three results from above, each with a number if you can. Lead with the one your manager cares about most.
          </li>
          <li>
            <span className="font-medium">Your alternatives.</span> What you will do if the answer is no: another role, another team, a search. Knowing it changes how you ask.
          </li>
        </ol>
        <p className="text-sm text-muted-foreground">Afterward, write down what was agreed and send it the same day.</p>
      </section>

      <Button nativeButton={false} render={<Link href="/dashboard/interview-prep" />}>
        Practice the conversation
      </Button>
    </div>
  )
}
