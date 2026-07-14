import Link from 'next/link'
import type { CommunityFeedItem } from '@/lib/community/community-feed'
import { FEED_ITEM_STYLE } from '@/lib/community/feed-item-style'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function CommunityPreviewWidget({ feed }: { feed: CommunityFeedItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Community</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {feed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet — be the first.</p>
        ) : (
          <div className="space-y-2">
            {feed.map((item) => {
              const style = FEED_ITEM_STYLE[item.type]
              return (
                <p
                  key={item.id}
                  className={`line-clamp-1 border-l-4 pl-2 text-sm text-muted-foreground ${style.borderClass}`}
                >
                  <span className="mr-1">{style.icon}</span>
                  {item.displayName && <span className="font-medium text-foreground">{item.displayName}</span>}{' '}
                  {item.detail}
                </p>
              )
            })}
          </div>
        )}
        <Link href="/dashboard/community" className="inline-block text-sm font-medium text-primary underline underline-offset-4">
          Visit Community →
        </Link>
      </CardContent>
    </Card>
  )
}
