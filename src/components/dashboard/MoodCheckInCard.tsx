'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Mood } from '@prisma/client'
import { TrendingDown, Minus, TrendingUp, Zap, X, type LucideIcon } from 'lucide-react'
import type { CuratedVideo } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { checkInMood, dismissMoodCard } from '@/app/dashboard/actions'
import { MOOD_ORDER, MOOD_LABEL, MOOD_RESPONSE } from '@/lib/daily/mood-labels'
import { MotivationalVideoCarousel } from '@/components/dashboard/MotivationalVideoCarousel'

const MOOD_ICON: Record<Mood, LucideIcon> = {
  STUCK: TrendingDown,
  GETTING_THERE: Minus,
  MOVING: TrendingUp,
  FIRED_UP: Zap,
}

export function MoodCheckInCard({
  todaysMood,
  checkInsLast7Days,
  firstName,
  dismissedToday,
  lowSentiment,
  hasCoach,
  motivationalVideos,
  likedVideoIds,
}: {
  todaysMood: Mood | null
  checkInsLast7Days: number
  firstName: string | null
  // Server-computed: whether this was already dismissed today (see
  // moodCardDismissedAt / startOfUTCDay) — resets automatically tomorrow.
  dismissedToday: boolean
  // A real, trailing-two-week low-mood signal (see getSentimentAlert) — not
  // a one-off bad day. Folded into this same card instead of a separate
  // box below it, so the response to "how are you doing" reads as one
  // consistent message from Victoria rather than two differently-voiced
  // ones stacked on top of each other.
  lowSentiment: boolean
  hasCoach: boolean
  motivationalVideos: CuratedVideo[]
  likedVideoIds: string[]
}) {
  const router = useRouter()
  const [optimisticMood, setOptimisticMood] = useState<Mood | null>(todaysMood)
  const [isPending, startTransition] = useTransition()
  const [dismissed, setDismissed] = useState(dismissedToday)
  // Distinguishes "just submitted this session" from "already checked in
  // before this page load" — the response/support content below is only
  // worth showing once, right after the action; a returning visit later
  // the same day shouldn't keep re-showing the same reframe message.
  const [justCheckedIn, setJustCheckedIn] = useState(false)

  const mood = optimisticMood ?? todaysMood

  function handleCheckIn(selected: Mood) {
    setOptimisticMood(selected)
    setJustCheckedIn(true)
    startTransition(async () => {
      await checkInMood(selected)
      // checkInMood's +3 points feed the Weekly A target / grade shown
      // elsewhere on this same page (DashboardTopStrip, SuccessSprintCard) —
      // those are plain server-rendered props from the initial page load,
      // not data this card owns, so router.refresh() is what actually pulls
      // the new total in immediately instead of waiting for the next visit.
      router.refresh()
    })
  }

  function handleDismiss() {
    setDismissed(true)
    startTransition(() => {
      dismissMoodCard()
    })
  }

  // Once today's check-in was already done before this page load, the card
  // has nothing left to ask — it disappears rather than sticking around
  // re-showing the same response every visit.
  if (dismissed || (todaysMood && !justCheckedIn)) return null

  return (
    <Card aria-busy={isPending}>
      <CardHeader className="relative">
        <div className="flex items-center gap-2 pr-6">
          <CardTitle className="text-base font-medium text-foreground">Check In</CardTitle>
          <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
            +3 pts
          </span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!mood ? (
          <div className="space-y-2.5">
            <p className="text-sm font-medium text-foreground">
              How are you feeling today{firstName ? `, ${firstName}` : ''}?
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MOOD_ORDER.map((option) => {
                const Icon = MOOD_ICON[option]
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleCheckIn(option)}
                    className="flex flex-col items-center justify-center gap-1 rounded-lg border border-input bg-white px-2 py-3.5 text-xs font-medium transition-colors hover:border-brand hover:bg-brand/5 disabled:cursor-wait"
                  >
                    <Icon aria-hidden className="size-4 shrink-0 text-brand" />
                    {MOOD_LABEL[option]}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-sm text-foreground">
              <span className="mr-1.5 inline-flex items-center align-text-bottom">
                {(() => {
                  const Icon = MOOD_ICON[mood]
                  return <Icon aria-hidden className="size-4 text-brand" />
                })()}
              </span>
              {MOOD_RESPONSE[mood]}
            </p>
            <p className="text-sm text-foreground">
              {`You've checked in ${checkInsLast7Days} / 7 days. Thanks for sharing, it helps us support you by knowing how you're doing. Keep it up!`}
            </p>
            {lowSentiment && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-sm text-foreground">
                  It looks like the last couple weeks have been rough. A search is hard on its
                  own — a stretch of tough days doesn&apos;t mean anything&apos;s wrong with how
                  you&apos;re doing it. A few things that actually help:
                </p>
                <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
                  <li>
                    {hasCoach ? (
                      <>
                        Message your{' '}
                        <Link
                          href="/dashboard/community?tab=messages&relation=coaches"
                          className="text-primary underline underline-offset-4"
                        >
                          coach
                        </Link>{' '}
                        — they&apos;re there for exactly this, not just search strategy.
                      </>
                    ) : (
                      <>
                        <Link href="/coaching" className="text-primary underline underline-offset-4">
                          Unlock an Executive Coach
                        </Link>{' '}
                        — a real person in your corner between sessions makes stretches like this
                        easier.
                      </>
                    )}
                  </li>
                  <li>
                    Message someone from your{' '}
                    <Link href="/dashboard/network" className="text-primary underline underline-offset-4">
                      Support Network
                    </Link>{' '}
                    — you&apos;ve already got people on there who said they&apos;d help.
                  </li>
                  <li>Take a day away from the search entirely. It&apos;ll still be there tomorrow.</li>
                  <li>If this keeps up, talking to a licensed professional can genuinely help.</li>
                </ul>
              </div>
            )}
            {!lowSentiment && (
              <MotivationalVideoCarousel videos={motivationalVideos} likedVideoIds={likedVideoIds} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
