'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogPopup } from '@/components/ui/dialog'
import { markCandidatePlusUnlockSeen } from '@/app/dashboard/candidate-plus-actions'
import { setRecruiterDatabaseOptIn } from '@/app/dashboard/privacy/actions'

export interface UnlockNumbers {
  /** Jobs that fit them on every count (personalization/match-compute.ts). */
  matches: number
  searchFirms: number
  resumes: number
  recruiterVisible: boolean
  /** Confidential Search Mode: recruiter listing can't be turned on. */
  confidential: boolean
}

const n = (x: number) => x.toLocaleString()

/** Shown once, the first time a member opens the app after earning Candidate+. Every number is theirs. */
export function CandidatePlusUnlockMoment({ numbers }: { numbers: UnlockNumbers }) {
  const [open, setOpen] = useState(true)
  const [visible, setVisible] = useState(numbers.recruiterVisible)
  const [pending, startTransition] = useTransition()
  const marked = useRef(false)
  useEffect(() => {
    if (marked.current) return
    marked.current = true
    void markCandidatePlusUnlockSeen({ matches: numbers.matches, searchFirms: numbers.searchFirms, resumes: numbers.resumes, recruiterVisible: numbers.recruiterVisible }).catch(() => undefined)
  }, [numbers])

  function optIn() {
    startTransition(async () => {
      await setRecruiterDatabaseOptIn(true)
      posthog.capture('recruiter_visibility_opted_in', { surface: 'candidate_plus_unlock' })
      setVisible(true)
    })
  }

  const items: { done: boolean; title: string; body: React.ReactNode }[] = [
    {
      done: true,
      title: numbers.matches > 0 ? `Who to contact on your ${n(numbers.matches)} matching jobs` : 'Who to contact on every job',
      body: 'The people to reach at each company, and a note you can send them. Open any job on your board.',
    },
    {
      done: true,
      title: 'Apply kit ready',
      body: `Your answers to the usual application questions, ready to paste, and which of your ${n(numbers.resumes)} résumé${numbers.resumes === 1 ? '' : 's'} to send.`,
    },
    {
      done: visible,
      title: visible ? 'Recruiters can now see you' : 'Let recruiters see you',
      body: visible ? (
        'You are listed for recruiters searching for people like you. Change it any time in Privacy.'
      ) : numbers.confidential ? (
        'Your search is confidential, so you are not listed. You can change that in Privacy.'
      ) : (
        <Button size="sm" onClick={optIn} disabled={pending} aria-busy={pending} className={cn('mt-1', pending && 'cursor-wait')}>
          {pending ? 'Listing you…' : 'List me for recruiters'}
        </Button>
      ),
    },
    {
      done: numbers.searchFirms > 0,
      title: `${n(numbers.searchFirms)} search firm${numbers.searchFirms === 1 ? '' : 's'} matched to you`,
      body: <Link href="/dashboard/network#recruiters-for-you" className="text-primary underline underline-offset-4">See the firms and who to write to</Link>,
    },
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogPopup className="w-[min(32rem,calc(100vw-2rem))] space-y-4 rounded-xl bg-card p-6 text-sm shadow-xl">
        <div>
          <p className="text-xs font-semibold tracking-wide text-success uppercase">Candidate+ unlocked</p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">Here is what you just got</h2>
        </div>
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.title} className="flex gap-3">
              <Check className={cn('mt-0.5 size-4 shrink-0', it.done ? 'text-success' : 'text-muted-foreground')} aria-hidden />
              <div>
                <p className="font-medium text-foreground">{it.title}</p>
                <div className="text-muted-foreground">{it.body}</div>
              </div>
            </li>
          ))}
        </ul>
        <DialogClose render={<Button className="w-full" />} onClick={() => posthog.capture('candidate_plus_unlock_closed', { action: 'see_board' })}>
          Go to my jobs
        </DialogClose>
      </DialogPopup>
    </Dialog>
  )
}
