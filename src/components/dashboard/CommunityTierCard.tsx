import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TIER_NAME, type UnlockTier } from '@/lib/community/unlock-tier'
import { BADGE_LABEL, type BadgeKey } from '@/lib/community/badges'

export function CommunityTierCard({ tier, badges }: { tier: UnlockTier; badges: BadgeKey[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Tier {tier} — {TIER_NAME[tier]}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span
                key={badge}
                className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand"
              >
                {BADGE_LABEL[badge]}
              </span>
            ))}
          </div>
        )}
        <Link href="/dashboard/circle" className="inline-block text-sm font-medium text-primary underline underline-offset-4">
          Visit The Circle →
        </Link>
      </CardContent>
    </Card>
  )
}
