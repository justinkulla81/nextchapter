import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { FEEDBACK_STATUS_LABEL, HELP_AUDIENCES, HELP_FORM_KINDS, type HelpAudience, type HelpFormKind } from '@/lib/help/constants'
import { HelpFeedbackForm } from '@/components/dashboard/HelpFeedbackForm'
import { HelpConversation } from '@/components/dashboard/HelpConversation'

const day = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })

/**
 * The Help & feedback page for the employer and coach portals: one message
 * box, then the sender's own conversations and ideas with what happened to
 * them. The candidate portal has its own page (src/app/dashboard/help) in the
 * candidate redesign's layout; this one follows the partner portals' pages.
 */
export async function PortalHelpCenter({
  audience, requesterId, searchParams,
}: {
  audience: Exclude<HelpAudience, 'CANDIDATE'>
  requesterId: string
  searchParams: { request?: string; kind?: string }
}) {
  const { request: openId, kind } = searchParams
  const helpPath = HELP_AUDIENCES[audience].helpPath
  const initialKind = HELP_FORM_KINDS.some((k) => k.value === kind) ? (kind as HelpFormKind) : 'help'

  const [requests, feedback] = await Promise.all([
    prisma.helpRequest.findMany({
      where: { candidateId: requesterId, audience },
      orderBy: { lastMessageAt: 'desc' },
      take: 50,
      include: { messages: { orderBy: { createdAt: 'asc' }, select: { id: true, body: true, fromAdmin: true, createdAt: true } } },
    }),
    prisma.productFeedback.findMany({
      where: { portalUserId: requesterId, source: audience, channel: { in: ['in-app idea', 'in-app feedback'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, rawText: true, channel: true, status: true, responseNote: true, createdAt: true },
    }),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Help and feedback</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Ask us anything, report a problem, or tell us what to build next. We read every message and reply here and by email.
        </p>
      </div>

      <section aria-labelledby="new-message" className="max-w-xl space-y-4 rounded-lg border border-border p-6">
        <h2 id="new-message" className="text-lg font-semibold">Your message</h2>
        <HelpFeedbackForm contextPath={helpPath} contextTitle="" initialKind={initialKind} audience={audience} />
      </section>

      <section aria-labelledby="conversations" className="max-w-2xl space-y-3">
        <h2 id="conversations" className="text-lg font-semibold">Your conversations</h2>
        {requests.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            Nothing yet. Choose “Get help” or “Report a problem” above to start one.
          </p>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id}>
                <HelpConversation
                  audience={audience}
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

      <section aria-labelledby="ideas" className="max-w-2xl space-y-3">
        <h2 id="ideas" className="text-lg font-semibold">Your ideas and feedback</h2>
        {feedback.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            Nothing yet. Choose “Share an idea” or “Give feedback” above. When something changes because of it, you will see it here.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {feedback.map((f) => (
              <li key={f.id} className="space-y-1.5 p-4 text-sm">
                <p className="whitespace-pre-wrap">{f.rawText}</p>
                <p className="text-xs text-muted-foreground">
                  {f.channel === 'in-app idea' ? 'Idea' : 'Feedback'} · {day(f.createdAt)} · {FEEDBACK_STATUS_LABEL[f.status]}
                </p>
                {f.status === 'ADDRESSED' && f.responseNote && <p className="rounded-md bg-success/5 px-3 py-2">{f.responseNote}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-sm text-muted-foreground">
        Looking for an answer now? See the <Link href="/faq" className="font-medium text-brand underline underline-offset-4">FAQ</Link>.
      </p>
    </div>
  )
}
