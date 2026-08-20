import type { CommunityPost } from '@prisma/client'
import { ThumbsUp } from 'lucide-react'
import { deactivateCommunityPost, expressInterest, toggleCheerPostAction } from '@/app/dashboard/community/actions'
import { COMMUNITY_POST_TYPE_LABELS } from '@/lib/constants/community'
import { resolveCommunityIdentity, type CommunityIdentitySource } from '@/lib/community/identity'
import { isAutomatedPostType } from '@/lib/community/post-type'
import { Card, CardContent } from '@/components/ui/card'
import { AvatarDisplay } from '@/components/ui/avatar-display'
import { SubmitButton } from '@/components/ui/submit-button'
import { CommunityPostReportButton } from '@/components/dashboard/CommunityPostReportButton'
import { cn } from '@/lib/utils'

export function CommunityPostCard({
  post,
  isOwnPost,
}: {
  post: CommunityPost & {
    candidate: CommunityIdentitySource
    reactions: { id: string }[]
    _count: { reactions: number }
  }
  isOwnPost: boolean
}) {
  const { displayName: posterName, avatarUrl: posterAvatarUrl } = resolveCommunityIdentity(post.candidate)
  const isCheered = post.reactions.length > 0
  const cheerCount = post._count.reactions
  const isAutomated = isAutomatedPostType(post.postType)

  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-2">
            {posterName && <AvatarDisplay name={posterName} url={posterAvatarUrl} size={28} />}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {posterName && <p className="text-sm font-medium text-foreground">{posterName}</p>}
                {post.postType !== 'UPDATE' && (
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    {COMMUNITY_POST_TYPE_LABELS[post.postType]}
                  </p>
                )}
              </div>
              {post.title && <p className="font-medium">{post.title}</p>}
            </div>
          </div>
          {isOwnPost ? (
            <form action={deactivateCommunityPost.bind(null, post.id)}>
              <SubmitButton variant="ghost" size="sm">
                Remove
              </SubmitButton>
            </form>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              {/* No DMs at launch (§14) — the "Message" entry point that
                  used to live here (deep-linking to a peer thread) has been
                  removed. peer-threads.ts itself is untouched; other,
                  non-Community-originated entry points to peer messaging
                  are unaffected. */}
              {!isAutomated && (
                <form action={expressInterest.bind(null, post.id)}>
                  <SubmitButton variant="outline" size="sm">
                    I&apos;m interested
                  </SubmitButton>
                </form>
              )}
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{post.description}</p>
        {post.externalUrl && (
          <a
            href={post.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline underline-offset-4"
          >
            View link
          </a>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {[post.postCity, post.postFunction, post.postIndustry].filter(Boolean).join(' · ')}
          </p>
          {!isOwnPost && (
            <div className="flex items-center gap-3">
              <form action={toggleCheerPostAction.bind(null, post.id)}>
                <SubmitButton
                  variant="ghost"
                  size="sm"
                  className={cn('h-auto gap-1.5 px-2 py-1 text-xs', isCheered && 'text-primary')}
                >
                  <ThumbsUp className={cn('size-3.5', isCheered && 'fill-current')} aria-hidden />
                  {cheerCount > 0 && <span className="tabular-nums">{cheerCount}</span>}
                </SubmitButton>
              </form>
              {!isAutomated && <CommunityPostReportButton postId={post.id} isReported={!!post.reportedAt} />}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
