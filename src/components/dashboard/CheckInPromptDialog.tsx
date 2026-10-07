'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import type { Mood } from '@prisma/client'
import { TrendingDown, Minus, TrendingUp, Zap, X, type LucideIcon } from 'lucide-react'
import { recordCheckInPromptShown, answerCheckInPrompt } from '@/app/dashboard/check-in-actions'
import { MOOD_ORDER, MOOD_LABEL, MOOD_RESPONSE } from '@/lib/daily/mood-labels'
import type { CheckInKind } from '@/lib/daily/check-in-schedule'

const MOOD_ICON: Record<Mood, LucideIcon> = { STUCK: TrendingDown, GETTING_THERE: Minus, MOVING: TrendingUp, FIRED_UP: Zap }
// Once per browser session, so moving between pages never re-opens it.
const SESSION_KEY = 'nc-checkin-prompt-seen'

/** Key numbers in the pop-up are bold numerals. */
function Num({ n }: { n: number }) {
  return <strong className="font-semibold text-navy">{n}</strong>
}

/**
 * The check-in that opens with the app, a few times a week (the schedule is
 * server-side: check-in-schedule.ts). Asks either how the candidate is
 * feeling or for a small commitment grounded in their real week ("You've
 * applied to 4 jobs this week. Can you apply to 3 today?").
 */
export function CheckInPromptDialog({
  kind, firstName, countThisWeek, askedCount, weeklyGoal,
}: {
  kind: CheckInKind
  firstName: string | null
  countThisWeek: number
  askedCount: number
  weeklyGoal: number
}) {
  const [open, setOpen] = useState(false)
  const [promptId, setPromptId] = useState<string | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let seen = false
    try { seen = sessionStorage.getItem(SESSION_KEY) === '1' } catch { /* storage blocked */ }
    if (seen) return
    // A beat after the page appears, so it reads as a check-in, not a wall.
    const t = setTimeout(async () => {
      const id = await recordCheckInPromptShown(kind, kind === 'MOOD' ? null : countThisWeek, kind === 'MOOD' ? null : askedCount)
      try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* storage blocked */ }
      if (id) { setPromptId(id); setOpen(true) }
    }, 1200)
    return () => clearTimeout(t)
  }, [kind, countThisWeek, askedCount])

  useEffect(() => {
    if (!open) return
    dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function respond(response: string) {
    setAnswer(response)
    if (promptId) start(() => answerCheckInPrompt(promptId, response))
  }
  function close() {
    if (!answer && promptId) void answerCheckInPrompt(promptId, 'DISMISSED')
    setOpen(false)
  }

  if (!open) return null

  const name = firstName ? `, ${firstName}` : ''
  const buttonBase = 'rounded-lg px-4 py-2.5 text-sm font-semibold disabled:cursor-wait'
  const primary = `${buttonBase} bg-success text-white hover:bg-success-hover`
  const secondary = `${buttonBase} border border-border bg-white text-foreground hover:bg-muted`

  let body: React.ReactNode
  if (kind === 'MOOD') {
    body = !answer ? (
      <>
        <p className="text-base font-medium text-foreground">How are you feeling today{name}?</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MOOD_ORDER.map((m, i) => {
            const Icon = MOOD_ICON[m]
            return (
              <button key={m} type="button" data-autofocus={i === 0 ? '' : undefined} disabled={pending} onClick={() => respond(m)}
                className="flex flex-col items-center gap-1 rounded-lg border border-input bg-white px-2 py-3.5 text-sm font-medium hover:border-brand hover:bg-brand/5 disabled:cursor-wait">
                <Icon aria-hidden className="size-4 text-brand" />
                {MOOD_LABEL[m]}
              </button>
            )
          })}
        </div>
      </>
    ) : (
      <>
        <p className="text-sm text-foreground">{MOOD_RESPONSE[answer as Mood]}</p>
        {answer === 'STUCK' && (
          <p className="mt-2 text-sm text-muted-foreground">
            A hard stretch is normal in a search. <Link href="/dashboard/support" className="text-brand underline underline-offset-4" onClick={() => setOpen(false)}>Support options</Link> are here when you want them.
          </p>
        )}
        <div className="mt-4"><button type="button" data-autofocus="" className={primary} onClick={() => setOpen(false)}>Done</button></div>
      </>
    )
  } else {
    const isApply = kind === 'APPLY_COMMIT'
    const observation = isApply
      ? countThisWeek === 0
        ? <>You haven’t applied to any jobs yet this week. Your goal is <Num n={weeklyGoal} />.</>
        : <>You’ve applied to <Num n={countThisWeek} /> {countThisWeek === 1 ? 'job' : 'jobs'} this week. Your goal is <Num n={weeklyGoal} />.</>
      : countThisWeek === 0
        ? <>You haven’t reached out to anyone yet this week.</>
        : <>You’ve reached out to <Num n={countThisWeek} /> {countThisWeek === 1 ? 'person' : 'people'} this week.</>
    const ask = isApply
      ? <>Can you apply to <Num n={askedCount} /> {askedCount === 1 ? 'job' : 'jobs'} today?</>
      : <>Can you reach out to <Num n={askedCount} /> more {askedCount === 1 ? 'person' : 'people'} today?</>
    const yesLabel = isApply ? `Yes, I’ll apply to ${askedCount}` : `Yes, I’ll reach out to ${askedCount}`
    const link = isApply ? { href: '/dashboard/find-my-job', label: 'Find jobs to apply to' } : { href: '/dashboard/network', label: 'See who to reach out to' }

    body = !answer ? (
      <>
        <p className="text-sm text-muted-foreground">{observation}</p>
        <p className="mt-2 text-base font-medium text-foreground">{ask}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" data-autofocus="" disabled={pending} className={primary} onClick={() => respond('YES')}>{yesLabel}</button>
          <button type="button" disabled={pending} className={secondary} onClick={() => respond('NOT_TODAY')}>Not today</button>
        </div>
      </>
    ) : answer === 'YES' ? (
      <>
        <p className="text-base font-medium text-foreground">Great. That’s your action for today.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={link.href} data-autofocus="" className={primary} onClick={() => setOpen(false)}>{link.label}</Link>
          <button type="button" className={secondary} onClick={() => setOpen(false)}>Later</button>
        </div>
      </>
    ) : (
      <>
        <p className="text-sm text-foreground">No problem. Every bit of progress counts. We’ll check in again later this week.</p>
        <div className="mt-4"><button type="button" data-autofocus="" className={secondary} onClick={() => setOpen(false)}>Close</button></div>
      </>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6" role="presentation">
      <button type="button" aria-label="Close check-in" className="absolute inset-0 bg-black/30" onClick={close} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="checkin-title"
        className={`relative w-full rounded-t-2xl bg-white p-6 shadow-2xl sm:max-w-md sm:rounded-2xl ${pending ? 'cursor-wait' : ''}`}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="checkin-title" className="text-lg font-semibold text-navy">
            {kind === 'MOOD' ? 'Check in' : 'Quick check-in'}
          </h2>
          <button type="button" onClick={close} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {body}
      </div>
    </div>
  )
}
