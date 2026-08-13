import { requireAdmin } from '@/lib/admin/auth'
import { getReportedThreads } from '@/lib/messaging/peer-threads'
import { getReportedCommunityPosts } from '@/lib/community/community-feed'

export const maxDuration = 30

// Prompt 85, generalized in the Community/Messaging rework (Phase 3) — the
// ONLY admin surface into message/post content, scoped to reported items
// only, never a general browsing view. See getReportedThreads' and
// getReportedCommunityPosts' own comments for why that scoping lives in the
// query, not just this page.
export default async function ReportedMessagesAdminPage() {
  await requireAdmin()

  const [threads, posts] = await Promise.all([getReportedThreads(), getReportedCommunityPosts()])

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reported Content</h1>
        <p className="mt-1 text-muted-foreground">
          Conversations and posts a candidate has reported — {threads.length} conversation
          {threads.length === 1 ? '' : 's'}, {posts.length} post{posts.length === 1 ? '' : 's'} on
          file. This is the only place admin can see this content; unreported items are never
          visible here.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Reported conversations
        </h2>
        {threads.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing reported.</p>
        ) : (
          <div className="space-y-4">
            {threads.map((thread) => (
              <div key={thread.id} className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {thread.candidateA.name} ↔ {thread.candidateB.name}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({thread.partnerType})
                    </span>
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
                      thread.partnerType === 'PEER'
                        ? message.senderCandidateId === thread.candidateA.id
                          ? thread.candidateA.name
                          : thread.candidateB.name
                        : message.senderRole === 'CANDIDATE'
                          ? thread.candidateA.name
                          : thread.candidateB.name
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
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Reported posts
        </h2>
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing reported.</p>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post.id} className="space-y-2 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {post.authorName}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({post.postType})
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Reported {post.reportedAt?.toLocaleString()}
                  </p>
                </div>
                {post.reportReason && (
                  <p className="rounded-md bg-muted p-2 text-sm text-foreground">
                    &quot;{post.reportReason}&quot;
                  </p>
                )}
                <p className="text-sm text-muted-foreground">{post.description}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
