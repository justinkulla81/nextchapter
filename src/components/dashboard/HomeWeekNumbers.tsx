/* eslint-disable @next/next/no-img-element */
import 'server-only'
import { FocusNumber } from '@/components/candidate/FocusNumber'
import { handwritingUrl } from '@/lib/email/handwriting'
import { checkinNoteText } from '@/lib/email/margin-note-text'
import { getWeeklyProgress } from '@/lib/weekly/cached-progress'
import type { PrivacyTier } from '@prisma/client'

// The two pieces of Home that read the week's numbers: the minutes box under the headline and the handwritten aside in the note.
// Both stream in after the page (inside Suspense) and share one computation (lib/weekly/cached-progress.ts), so neither the note
// nor the headline waits on the sprint. A failed read renders nothing.

interface Props {
  candidateId: string
  weekNumber: number
  privacyTier: PrivacyTier
  confidentialSearchMode: boolean
}

async function progress({ candidateId, weekNumber, privacyTier, confidentialSearchMode }: Props) {
  try {
    return await getWeeklyProgress(candidateId, weekNumber, privacyTier, confidentialSearchMode)
  } catch {
    return null
  }
}

/** The week's minutes as one pale box. The target is the pacing target (the ramp), the same number the plan below uses. */
export async function HomeFocusNumber(props: Props) {
  const p = await progress(props)
  if (!p || p.weeklyPointsTarget <= 0) return null
  return <FocusNumber done={p.weeklyPoints} target={p.weeklyPointsTarget} week={props.weekNumber} />
}

/** The handwritten aside under the note's label: a plain reading of the same two numbers. Nothing when the image cannot be signed. */
export async function HomeNoteAside(props: Props) {
  const p = await progress(props)
  if (!p || p.weeklyPointsTarget <= 0) return null
  const text = checkinNoteText(p.weeklyPoints, p.weeklyPointsTarget)
  const src = handwritingUrl('', text)
  if (!src) return null
  return <img src={src} alt={text} height={30} className="h-[30px] w-auto" />
}

/** Holds the box's place while it loads, so the page does not jump. */
export function FocusNumberSkeleton() {
  return <div aria-hidden className="h-[88px] w-64 rounded-2xl bg-tint-sky/60" />
}
