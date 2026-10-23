import type { Metadata } from 'next'
import Link from 'next/link'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { FEEDBACK_STATUS_LABEL, HELP_FORM_KINDS, type HelpFormKind } from '@/lib/help/constants'
import { HelpFeedbackForm } from '@/components/dashboard/HelpFeedbackForm'
import { HelpConversation } from '@/components/dashboard/HelpConversation'
import { PageHeader } from '@/components/candidate/PageHeader'
import { MoreDetails } from '@/components/dashboard/MoreDetails'

export const metadata: Metadata = { title: 'Help & feedback' }

const day = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })

export default async function HelpAndFeedbackPage({ searchParams }: { searchParams: Promise<{ request?: string; kind?: string; from?: string }> }) {
  const [profile, { request: openId, kind, from }] = await Promise.all([getDashboardProfile(), searchParams])
  // Set by the page-not-found screen: only a site path, so the message can say which address was missing.
  const reportedFrom = from && /^\/[\w\-./%]{0,200}$/.test(from) ? from : null
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

  // Questions and feedback in the redesign: one message box, then your three latest conversations and ideas.
  const visible = (list: typeof requests) => list.filter((r, i) => i < 3 || r.id === openId)
  const shownRequests = visible(requests)
  const hiddenRequests = requests.filter((r) => !shownRequests.includes(r))
  const renderRequest = (r: (typeof requests)[number]) => (
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
  )
  const renderIdea = (f: (typeof feedback)[number]) => (
    <li key={f.id} className="space-y-1.5 p-4 text-sm">
      <p className="whitespace-pre-wrap text-ink">{f.rawText}</p>
      <p className="text-xs text-muted-foreground">{f.channel === 'in-app idea' ? 'Idea' : 'Feedback'} · {day(f.createdAt)} · {FEEDBACK_STATUS_LABEL[f.status]}</p>
      {f.status === 'ADDRESSED' && f.responseNote && <p className="rounded-lg bg-success/5 px-3 py-2 text-ink">{f.responseNote}</p>}
    </li>
  )
  return (
    <div className="space-y-8">
      <PageHeader title="Help and feedback" intro="Ask us anything, report a problem, or tell us what to build next. We read every message and reply here and by email." />
      <section aria-labelledby="new-message" className="max-w-xl space-y-4 rounded-2xl border border-border p-6">
        <h2 id="new-message" className="font-display text-xl font-semibold text-ink">Your message</h2>
        <HelpFeedbackForm contextPath={reportedFrom ?? '/dashboard/help'} contextTitle={reportedFrom ? 'Page not found' : ''} initialKind={initialKind} />
      </section>
      <section aria-labelledby="conversations" className="space-y-3">
        <h2 id="conversations" className="font-display text-xl font-semibold text-ink">Your conversations</h2>
        {requests.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-base text-ink">Nothing yet. Choose “Get help” or “Report a problem” above to start one.</p>
        ) : (
          <>
            <ul className="space-y-3">{shownRequests.map(renderRequest)}</ul>
            {hiddenRequests.length > 0 && (
              <MoreDetails summary={`Show more: ${hiddenRequests.length} earlier ${hiddenRequests.length === 1 ? 'conversation' : 'conversations'}`}>
                <ul className="space-y-3">{hiddenRequests.map(renderRequest)}</ul>
              </MoreDetails>
            )}
          </>
        )}
      </section>
      <section aria-labelledby="ideas" className="space-y-3">
        <h2 id="ideas" className="font-display text-xl font-semibold text-ink">Your ideas and feedback</h2>
        {feedback.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-base text-ink">Nothing yet. Choose “Share an idea” or “Give feedback” above. When something changes because of it, you will see it here.</p>
        ) : (
          <>
            <ul className="divide-y divide-border rounded-2xl border border-border">{feedback.slice(0, 3).map(renderIdea)}</ul>
            {feedback.length > 3 && (
              <MoreDetails summary={`Show more: ${feedback.length - 3} earlier`}>
                <ul className="divide-y divide-border rounded-2xl border border-border">{feedback.slice(3).map(renderIdea)}</ul>
              </MoreDetails>
            )}
          </>
        )}
      </section>
      <p className="text-sm text-muted-foreground">
        Looking for an answer now? See the <Link href="/faq" className="font-medium text-brand underline underline-offset-4">FAQ</Link>. Going through a hard time?{' '}
        <Link href="/dashboard/support" className="font-medium text-brand underline underline-offset-4">Talk to someone</Link>.
      </p>
    </div>
  )
}
