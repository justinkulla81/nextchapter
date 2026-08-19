import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getCandidateProfileForUser } from '@/lib/onboarding/get-profile'
import { computeMarketRealityCompositeGrade } from '@/lib/scoring/market-reality/composite'
import { GradeReveal } from '@/components/candidates/GradeReveal'
import { Button } from '@/components/ui/button'
import { VictoriaAvatar } from '@/components/VictoriaAvatar'

// §10's registration-gate worked example ("We read your resume. There are
// {n} things a recruiter will notice, {m} that applicant tracking systems
// will filter out...") wants real, itemized counts as proof of work, not a
// bare grade ring. The only resume-analysis data actually populated at this
// point in the live app is the legacy Resume.atsFeedback/resultsFeedback/
// experienceFeedback fields (analyze-resume.ts, called from the resume
// upload action) — the new 5-component engine's ReviewerQuestion/
// AtsParseResult tables (resume-analysis/compute.ts) are real and tested
// but NOT YET wired into the live upload flow (see that file's own header
// comment), so they're empty for every real candidate today. Building this
// screen on unpopulated tables would show "0 things" to everyone, which is
// worse than not having the feature — so this reads the legacy arrays
// instead. atsFeedback is scan/mechanics-oriented copy (the prompt asks for
// "what a recruiter scanning this will notice"), so it stands in for the
// ATS bucket; results+experience feedback are substance-of-the-narrative
// issues, so they stand in for the general "recruiter will notice" bucket.
// Revisit once §11 wires the new engine into resume upload for real.
interface ProofOfWork {
  recruiterNoticeCount: number
  atsFilterCount: number
  topIssue: string | null
}

async function getProofOfWork(candidateId: string): Promise<ProofOfWork | null> {
  const resume = await prisma.resume.findFirst({
    where: { candidateId },
    orderBy: { uploadedAt: 'desc' },
    select: {
      atsScore: true,
      atsFeedback: true,
      resultsScore: true,
      resultsFeedback: true,
      experienceScore: true,
      experienceFeedback: true,
      analyzedAt: true,
    },
  })
  if (!resume || !resume.analyzedAt) return null

  type FeedbackItem = { issue: string; action: string }
  const atsFeedback = (resume.atsFeedback ?? []) as unknown as FeedbackItem[]
  const resultsFeedback = (resume.resultsFeedback ?? []) as unknown as FeedbackItem[]
  const experienceFeedback = (resume.experienceFeedback ?? []) as unknown as FeedbackItem[]

  const scored = [
    { score: resume.atsScore, feedback: atsFeedback },
    { score: resume.resultsScore, feedback: resultsFeedback },
    { score: resume.experienceScore, feedback: experienceFeedback },
  ].filter((s): s is { score: number; feedback: FeedbackItem[] } => s.score !== null)
  const lowestScored = scored.length > 0 ? scored.reduce((a, b) => (b.score < a.score ? b : a)) : null

  return {
    recruiterNoticeCount: resultsFeedback.length + experienceFeedback.length,
    atsFilterCount: atsFeedback.length,
    topIssue: lowestScored?.feedback[0]?.issue ?? null,
  }
}

export default async function ScorePage() {
  const profile = await getCandidateProfileForUser()

  if (!profile.assessmentComplete) {
    redirect('/onboarding')
  }

  if (profile.registrationCompletedAt) {
    redirect('/dashboard')
  }

  const [composite, proofOfWork] = await Promise.all([
    computeMarketRealityCompositeGrade(profile.id),
    getProofOfWork(profile.id),
  ])

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        {profile.firstName ? `Nice work, ${profile.firstName}!` : 'Your Current Market Reality'}
      </h1>

      <div className="mx-auto w-full max-w-xl space-y-1 text-left">
        <div className="flex items-center gap-2">
          <VictoriaAvatar size={24} />
          <p className="text-xs text-muted-foreground">Victoria says:</p>
        </div>
        <div className="relative ml-2 rounded-2xl bg-muted/50 px-6 py-5">
          <div className="absolute -top-2 left-8 size-4 rotate-45 rounded-[3px] bg-muted/50" />
          {proofOfWork ? (
            <ul className="list-disc space-y-1.5 pl-4 text-sm text-foreground">
              <li>
                <span className="font-semibold">{proofOfWork.recruiterNoticeCount}</span> thing
                {proofOfWork.recruiterNoticeCount === 1 ? '' : 's'} a recruiter will notice
              </li>
              <li>
                <span className="font-semibold">{proofOfWork.atsFilterCount}</span> thing
                {proofOfWork.atsFilterCount === 1 ? '' : 's'} that applicant tracking systems will
                filter out before a person ever sees it
              </li>
              {proofOfWork.topIssue && (
                <li>Costing you the most: {proofOfWork.topIssue}</li>
              )}
            </ul>
          ) : (
            <ul className="list-disc space-y-1.5 pl-4 text-sm text-foreground">
              <li>Your initial grade is based on what you&apos;ve told me</li>
              <li>Confidence goes up as I see which roles you&apos;re drawn to, which you reject, and what the market returns</li>
            </ul>
          )}
        </div>
      </div>

      <Button nativeButton={false} render={<Link href="/onboarding/create-account" />}>
        Create your account to get your full report and action plan
      </Button>

      <GradeReveal grade={composite?.grade ?? null} />
    </div>
  )
}
