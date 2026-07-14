import Link from 'next/link'
import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import {
  computeUnlockTier,
  getUnlockTierSignals,
  TIER_NAME,
  TIER_UNLOCKS,
} from '@/lib/community/unlock-tier'
import { getCircleFeed } from '@/lib/community/circle-feed'
import { getUnreadEncouragementNotes } from '@/lib/community/encouragement'
import { EncouragementForm } from '@/components/dashboard/EncouragementForm'
import { dismissEncouragementNote } from '@/app/dashboard/circle/actions'
import { Button } from '@/components/ui/button'

export default async function CirclePage() {
  const profile = await getDashboardData()
  const signals = await getUnlockTierSignals(profile.id)
  const tier = computeUnlockTier(signals)

  if (tier < 3) {
    const totalActions = signals.confirmedCount + signals.totalCompletedSprintActions + signals.checkInCount
    const actionsNeeded = Math.max(0, 10 - totalActions)
    const referencesNeeded = Math.max(0, 2 - signals.referencesCount)
    const workSamplesNeeded = Math.max(0, 1 - signals.workSamplesCount)
    const remaining = [
      actionsNeeded > 0 ? `${actionsNeeded} more action${actionsNeeded === 1 ? '' : 's'} completed` : null,
      referencesNeeded > 0 ? `${referencesNeeded} more reference${referencesNeeded === 1 ? '' : 's'} requested` : null,
      workSamplesNeeded > 0 ? `${workSamplesNeeded} more work sample${workSamplesNeeded === 1 ? '' : 's'} uploaded` : null,
    ].filter((x): x is string => x !== null)

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">The Circle</h1>
          <p className="mt-1 text-muted-foreground">
            A private feed of anonymized activity and encouragement from other NextChapter candidates —
            a reminder you&apos;re not searching alone, without the noise of a public social feed.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <p className="text-sm font-medium text-foreground">Not open yet — here&apos;s exactly what&apos;s left</p>
          {remaining.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;ve met the requirements — check back shortly, this updates automatically.
            </p>
          ) : (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {remaining.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            Actions include things like{' '}
            <Link href="/dashboard/sprint" className="text-primary underline underline-offset-4">
              completing your weekly Success Sprint
            </Link>{' '}
            and confirming profile details — most of it happens naturally as you work your 7-day plan.
          </p>
        </div>
      </div>
    )
  }

  const [feed, unreadNotes] = await Promise.all([
    getCircleFeed(),
    getUnreadEncouragementNotes(profile.id),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">The Circle</h1>
        <p className="mt-1 text-muted-foreground">
          A private feed of anonymized activity and encouragement from other NextChapter candidates —
          a reminder you&apos;re not searching alone.
        </p>
      </div>

      {unreadNotes.length > 0 && (
        <div className="space-y-3">
          {unreadNotes.map((note) => (
            <div key={note.id} className="rounded-lg border border-border bg-brand/5 p-4">
              <p className="text-sm text-foreground">
                &ldquo;{note.message}&rdquo;
                {note.revealSender && note.fromCandidate.firstName && (
                  <span className="text-muted-foreground"> — {note.fromCandidate.firstName}</span>
                )}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Someone in the Circle sent you this.</p>
              <form action={dismissEncouragementNote.bind(null, note.id)} className="mt-2">
                <Button type="submit" variant="outline" size="sm">
                  Dismiss
                </Button>
              </form>
            </div>
          ))}
        </div>
      )}

      {tier >= 4 && (
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-sm font-medium text-foreground">Send some encouragement</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Someone in the Circle is working through a hard week. Want to send them a quick note? It&apos;s
            anonymous unless you choose otherwise.
          </p>
          <div className="mt-3">
            <EncouragementForm />
          </div>
        </div>
      )}

      <div className="divide-y divide-border rounded-lg border border-border">
        {feed.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No activity yet this week — check back soon.</p>
        ) : (
          feed.map((item) => (
            <div key={item.id} className="p-4 text-sm text-foreground">
              <span className="font-medium">{item.displayName}</span> {item.detail}
              <span className="ml-2 text-xs text-muted-foreground">
                {item.occurredAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Tier {tier} — {TIER_NAME[tier]}. This tier unlocks: {TIER_UNLOCKS[tier]}.
      </p>
    </div>
  )
}
