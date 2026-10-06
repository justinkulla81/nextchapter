import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { FEEDBACK_STATUS_LABEL, HELP_FORM_KINDS, type HelpFormKind } from '@/lib/help/constants'
import { HelpFeedbackForm } from '@/components/dashboard/HelpFeedbackForm'
import { HelpConversation } from '@/components/dashboard/HelpConversation'

export const metadata: Metadata = { title: 'Help & feedback' }

const day = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })

const FEEDBACK_PILL: Record<string, string> = {
  NEW: 'bg-muted text-muted-foreground',
  TRIAGED: 'bg-brand/10 text-brand',
  ADDRESSED: 'bg-success/10 text-success',
  ARCHIVED: 'bg-muted text-muted-foreground',
}

export default async function HelpAndFeedbackPage({ searchParams }: { searchParams: Promise<{ request?: string; kind?: string }> }) {
  const profile = await getDashboardData()
  const { request: openId, kind } = await searchParams
  const initialKind = HELP_FORM_KINDS.some((k) => k.value === kind) ? (kind as HelpFormKind) : 'help'

  const [requests, feedback] = await Promise.all([
    prisma.helpRequest.findMany({
      where: { candidateId: profile.id },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
      include: { messages: { orderBy: { createdAt: 'asc' }, select: { id: true, body: true, fromAdmin: true, createdAt: true } } },
    }),
    prisma.productFeedback.findMany({
      where: { candidateId: profile.id, channel: { in: ['in-app idea', 'in-app feedback'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, rawText: true, channel: true, status: true, responseNote: true, createdAt: true },
    }),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Help &amp; feedback</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Ask us anything, report a problem, or tell us what to build next. We read every message.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Looking for answers now? See the <Link href="/faq" className="text-brand underline underline-offset-4">FAQ</Link>.
          Going through a hard time? <Link href="/dashboard/support" className="text-brand underline underline-offset-4">I’m Struggling</Link> has support options.
        </p>
      </div>

      <section aria-labelledby="new-message" className="max-w-xl rounded-xl border border-border bg-white p-5">
        <h2 id="new-message" className="mb-4 text-lg font-semibold text-navy">New message</h2>
        <HelpFeedbackForm contextPath="/dashboard/help" contextTitle="" initialKind={initialKind} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="conversations" className="min-w-0">
          <h2 id="conversations" className="text-lg font-semibold text-navy">Your conversations</h2>
          <p className="mb-3 text-sm text-muted-foreground">Questions and problems. We reply here and by email.</p>
          {requests.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              Nothing yet. Choose “Get help” or “Report a problem” above to start one.
            </p>
          ) : (
            <ul className="space-y-3">
              {requests.map((r) => (
                <li key={r.id}>
                  <HelpConversation
                    request={{
                      id: r.id,
                      subject: r.subject,
                      kindLabel: r.kind === 'PROBLEM' ? 'Problem' : 'Help',
                      started: day(r.createdAt),
                      resolved: r.status === 'RESOLVED',
                      replyWaiting: r.lastMessageFromAdmin && r.lastMessageAt > r.candidateLastReadAt,
                      messages: r.messages.map((m) => ({ id: m.id, body: m.body, fromAdmin: m.fromAdmin, when: day(m.createdAt) })),
                    }}
                    defaultOpen={r.id === openId}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="ideas" className="min-w-0">
          <h2 id="ideas" className="text-lg font-semibold text-navy">Your ideas and feedback</h2>
          <p className="mb-3 text-sm text-muted-foreground">We review every one. When something changes because of it, you’ll see it here.</p>
          {feedback.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              Nothing yet. Choose “Share an idea” or “Give feedback” above.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-white">
              {feedback.map((f) => (
                <li key={f.id} className="space-y-1.5 p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 whitespace-pre-wrap text-foreground">{f.rawText}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${FEEDBACK_PILL[f.status]}`}>
                      {FEEDBACK_STATUS_LABEL[f.status]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{f.channel === 'in-app idea' ? 'Idea' : 'Feedback'} · {day(f.createdAt)}</p>
                  {f.status === 'ADDRESSED' && f.responseNote && (
                    <p className="rounded-lg bg-success/5 px-3 py-2 text-foreground">{f.responseNote}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
