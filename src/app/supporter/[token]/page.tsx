import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { buildSupporterSummary, supporterHeadline } from '@/lib/supporters/summary'
import { CheerForm } from './CheerForm'

export const metadata: Metadata = { title: 'Cheer them on', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

// A supporter's page: no login, reached by the private link in their email.
// It shows effort in numbers and nothing else.
export default async function SupporterPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supporter = await prisma.searchSupporter.findUnique({ where: { token }, select: { name: true, candidateId: true, revokedAt: true } })
  if (!supporter || supporter.revokedAt) notFound()
  const summary = await buildSupporterSummary(supporter.candidateId)

  return (
    <main className="mx-auto max-w-md space-y-6 px-6 py-12">
      <p className="text-xl font-bold text-navy">NextChapter</p>
      <h1 className="text-2xl font-semibold tracking-tight">Hi {supporter.name}</h1>
      {summary ? (
        <>
          <p>{supporterHeadline(summary)}</p>
          <dl className="grid grid-cols-2 gap-4 rounded-xl border border-border p-4 text-center">
            {[
              ['Minutes this week', summary.minutesThisWeek],
              ['Days active', summary.daysActive],
              ['Actions done', summary.actionsDone],
              ['Messages sent', summary.messagesSent],
            ].map(([k, v]) => (
              <div key={k as string}>
                <dd className="text-2xl font-semibold tabular-nums">{v}</dd>
                <dt className="text-xs text-muted-foreground">{k}</dt>
              </div>
            ))}
          </dl>
          <CheerForm token={token} />
        </>
      ) : (
        <p>Updates are paused right now. Thank you for being there.</p>
      )}
      <p className="text-xs text-muted-foreground">You only ever see effort, never names, companies or messages.</p>
    </main>
  )
}
