import 'server-only'
import { prisma } from '@/lib/prisma'
import { computeMarketRealityCompositeGrade } from '@/lib/scoring/market-reality/composite'
import type { Grade } from '@/lib/scoring/grade'

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
export interface ProofOfWork {
  recruiterNoticeCount: number
  atsFilterCount: number
  topIssue: string | null
}

export async function getProofOfWork(candidateId: string): Promise<ProofOfWork | null> {
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

export interface ScoreRevealData {
  grade: Grade | null
  proofOfWork: ProofOfWork | null
}

// The grade itself comes from computeMarketRealityCompositeGrade, which
// returns null until the after()-backgrounded resume analysis triggered by
// uploadResume (dashboard/resume/actions.ts) finishes — deliberately not
// awaited during upload, since it can take up to a minute (see that file's
// own comment). Called both for this page's initial server render and,
// when that first render still comes up null, by ScoreRevealSection's
// client-side poll (score/actions.ts) so the candidate never gets stuck
// looking at a grade that's simply not ready yet.
export async function getScoreRevealData(candidateId: string): Promise<ScoreRevealData> {
  const [composite, proofOfWork] = await Promise.all([
    computeMarketRealityCompositeGrade(candidateId),
    getProofOfWork(candidateId),
  ])
  return { grade: composite?.grade ?? null, proofOfWork }
}
