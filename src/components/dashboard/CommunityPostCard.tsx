import type { CommunityPost } from '@prisma/client'
import { type CommunityIdentitySource } from '@/lib/community/identity'
import { PostRow } from '@/components/community/PostRow'

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
  // The redesign: the same post as a row. (No direct message from here: that stays off, as in the old card.)
  return <PostRow post={post} isOwnPost={isOwnPost} messageHref={null} />
}
