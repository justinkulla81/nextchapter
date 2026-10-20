import type { Metadata } from 'next'
import { FileText } from 'lucide-react'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { listCandidateRequests } from '@/lib/documents/requests'
import { candidateCanUpload, isDocumentStatus, isOverdue } from '@/lib/documents/status'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { DocumentStatusBadge } from '@/components/documents/DocumentStatusBadge'
import { OpenDocumentButton } from '@/components/documents/OpenDocumentButton'
import { UploadDocumentForm } from '@/components/documents/UploadDocumentForm'
import { getMyDocumentUrl } from '@/app/dashboard/documents/actions'
import { isRedesignOn } from '@/lib/redesign/flag'
import { PageHeader } from '@/components/candidate/PageHeader'
import { ActionLink } from '@/components/candidate/ActionLink'
import { MoreDetails } from '@/components/dashboard/MoreDetails'
import { EmptyCard } from '@/components/candidate/EmptyCard'
import { documentVerdict } from '@/lib/redesign/network-account'

export const metadata: Metadata = { title: 'Documents' }

export default async function DocumentsPage() {
  const profile = await getDashboardProfile()
  const redesign = isRedesignOn(profile.email)
  let requests: Awaited<ReturnType<typeof listCandidateRequests>> = []
  let loadFailed = false
  try {
    requests = await listCandidateRequests(profile.id)
  } catch (error) {
    console.error('Failed to load document requests:', error)
    loadFailed = true
  }

  const renderRequest = (r: (typeof requests)[number]) => {
            const status = isDocumentStatus(r.status) ? r.status : 'REQUESTED'
            const overdue = isOverdue(r.dueAt, status)
            return (
              <li key={r.id} id={redesign ? `request-${r.id}` : undefined}>
                <Card>
                  <CardContent className="space-y-3 pt-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-base font-semibold text-foreground">{r.title}</h2>
                      <DocumentStatusBadge status={r.status} audience="candidate" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Asked by {r.requesterLabel}
                      {r.dueAt && (
                        <>
                          {'. '}
                          <span className={overdue ? 'font-medium text-foreground' : ''}>
                            {overdue ? 'Was due' : 'Due'} {r.dueAt.toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' })}
                          </span>
                        </>
                      )}
                      .
                    </p>
                    {r.instructions && <p className="whitespace-pre-wrap text-sm text-foreground">{r.instructions}</p>}
                    {status === 'NEEDS_CHANGES' && r.reviewNote && (
                      <p className="rounded-md border border-border bg-off-white p-3 text-sm text-foreground">
                        <span className="font-medium">What needs to change:</span> {r.reviewNote}
                      </p>
                    )}
                    {r.fileName && (
                      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>Your file: {r.fileName}</span>
                        <OpenDocumentButton requestId={r.id} fileName={r.fileName} getUrl={getMyDocumentUrl} />
                      </p>
                    )}
                    {candidateCanUpload(status) && <UploadDocumentForm requestId={r.id} title={r.title} hasFile={Boolean(r.fileName)} />}
                  </CardContent>
                </Card>
              </li>
            )
  }

  // The redesign: a document request is a title, one verdict with its reason, who asked and when, and the upload. The
  // outlined status badge and the card are gone; the status is said as what happens next.
  const renderRequestRedesign = (r: (typeof requests)[number]) => {
    const status = isDocumentStatus(r.status) ? r.status : 'REQUESTED'
    const overdue = isOverdue(r.dueAt, status)
    const { verdict, why } = documentVerdict(status, r.reviewNote ?? null, overdue)
    const due = r.dueAt ? `${overdue ? 'Was due' : 'Due'} ${r.dueAt.toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' })}.` : null
    return (
      <li key={r.id} id={`request-${r.id}`} className="scroll-mt-4 space-y-3 rounded-2xl border border-border p-5">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold text-ink">{r.title}</h2>
          <p className="text-base text-ink">
            {verdict} <span className="text-muted-foreground">{why}</span>
          </p>
          <p className="text-sm text-muted-foreground">{[`Asked by ${r.requesterLabel}.`, due].filter(Boolean).join(' ')}</p>
        </div>
        {r.instructions && <p className="whitespace-pre-wrap text-base text-ink">{r.instructions}</p>}
        {r.fileName && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Your file: {r.fileName}</span>
            <OpenDocumentButton requestId={r.id} fileName={r.fileName} getUrl={getMyDocumentUrl} />
          </p>
        )}
        {candidateCanUpload(status) && <UploadDocumentForm requestId={r.id} title={r.title} hasFile={Boolean(r.fileName)} redesign />}
      </li>
    )
  }

  if (redesign) {
    // Documents in the redesign: what you were asked for, with the upload as the action, and the older requests behind one fold.
    const needsYou = requests.filter((r) => candidateCanUpload(isDocumentStatus(r.status) ? r.status : 'REQUESTED'))
    const first = needsYou[0]
    const shown = requests.slice(0, 5)
    const rest = requests.slice(5)
    return (
      <div className="space-y-8">
        <PageHeader
          title="Documents"
          intro="Files your coach or someone else asked you for. Only the person who asked can open what you upload."
          action={first ? <ActionLink variant="primary" href={`#request-${first.id}`} event="document_upload_started" props={{ requestId: first.id, source: 'documents_header' }}>Upload {first.title}</ActionLink> : undefined}
        />
        {loadFailed ? (
          <EmptyCard title="We could not load your document requests" why="Reload the page in a moment. If it keeps happening, tell us from the help button." />
        ) : requests.length === 0 ? (
          <EmptyCard title="Nobody has asked you for a document" why="When your coach asks for something, like an offer letter or a signed form, it shows up here and we email you." />
        ) : (
          <>
            <ul className="space-y-4" aria-label="Document requests">{shown.map(renderRequestRedesign)}</ul>
            {rest.length > 0 && (
              <MoreDetails summary={`Show more: ${rest.length} more ${rest.length === 1 ? 'request' : 'requests'}`}>
                <ul className="space-y-4" aria-label="More document requests">{rest.map(renderRequestRedesign)}</ul>
              </MoreDetails>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">Documents your coach or another person has asked you for. Only the person who asked can see what you upload here.</p>
      </div>

      {loadFailed ? (
        <EmptyState icon={FileText} title="We could not load your document requests" description="Reload the page in a moment. If it keeps happening, tell us from the help button." />
      ) : requests.length === 0 ? (
        <EmptyState icon={FileText} title="Nobody has asked you for a document" description="When your coach asks for something, like an offer letter or a signed form, it will show up here and we will email you." />
      ) : (
        <ul className="space-y-4" aria-label="Document requests">
          {requests.map(renderRequest)}
        </ul>
      )}
    </div>
  )
}
