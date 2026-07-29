import { deactivateCommunityPost, expressInterest } from '@/app/dashboard/community/actions'
import { COMMUNITY_POST_TYPE_LABELS } from '@/lib/constants/community'
import { anonymize } from '@/lib/community/community-feed'
import { FEED_ITEM_STYLE } from '@/lib/community/feed-item-style'
import type { UnifiedStreamItem } from '@/lib/community/unified-feed'
import { AvatarDisplay } from '@/components/ui/avatar-display'
import { SubmitButton } from '@/components/ui/submit-button'

// One shared row shell for both real candidate posts and auto-generated
// activity — same padding/typography, connected via divide-y in the parent
// list instead of each being its own separately bordered, gapped box. Real
// posts still stand out (avatar, name, actions); activity items are a
// quieter icon + line, but they read as one continuous stream, not two
// disconnected feature areas.
export function CommunityStreamItem({ item, candidateId }: { item: UnifiedStreamItem; candidateId: string }) {
  if (item.kind === 'feed') {
    const { icon: Icon, colorClass } = FEED_ITEM_STYLE[item.item.type]
    return (
      <div className="flex items-start gap-3 p-4">
        <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${colorClass}`} />
        <p className="text-sm text-foreground">
          {item.item.displayName && <span className="font-medium">{item.item.displayName}</span>}{' '}
          {item.item.detail}
          <span className="ml-2 text-xs text-muted-foreground">
            {item.item.occurredAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </p>
      </div>
    )
  }

  const post = item.post
  const posterName = anonymize(post.candidate.firstName, post.candidate.lastName)
  const isOwnPost = post.candidateId === candidateId

  return (
    <div className="space-y-2 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-2">
          {posterName && <AvatarDisplay name={posterName} size={28} />}
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {posterName && <p className="text-sm font-medium text-foreground">{posterName}</p>}
              {post.postType !== 'UPDATE' && (
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  {COMMUNITY_POST_TYPE_LABELS[post.postType]}
                </p>
              )}
            </div>
            {post.title && <p className="font-medium text-foreground">{post.title}</p>}
          </div>
        </div>
        {isOwnPost ? (
          <form action={deactivateCommunityPost.bind(null, post.id)}>
            <SubmitButton variant="ghost" size="sm">
              Remove
            </SubmitButton>
          </form>
        ) : (
          <form action={expressInterest.bind(null, post.id)}>
            <SubmitButton variant="outline" size="sm">
              I&apos;m interested
            </SubmitButton>
          </form>
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
      <p className="text-xs text-muted-foreground">
        {[post.postCity, post.postFunction, post.postIndustry].filter(Boolean).join(' · ')}
      </p>
    </div>
  )
}
