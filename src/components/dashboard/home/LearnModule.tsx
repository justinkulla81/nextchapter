import Link from 'next/link'
import { HomeModule } from './HomeModule'

// A quiet summary of learning with one way in: the next step on the member's first learning path, and what they
// have finished. Mirrors the Jobs and Network cards beside it.
export function LearnModule({ next, finished }: { next: { goal: string; step: string } | null; finished: number }) {
  return (
    <HomeModule
      title="Learn"
      action={
        <Link href="/dashboard/learning" className="text-sm font-medium text-brand underline underline-offset-4">
          Open Learn
        </Link>
      }
    >
      {next ? (
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Next step</p>
          <p className="text-base font-semibold text-ink">{next.step}</p>
          <p className="text-sm text-muted-foreground">Toward your goal: {next.goal}</p>
        </div>
      ) : (
        <p className="text-base text-muted-foreground">No learning goal yet. Tell us a skill you want to build and we plan the steps.</p>
      )}
      <p className="text-sm text-muted-foreground">
        {finished === 0 ? 'Nothing finished yet. Each course you finish goes on your profile.' : `${finished} ${finished === 1 ? 'course' : 'courses'} finished. Each one is on your profile.`}
      </p>
    </HomeModule>
  )
}
