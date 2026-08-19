import { Pin, PartyPopper, Newspaper, type LucideIcon } from 'lucide-react'
import type { CommunityFeedItemType } from '@/lib/community/community-feed'

// Muted icon + accent color per type — replaces the raw emoji + colored
// left-border box treatment, which read as childish and visually
// disconnected from the real posts sitting above it in their own cards.
export const FEED_ITEM_STYLE: Record<CommunityFeedItemType, { icon: LucideIcon; colorClass: string }> = {
  activity: { icon: Pin, colorClass: 'text-success' },
  comeback: { icon: PartyPopper, colorClass: 'text-success-hover' },
  marketBrief: { icon: Newspaper, colorClass: 'text-primary' },
}
