import type { NextRequest } from 'next/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import type { SearchCheckInAnswer } from '@prisma/client'
import { applyJourneyChange } from '@/lib/journey/apply'
import { changeForAnswer, effectiveJourney, effectiveStage, type CheckInAnswer } from '@/lib/journey/journey'

// No-login response link for the Saturday "Are you still searching?" email
// — same access-control shape as /ref/[token] (an unguessable cuid token
// IS the auth), but a single GET click instead of a form: each of the
// email's 3 buttons links straight here with a different `answer` param.
const ANSWER_MAP: Record<string, SearchCheckInAnswer> = {
  still_searching: 'STILL_SEARCHING',
  taking_a_break: 'TAKING_A_BREAK',
  got_an_offer: 'GOT_AN_OFFER',
}
const EMAIL_TO_CHECK_IN: Record<SearchCheckInAnswer, CheckInAnswer> = {
  STILL_SEARCHING: 'nothing',
  TAKING_A_BREAK: 'break',
  GOT_AN_OFFER: 'offer',
}
const ANSWER_SLUG: Record<SearchCheckInAnswer, string> = {
  STILL_SEARCHING: 'still_searching',
  TAKING_A_BREAK: 'taking_a_break',
  GOT_AN_OFFER: 'got_an_offer',
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const rawAnswer = request.nextUrl.searchParams.get('answer')
  const answer = rawAnswer ? ANSWER_MAP[rawAnswer] : undefined

  if (!answer) {
    redirect('/checkin/thanks?status=invalid')
  }

  const checkIn = await prisma.candidateSearchCheckIn.findUnique({ where: { token } })
  if (!checkIn) {
    redirect('/checkin/thanks?status=invalid')
  }

  // Idempotent — a candidate re-clicking (or a mail client prefetching
  // links) never overwrites a real first answer. If they click a
  // DIFFERENT button after already answering, the confirmation must still
  // reflect what's actually stored, not the new click's param — otherwise
  // the page and the database would tell two different stories.
  if (!checkIn.respondedAt) {
    await prisma.candidateSearchCheckIn.update({
      where: { token },
      data: { answer, respondedAt: new Date() },
    })
    // The email promises the answer changes things; now it does
    // (src/lib/journey/apply.ts): a break pauses, an offer moves to Offer.
    const profile = await prisma.candidateProfile.findUnique({
      where: { id: checkIn.candidateId },
      select: { journey: true, journeyStage: true, currentJobStatus: true },
    })
    if (profile) {
      await applyJourneyChange(checkIn.candidateId, {
        ...changeForAnswer(EMAIL_TO_CHECK_IN[answer], { journey: effectiveJourney(profile), stage: effectiveStage(profile) }),
        source: 'SEARCH_CHECKIN_EMAIL',
        isCheckIn: true,
      })
    }
    redirect(`/checkin/thanks?answer=${rawAnswer}`)
  }

  redirect(`/checkin/thanks?answer=${ANSWER_SLUG[checkIn.answer!]}`)
}
