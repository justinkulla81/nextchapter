import Link from 'next/link'
import type { CommunityPost } from '@prisma/client'
import { deactivateCommunityPost, expressInterest, toggleCheerPostAction } from '@/app/dashboard/community/actions'
import { COMMUNITY_POST_TYPE_LABELS } from '@/lib/constants/community'
import { resolveCommunityIdentity, type CommunityIdentitySource } from '@/lib/community/identity'
import { isAutomatedPostType } from '@/lib/community/post-type'
import type { UnifiedStreamItem } from '@/lib/community/unified-feed'
import { moderationNote, postFact, postKind } from '@/lib/redesign/network-account'
import { AvatarDisplay } from '@/components/ui/avatar-display'
import { CommunityPostReportButton } from '@/components/dashboard/CommunityPostReportButton'
import { CheerButton, InterestButton, RemovePostButton } from '@/components/community/PostActions'

export type PostRowPost = CommunityPost & {
  candidate: CommunityIdentitySource
  reactions: { id: string }[]
  _count: { reactions: number }
}

// One community post in the redesign: who wrote it, what it is, the words, one fact (where it is about) and the actions
// that fit. Replaces the old post card and stream row: the uppercase kind label, the shaded legal notice box and the
// small grey text are now sentences at body size. Same actions, same moderation messages.
export function PostRow({ post, isOwnPost, messageHref }: { post: PostRowPost; isOwnPost: boolean; messageHref: string | null }) {
  const { displayName: posterName, avatarUrl: posterAvatarUrl } = resolveCommunityIdentity(post.candidate)
  const isAutomated = isAutomatedPostType(post.postType)
  const kind = postKind(COMMUNITY_POST_TYPE_LABELS[post.postType], post.postType === 'UPDATE')
  // An admin story often has no separate title: the headline is then the description, so it is shown once.
  const headline = post.title ?? (post.externalUrl ? post.description : null)
  const showDescription = !(headline && headline === post.description && !post.title)
  const note = moderationNote(post.moderationStatus, isOwnPost)
  const fact = postFact([post.postCity, post.postFunction, post.postIndustry])
  const who = posterName && (messageHref ? <Link href={messageHref} className="hover:underline">{posterName}</Link> : posterName)

  return (
    <div className="space-y-3 p-5">
      <div className="flex gap-3">
        {posterName && (messageHref ? <Link href={messageHref} aria-label={`Message ${posterName}`}><AvatarDisplay name={posterName} url={posterAvatarUrl} size={40} /></Link> : <AvatarDisplay name={posterName} url={posterAvatarUrl} size={40} />)}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-base font-semibold text-ink">
            {who}
            {kind && <span className="font-normal text-muted-foreground">{posterName ? ' · ' : ''}{kind}</span>}
          </p>
          {headline &&
            (post.externalUrl ? (
              <a href={post.externalUrl} target="_blank" rel="noopener noreferrer" className="text-base font-semibold text-ink underline underline-offset-4">
                {headline}
              </a>
            ) : (
              <p className="text-base font-semibold text-ink">{headline}</p>
            ))}
          {post.imageUrl && (
            <a href={post.externalUrl ?? undefined} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external article thumbnail, not one of this app's own assets */}
              <img src={post.imageUrl} alt="" className="max-h-48 w-full object-cover" />
            </a>
          )}
          {showDescription && <p className="text-base whitespace-pre-wrap text-ink">{post.description}</p>}
          {post.moderationCategory === 'BAD_LEGAL_FINANCIAL_ADVICE' && (
            <p className="text-sm text-muted-foreground">This touches on legal or financial specifics. Treat it as one person&apos;s experience, not professional advice, and check anything that matters with a qualified professional.</p>
          )}
          {note && <p className="text-sm font-medium text-ink">{note}</p>}
          {fact && <p className="text-sm text-muted-foreground">{fact}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:pl-[52px]">
        {isOwnPost ? (
          <RemovePostButton action={deactivateCommunityPost.bind(null, post.id)} postId={post.id} />
        ) : (
          <>
            {!isAutomated && <InterestButton action={expressInterest.bind(null, post.id)} postId={post.id} />}
            <CheerButton action={toggleCheerPostAction.bind(null, post.id)} cheered={post.reactions.length > 0} count={post._count.reactions} postId={post.id} />
            {!isAutomated && <CommunityPostReportButton postId={post.id} isReported={!!post.reportedAt} />}
          </>
        )}
      </div>
    </div>
  )
}

/** One line of automatic activity in the feed (a comeback, a market brief): a sentence and a date, no icon. */
export function ActivityRow({ item }: { item: Extract<UnifiedStreamItem, { kind: 'feed' }>['item'] }) {
  return (
    <div className="space-y-0.5 p-5">
      <p className="text-base text-ink">
        {item.displayName && <span className="font-semibold">{item.displayName} </span>}
        {item.url ? (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            {item.detail}
          </a>
        ) : (
          item.detail
        )}
      </p>
      <p className="text-sm text-muted-foreground">{item.occurredAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
    </div>
  )
}
