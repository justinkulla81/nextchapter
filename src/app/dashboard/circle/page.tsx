import { getDashboardData } from '@/lib/dashboard/get-dashboard-data'
import { computeUnlockTierForCandidate, TIER_NAME, TIER_UNLOCKS } from '@/lib/community/unlock-tier'
import { getCircleFeed } from '@/lib/community/circle-feed'
import { getUnreadEncouragementNotes } from '@/lib/community/encouragement'
import { EncouragementForm } from '@/components/dashboard/EncouragementForm'
import { dismissEncouragementNote } from '@/app/dashboard/circle/actions'
import { Button } from '@/components/ui/button'

export default async function CirclePage() {
  const profile = await getDashboardData()
  const tier = await computeUnlockTierForCandidate(profile.id)

  if (tier < 3) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">The Circle</h1>
          <p className="mt-1 text-muted-foreground">
            You&apos;re currently at Tier {tier} — {TIER_NAME[tier]}. The Circle unlocks at Tier 3 (Building
            Momentum) — keep taking actions, requesting references, and uploading work samples to get there.
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
        <p className="mt-1 text-muted-foreground">Anonymized activity from members like you.</p>
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
