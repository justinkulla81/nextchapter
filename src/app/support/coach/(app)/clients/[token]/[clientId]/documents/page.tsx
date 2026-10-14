import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCoachByToken, getCoachClient } from '@/lib/coach/access'
import { listRequesterRequests } from '@/lib/documents/requests'
import { isDocumentStatus, requesterCanCancel, requesterCanReview } from '@/lib/documents/status'
import { CoachBrandHeader } from '@/components/coach/CoachBrandHeader'
import { DocumentRequestForm } from '@/components/coach/DocumentRequestForm'
import { CancelRequestButton, DocumentReviewControls } from '@/components/coach/DocumentReviewControls'
import { DocumentStatusBadge } from '@/components/documents/DocumentStatusBadge'
import { OpenDocumentButton } from '@/components/documents/OpenDocumentButton'
import { getClientDocumentUrl } from '@/app/support/coach/(app)/clients/[token]/[clientId]/documents/actions'

export default async function ClientDocumentsPage({ params }: { params: Promise<{ token: string; clientId: string }> }) {
  const { token, clientId } = await params
  const coach = await getCoachByToken(token)
  if (!coach) notFound()
  const client = await getCoachClient(coach.id, clientId)
  if (!client) notFound()

  const requests = await listRequesterRequests({ type: 'COACH', id: coach.id, label: coach.fullName }, client.id)
  const name = [client.firstName, client.lastName].filter(Boolean).join(' ') || 'Your client'
  const getUrl = getClientDocumentUrl.bind(null, token, clientId)

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link href={`/support/coach/clients/${token}/${clientId}`} className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to the pre-session brief
      </Link>
      <div className="mt-4 mb-8 space-y-1">
        <CoachBrandHeader firmName={coach.firmName} logoUrl={coach.logoUrl} />
        <h1 className="text-2xl font-semibold tracking-tight">Documents from {name}</h1>
        <p className="text-muted-foreground">Ask for a document, then review it here. Only you and {name} can see what they upload.</p>
      </div>

      <section className="space-y-3 rounded-lg border border-border p-4" aria-labelledby="request-heading">
        <h2 id="request-heading" className="text-lg font-semibold tracking-tight">
          Ask for a document
        </h2>
        <DocumentRequestForm token={token} clientId={clientId} />
      </section>

      <section className="mt-8 space-y-3" aria-labelledby="requests-heading">
        <h2 id="requests-heading" className="text-lg font-semibold tracking-tight">
          Your requests
        </h2>
        {requests.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">You have not asked {name} for anything yet.</p>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => {
              const status = isDocumentStatus(r.status) ? r.status : 'REQUESTED'
              return (
                <li key={r.id} className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{r.title}</p>
                    <DocumentStatusBadge status={r.status} audience="requester" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Asked {r.createdAt.toLocaleDateString('en-US', { dateStyle: 'medium' })}
                    {r.dueAt ? `, due ${r.dueAt.toLocaleDateString('en-US', { dateStyle: 'medium' })}` : ''}
                    {r.uploadedAt ? `. Uploaded ${r.uploadedAt.toLocaleDateString('en-US', { dateStyle: 'medium' })}` : ''}.
                  </p>
                  {r.fileName && (
                    <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span>{r.fileName}</span>
                      <OpenDocumentButton requestId={r.id} fileName={r.fileName} getUrl={getUrl} />
                    </p>
                  )}
                  {status === 'NEEDS_CHANGES' && r.reviewNote && <p className="text-sm text-muted-foreground">You asked for changes: {r.reviewNote}</p>}
                  {requesterCanReview(status) && <DocumentReviewControls token={token} clientId={clientId} requestId={r.id} />}
                  {requesterCanCancel(status) && <CancelRequestButton token={token} clientId={clientId} requestId={r.id} title={r.title} />}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
