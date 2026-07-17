import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function GotHiredCTACard() {
  return (
    <Card className="border-success/30 bg-success/5">
      <CardContent className="flex flex-col items-start gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Landed a job through NextChapter? 🎉</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell us about it and claim your $500 Offer Bonus — we verify offer letters before paying out.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/dashboard/got-hired" />} size="sm" className="shrink-0">
          I got an offer
        </Button>
      </CardContent>
    </Card>
  )
}
