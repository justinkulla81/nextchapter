import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Shown when getSentimentAlert fires for the candidate — a real, low-mood
// signal over the trailing two weeks, not a one-off bad day. Keeps the same
// warm, practical register as Victoria's mood-check-in responses: never
// clinical or diagnostic language, since this isn't a mental-health
// screening tool, just an honest nudge.
export function SentimentSupportCard({ hasCoach }: { hasCoach: boolean }) {
  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardContent className="space-y-3 pt-6">
        <p className="text-sm font-medium text-foreground">
          It looks like the last couple weeks have been rough.
        </p>
        <p className="text-sm text-muted-foreground">
          A search is hard on its own — a stretch of tough days doesn&apos;t mean anything&apos;s
          wrong with how you&apos;re doing it. A few things that actually help:
        </p>
        <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
          <li>Reach out to someone you trust — not about the search, just to talk.</li>
          <li>Take a day away from the search entirely. It&apos;ll still be there tomorrow.</li>
          <li>
            Message someone from your{' '}
            <Link href="/dashboard/network" className="text-primary underline underline-offset-4">
              Support Network
            </Link>{' '}
            — you&apos;ve already got people on there who said they&apos;d help.
          </li>
          <li>If this keeps up, talking to a licensed professional can genuinely help.</li>
        </ul>
        {!hasCoach && (
          <div className="flex flex-col items-start gap-2 border-t border-warning/20 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Some of this is easier with a real person in your corner between sessions.
            </p>
            <Button
              nativeButton={false}
              render={<Link href="/coaching" />}
              variant="outline"
              size="sm"
              className="shrink-0"
            >
              Consider Executive Coaching
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
