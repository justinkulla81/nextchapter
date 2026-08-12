import { requireAdmin } from '@/lib/admin/auth'
import { getReportedPeerThreads } from '@/lib/messaging/peer-threads'

export const maxDuration = 30

// Prompt 85 — the ONLY admin surface into community DMs, and it's scoped
// to reported conversations only, never a general browsing view. See
// getReportedPeerThreads' own comment for why that scoping lives in the
// query, not just this page.
export default async function ReportedMessagesAdminPage() {
  await requireAdmin()

  const threads = await getReportedPeerThreads()

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reported Conversations</h1>
        <p className="mt-1 text-muted-foreground">
          Community DM conversations a candidate has reported — {threads.length} on file. This is
          the only place admin can see community DM content; unreported conversations are never
          visible here.
        </p>
      </div>

      {threads.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing reported.</p>
      ) : (
        <div className="space-y-4">
          {threads.map((thread) => (
            <div key={thread.id} className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {thread.candidateA.name} ↔ {thread.candidateB.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Reported {thread.reportedAt?.toLocaleString()}
                </p>
              </div>
              {thread.reportReason && (
                <p className="rounded-md bg-muted p-2 text-sm text-foreground">
                  &quot;{thread.reportReason}&quot;
                </p>
              )}
              <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border border-border p-3">
                {thread.messages.map((message) => {
                  const senderName =
                    message.senderCandidateId === thread.candidateA.id ? thread.candidateA.name : thread.candidateB.name
                  return (
                    <p key={message.id} className="text-sm">
                      <span className="font-medium text-foreground">{senderName}:</span>{' '}
                      <span className="text-muted-foreground">{message.body}</span>
                    </p>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
