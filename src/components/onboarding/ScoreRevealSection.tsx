'use client'

import { useEffect, useRef, useState } from 'react'
import { GRADE_RECRUITER_IMPRESSION, type Grade } from '@/lib/scoring/grade'
import { GradeReveal } from '@/components/candidates/GradeReveal'
import { VictoriaAvatar } from '@/components/VictoriaAvatar'
import { pollScoreReveal } from '@/app/onboarding/score/actions'
import type { ProofOfWork } from '@/lib/onboarding/score-reveal'

const POLL_INTERVAL_MS = 3000
// ~1 minute — matches the outer bound the resume-analysis background job
// (dashboard/resume/actions.ts) is documented to take. If it's still not
// ready after this many attempts, something's actually wrong rather than
// just slow, so stop polling instead of hammering the server forever.
const MAX_POLL_ATTEMPTS = 20

// The grade is never ready synchronously on this page — see
// score-reveal.ts's own comment — so this never shows a bare "N/A" the way
// GradeReveal used to on its own. Renders the initial server-fetched state,
// then polls until the grade lands.
export function ScoreRevealSection({
  initialGrade,
  initialProofOfWork,
}: {
  initialGrade: Grade | null
  initialProofOfWork: ProofOfWork | null
}) {
  const [grade, setGrade] = useState(initialGrade)
  const [proofOfWork, setProofOfWork] = useState(initialProofOfWork)
  const attemptsRef = useRef(0)

  useEffect(() => {
    if (grade !== null) return
    let cancelled = false
    const interval = setInterval(async () => {
      attemptsRef.current += 1
      if (attemptsRef.current > MAX_POLL_ATTEMPTS) {
        clearInterval(interval)
        return
      }
      const result = await pollScoreReveal()
      if (cancelled) return
      if (result.grade !== null) {
        setGrade(result.grade)
        setProofOfWork(result.proofOfWork)
        clearInterval(interval)
      }
    }, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [grade])

  const stillCalculating = grade === null

  return (
    <>
      <div className="mx-auto w-full max-w-xl space-y-1 text-left">
        <div className="flex items-center gap-2">
          <VictoriaAvatar size={24} />
          <p className="text-xs text-muted-foreground">Victoria says:</p>
        </div>
        <div className="relative ml-2 space-y-3 rounded-2xl bg-muted/50 px-6 py-5">
          <div className="absolute -top-2 left-8 size-4 rotate-45 rounded-[3px] bg-muted/50" />
          <p className="text-sm text-foreground">
            {grade ? (
              <>
                Your Market Reality is <span className="font-semibold">{grade}</span>, which means{' '}
                {GRADE_RECRUITER_IMPRESSION[grade]}
              </>
            ) : (
              <>Still reading your resume — your grade will land here in a few seconds.</>
            )}
          </p>
          {proofOfWork ? (
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">I noticed:</p>
              <ul className="list-disc space-y-1.5 pl-4 text-sm text-foreground">
                <li>
                  <span className="font-semibold">{proofOfWork.recruiterNoticeCount}</span> potential
                  issue{proofOfWork.recruiterNoticeCount === 1 ? '' : 's'} a recruiter will notice
                </li>
                <li>
                  <span className="font-semibold">{proofOfWork.atsFilterCount}</span> thing
                  {proofOfWork.atsFilterCount === 1 ? '' : 's'} that applicant tracking systems will
                  filter out before a person ever sees it
                </li>
                {proofOfWork.topIssue && <li>Costing you the most: {proofOfWork.topIssue}</li>}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-foreground">
              Confidence goes up as I see which roles you&apos;re drawn to, which you reject, and
              what the market returns.
            </p>
          )}
        </div>
      </div>

      <GradeReveal grade={grade} calculating={stillCalculating} />
    </>
  )
}
