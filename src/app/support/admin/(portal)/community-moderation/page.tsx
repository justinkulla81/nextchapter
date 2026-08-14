import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { getModerationQueue, MODERATION_CATEGORY_LABEL, type ModerationQueuePost } from '@/lib/community/moderation'
import { SubmitButton } from '@/components/ui/submit-button'
import {
  publishModeratedPostAction,
  removeModeratedPostAction,
  acknowledgeModeratedPostAction,
} from './actions'

export const metadata: Metadata = { title: 'Community Moderation' }
export const maxDuration = 30

// Master Build Script §14 — "Human moderator from day one, not a
// set-and-forget surface." This is the action surface for the AI
// classification pipeline (src/lib/community/moderation.ts): every post
// gets classified before or immediately after publish, and anything the
// classifier auto-held or flagged lands here for a human to actually act
// on. Separate from /support/admin/reported-messages, which is driven by
// candidate reports rather than classification — a post can show up in
// both, answering different questions.
export default async function CommunityModerationAdminPage() {
  await requireAdmin()
  const queue = await getModerationQueue()

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Community Moderation</h1>
        <p className="mt-1 text-muted-foreground">
          Every Community post is classified automatically. Recruitment fraud, harassment, and
          defamation are held before anyone but the poster can see them; doxxing and spam are
          removed automatically; crisis signals are never held or removed, only queued here for
          priority review.{' '}
          <Link href="/support/admin/reported-messages" className="underline underline-offset-4">
            See candidate-reported content →
          </Link>
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Needs review ({queue.needsReview.length})
        </h2>
        {queue.needsReview.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing waiting on a human right now.</p>
        ) : (
          <div className="space-y-4">
            {queue.needsReview.map((post) => (
              <QueueCard key={post.id} post={post}>
                {post.moderationStatus === 'HELD' ? (
                  <>
                    <form action={publishModeratedPostAction.bind(null, post.id)}>
                      <SubmitButton size="sm">Publish</SubmitButton>
                    </form>
                    <form action={removeModeratedPostAction.bind(null, post.id)}>
                      <SubmitButton size="sm" variant="destructive">
                        Remove
                      </SubmitButton>
                    </form>
                  </>
                ) : (
                  // Crisis posts are already live — the only action here is
                  // acknowledging a human has looked. Removing a crisis post
                  // is never offered (§17 rule #12: never auto- or
                  // moderator-delete a crisis signal from this queue).
                  <form action={acknowledgeModeratedPostAction.bind(null, post.id)}>
                    <SubmitButton size="sm">Mark reviewed</SubmitButton>
                  </form>
                )}
              </QueueCard>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Flagged, live, no action required ({queue.flagged.length})
        </h2>
        {queue.flagged.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing flagged.</p>
        ) : (
          <div className="space-y-4">
            {queue.flagged.map((post) => (
              <QueueCard key={post.id} post={post}>
                <form action={acknowledgeModeratedPostAction.bind(null, post.id)}>
                  <SubmitButton size="sm" variant="ghost">
                    {post.moderationReviewedAt ? 'Reviewed' : 'Mark reviewed'}
                  </SubmitButton>
                </form>
                <form action={removeModeratedPostAction.bind(null, post.id)}>
                  <SubmitButton size="sm" variant="destructive">
                    Remove
                  </SubmitButton>
                </form>
              </QueueCard>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Recently auto-removed ({queue.recentlyRemoved.length})
        </h2>
        {queue.recentlyRemoved.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing auto-removed recently.</p>
        ) : (
          <div className="space-y-4">
            {queue.recentlyRemoved.map((post) => (
              <QueueCard key={post.id} post={post}>
                <form action={publishModeratedPostAction.bind(null, post.id)}>
                  <SubmitButton size="sm" variant="outline">
                    Restore
                  </SubmitButton>
                </form>
              </QueueCard>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function QueueCard({ post, children }: { post: ModerationQueuePost; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {post.authorName}
          <span className="ml-2 text-xs font-normal text-muted-foreground">({post.postType})</span>
          <Link
            href={`/support/admin/candidates/${post.candidateId}`}
            className="ml-2 text-xs font-normal text-primary underline underline-offset-4"
          >
            View candidate
          </Link>
        </p>
        <p className="text-xs text-muted-foreground">{post.createdAt.toLocaleString()}</p>
      </div>
      <p className="rounded-md bg-muted p-2 text-sm text-foreground">{post.description}</p>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {post.moderationCategory && (
          <span className="rounded-full bg-orange/20 px-2 py-0.5 font-semibold text-orange">
            {MODERATION_CATEGORY_LABEL[post.moderationCategory]}
          </span>
        )}
        {post.moderationConfidence !== null && (
          <span>{Math.round(post.moderationConfidence * 100)}% confidence</span>
        )}
      </div>
      {post.moderationReasoning && (
        <p className="text-xs text-muted-foreground">&quot;{post.moderationReasoning}&quot;</p>
      )}
      {post.moderationReviewedAt && (
        <p className="text-xs text-muted-foreground">
          Reviewed {post.moderationReviewedAt.toLocaleString()}
          {post.moderationReviewedByEmail ? ` by ${post.moderationReviewedByEmail}` : ''}
        </p>
      )}
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}
