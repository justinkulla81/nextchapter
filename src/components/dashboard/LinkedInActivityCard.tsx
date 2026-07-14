import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { markLinkedInActivity } from '@/app/dashboard/actions'
import { LINKEDIN_POINTS_WINDOW_DAYS, LINKEDIN_POINTS_CAP, LINKEDIN_POINTS_PER_LOG } from '@/lib/constants/linkedin'

export function LinkedInActivityCard({
  recentLogCount,
  loggedToday,
}: {
  recentLogCount: number
  loggedToday: boolean
}) {
  const cappedPoints = Math.min(recentLogCount * LINKEDIN_POINTS_PER_LOG, LINKEDIN_POINTS_CAP)
  const atCap = cappedPoints >= LINKEDIN_POINTS_CAP

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">LinkedIn Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {recentLogCount} post{recentLogCount === 1 ? '' : 's'} logged in the last{' '}
          {LINKEDIN_POINTS_WINDOW_DAYS} days
          {atCap ? ' — you\'re maxed out on this bonus, keep it up anyway!' : '.'}
        </p>
        <form action={markLinkedInActivity}>
          <Button type="submit" size="sm" variant="outline" disabled={loggedToday}>
            {loggedToday ? "Logged for today ✓" : 'I posted on LinkedIn today'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
