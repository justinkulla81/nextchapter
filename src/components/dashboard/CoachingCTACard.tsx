import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function CoachingCTACard() {
  return (
    <Card className="border-brand/20 bg-off-white">
      <CardContent className="flex flex-col items-start gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Want a real human in your corner too?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Victoria stays free. Executive Coach adds a human career coach on top — mock
            interviews, resume review, a second opinion on hard calls.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/coaching" />} variant="outline" size="sm" className="shrink-0">
          Learn more
        </Button>
      </CardContent>
    </Card>
  )
}
