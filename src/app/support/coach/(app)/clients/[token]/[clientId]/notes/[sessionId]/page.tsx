import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/candidate/PageHeader'
import { SessionNotesWorkspace, type WorkspaceData } from '@/components/coach/session-notes/SessionNotesWorkspace'
import { getCoachByToken, getCoachClient } from '@/lib/coach/access'
import { getWorkspace } from '@/lib/coach/session-notes-service'
import { formatDue } from '@/lib/coach/session-notes'

export const metadata: Metadata = { title: 'Session notes' }

const dateFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })

export default async function SessionNotesPage({ params }: { params: Promise<{ token: string; clientId: string; sessionId: string }> }) {
  const { token, clientId, sessionId } = await params
  const coach = await getCoachByToken(token)
  if (!coach) notFound()
  const client = await getCoachClient(coach.id, clientId)
  if (!client) notFound()
  const view = await getWorkspace(coach.id, sessionId)
  if (!view || view.member.id !== client.id) notFound()

  const sent = view.summary?.state === 'SENT'
  const data: WorkspaceData = {
    token,
    clientId,
    sessionId,
    memberFirstName: view.member.firstName,
    coachFirstName: view.coach.firstName,
    sent,
    sentAtLabel: view.summary?.sentAt ? dateFmt.format(view.summary.sentAt) : null,
    privateNotes: view.session.privateNotes,
    captures: view.captures.map((c) => ({ id: c.id, kind: c.kind, text: c.text, createdAt: c.createdAt.toISOString() })),
    summary: view.summary ? { text: view.summary.text, state: view.summary.state, aiDrafted: view.summary.aiDrafted, hasMeetNotes: view.summary.hasMeetNotes } : null,
    followUps: view.followUps.map((f) => ({ id: f.id, ownerKind: f.ownerKind, text: f.text, dueOn: f.dueOn ? f.dueOn.toISOString().slice(0, 10) : null, status: f.status })),
    topics: view.topics,
    earlierOpen: view.earlierOpen.map((f) => ({ id: f.id, ownerKind: f.ownerKind, text: f.text, dueLabel: formatDue(f.dueOn) })),
    memberSharesProgress: view.member.shared,
    manifest: { receives: view.manifest.receives, notSent: view.manifest.notSent, blockedReason: view.manifest.blockedReason },
  }

  return (
    <div className="theme-candidate theme-redesign space-y-8">
      <p className="text-sm text-muted-foreground">
        <Link href={`/support/coach/clients/${token}`} className="underline underline-offset-4">Clients</Link> <span aria-hidden>›</span>{' '}
        <Link href={`/support/coach/clients/${token}/${clientId}`} className="underline underline-offset-4">{view.member.firstName}</Link> <span aria-hidden>›</span>{' '}
        <span className="text-ink">Session notes</span>
      </p>
      <PageHeader
        title={`Notes from your session with ${view.member.firstName}`}
        intro={`${dateFmt.format(view.session.occurredAt)}. Capture as you talk, then review the draft. Nothing reaches ${view.member.firstName} until you send it.`}
      />
      <SessionNotesWorkspace data={data} />
    </div>
  )
}
