import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { gmailComposeHref } from '@/lib/email/gmail-compose-href'
import { PageHeader } from '@/components/candidate/PageHeader'
import { TrackedAction } from '@/components/candidate/TrackedAction'
import { SubmitButton } from '@/components/ui/submit-button'
import { seniorBriefHeadline, seniorBriefReason } from '@/emails/senior-brief'
import type { ItemKind } from '@/lib/senior-brief/rules'
import { pauseSeniorBrief } from './actions'

export const metadata: Metadata = { title: 'Your Monday message' }

// Where the Monday brief's draft lands: a page we own. One headline, one action: it opens the message in the member's
// own Gmail, already addressed and written. Nothing is copied by hand and nothing is sent until they press send.
export default async function SeniorBriefDraftPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const profile = await getDashboardProfile()
  const { id } = await params
  const { from } = await searchParams
  const draft = await prisma.seniorBriefDraft.findFirst({ where: { id, candidateId: profile.id, isTest: false } })
  if (!draft || !draft.body || !draft.toEmail || !draft.contactName) notFound()

  if (from === 'senior_brief') {
    if (!draft.openedAt) await prisma.seniorBriefDraft.update({ where: { id }, data: { openedAt: new Date() } }).catch(() => {})
    captureServerEvent(profile.id, 'senior_brief_opened_dashboard', { memberId: profile.id, itemKind: draft.itemKind, draftId: draft.id, tokens: draft.inputTokens + draft.outputTokens })
  }

  const kind = draft.itemKind as ItemKind
  const eventProps = { memberId: profile.id, itemKind: draft.itemKind, draftId: draft.id, contactId: draft.contactId }
  return (
    <div className="space-y-8">
      <PageHeader
        title={seniorBriefHeadline(kind, draft.contactName, draft.companyName)}
        intro={seniorBriefReason(kind, draft.contactName, draft.companyName)}
        action={
          <TrackedAction variant="primary" external href={gmailComposeHref(draft.toEmail, draft.subject ?? '', draft.body)} event="senior_brief_draft_opened_in_gmail" properties={eventProps}>
            Open in Gmail, ready to send
          </TrackedAction>
        }
      />
      <section aria-label="The message" className="max-w-2xl space-y-2 rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          To {draft.contactName} · Subject: {draft.subject}
        </p>
        <p className="text-base whitespace-pre-wrap text-ink">{draft.body}</p>
        <p className="pt-2 text-sm text-muted-foreground">You can change anything in Gmail before you send. Nothing is sent until you press send.</p>
      </section>
      <form action={pauseSeniorBrief}>
        <input type="hidden" name="draftId" value={draft.id} />
        <SubmitButton size="sm" variant="outline" pendingLabel="Saving…" savedLabel="Paused for 90 days">
          Not for me: pause for 90 days
        </SubmitButton>
      </form>
    </div>
  )
}
