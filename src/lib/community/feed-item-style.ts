import { Trophy, Pin, Lightbulb, PartyPopper, type LucideIcon } from 'lucide-react'
import type { CommunityFeedItemType } from '@/lib/community/community-feed'

// Muted icon + accent color per type — replaces the raw emoji + colored
// left-border box treatment, which read as childish and visually
// disconnected from the real posts sitting above it in their own cards.
export const FEED_ITEM_STYLE: Record<CommunityFeedItemType, { icon: LucideIcon; colorClass: string }> = {
  alist: { icon: Trophy, colorClass: 'text-orange' },
  activity: { icon: Pin, colorClass: 'text-success' },
  victoria_insight: { icon: Lightbulb, colorClass: 'text-light-blue' },
  comeback: { icon: PartyPopper, colorClass: 'text-success-hover' },
}
