import { isAutomatedPostType } from '@/lib/community/post-type'
import type { UnifiedStreamItem } from '@/lib/community/unified-feed'
import { ActivityRow, PostRow } from '@/components/community/PostRow'

// One shared row shell for both real candidate posts and auto-generated
// activity — same padding/typography, connected via divide-y in the parent
// list instead of each being its own separately bordered, gapped box. Real
// posts still stand out (avatar, name, actions); activity items are a
// quieter icon + line, but they read as one continuous stream, not two
// disconnected feature areas.
export function CommunityStreamItem({ item, candidateId }: { item: UnifiedStreamItem; candidateId: string }) {
  // The redesign: the same stream, in rows (components/community/PostRow.tsx).
  if (item.kind === 'feed') return <ActivityRow item={item.item} />
  const isOwn = item.post.candidateId === candidateId
  const messageHref = !isOwn && !isAutomatedPostType(item.post.postType) ? `/dashboard/community?tab=messages&relation=peers&with=${item.post.candidateId}` : null
  return <PostRow post={item.post} isOwnPost={isOwn} messageHref={messageHref} />
}
