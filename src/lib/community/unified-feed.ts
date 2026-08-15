import 'server-only'
import type { CommunityPost } from '@prisma/client'
import type { CommunityFeedItem } from '@/lib/community/community-feed'
import type { CommunityIdentitySource } from '@/lib/community/identity'

export type CommunityPostWithCandidate = CommunityPost & {
  candidate: CommunityIdentitySource
  // Scoped to the viewing candidate's own row only (query filters by
  // candidateId) — length > 0 means "I cheered this," never a full list.
  reactions: { id: string }[]
  _count: { reactions: number }
}

export type UnifiedStreamItem =
  | { kind: 'post'; occurredAt: Date; post: CommunityPostWithCandidate }
  | { kind: 'feed'; occurredAt: Date; item: CommunityFeedItem }

// One chronological stream instead of two visually separate sections (real
// posts in their own boxes above, auto-generated activity in differently
// styled boxes below) — real candidate posts and platform-generated
// activity interleave by recency, same as any normal feed.
export function mergeCommunityStream(
  posts: CommunityPostWithCandidate[],
  feed: CommunityFeedItem[]
): UnifiedStreamItem[] {
  const items: UnifiedStreamItem[] = [
    ...posts.map((post): UnifiedStreamItem => ({ kind: 'post', occurredAt: post.createdAt, post })),
    ...feed.map((item): UnifiedStreamItem => ({ kind: 'feed', occurredAt: item.occurredAt, item })),
  ]
  return items.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
}
