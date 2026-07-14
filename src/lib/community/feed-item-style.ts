import type { CommunityFeedItemType } from '@/lib/community/community-feed'

export const FEED_ITEM_STYLE: Record<CommunityFeedItemType, { icon: string; borderClass: string }> = {
  alist: { icon: '🏆', borderClass: 'border-l-orange' },
  activity: { icon: '📌', borderClass: 'border-l-success' },
  victoria_insight: { icon: '💡', borderClass: 'border-l-light-blue' },
  comeback: { icon: '🎉', borderClass: 'border-l-success-hover' },
}
