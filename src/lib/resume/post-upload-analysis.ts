import 'server-only'
import { prisma } from '@/lib/prisma'
import { analyzeResume } from '@/lib/resume/analyze-resume'
import { computeResumeAnalysis } from '@/lib/scoring/resume-analysis/compute'
import { computeMarketRealityComponents } from '@/lib/scoring/market-reality/compute'
import { computeMarketRealityCompositeGrade } from '@/lib/scoring/market-reality/composite'
import { applyResumeImprovedRewrite } from '@/lib/scoring/rewrite-actions'
import { maybeNotifyAdminOfNewCandidate } from '@/lib/email/send-admin-new-candidate-account'
import { syncCandidateToCrm } from '@/lib/crm/candidate-sync'
import { captureServerEvent } from '@/lib/posthog/server'

// Everything that follows a new résumé but is not needed to show the next screen: the legacy and new-engine
// analysis, the Market Reality refresh, the admin notice, the CRM mirror and the improvement baseline. Shared by
// the dashboard upload (run in after()) and the onboarding background parse (run once the profile is filled).
export async function runPostUploadAnalysis(
  profileId: string,
  resumeId: string,
  previousResume: { atsScore: number | null; resultsScore: number | null; experienceScore: number | null } | null,
): Promise<void> {
  // §11 decision (additive, not destructive): computeResumeAnalysis (the
  // new 5-component engine's Experience/Resume scorer, resume-analysis/
  // compute.ts) now runs on every upload alongside the LEGACY analyzeResume
  // — it is NOT run instead of it. The legacy Resume.atsScore/atsFeedback/
  // resultsScore/resultsFeedback/experienceScore/experienceFeedback fields
  // still have real, live, unmigrated consumers this change deliberately
  // does not touch: src/app/dashboard/resume/page.tsx (renders them
  // directly), src/app/onboarding/score/page.tsx (score-reveal, by its own
  // explicit design comment), src/lib/admin/recruiter-database.ts,
  // src/lib/scoring/rewrite-actions.ts's applyResumeImprovedRewrite (called
  // a few lines below), and src/lib/scoring/dossier-competencies.ts (the
  // six-category blended grade, ~23 other live consumers this session has
  // chosen not to touch). Retiring the legacy path is a separate, larger
  // migration across all of those call sites — out of scope here.
  const [, resumeAnalysisResult] = await Promise.all([
    analyzeResume(resumeId),
    // Unlike analyzeResume (which catches its own errors and writes
    // analysisError instead of throwing — see that file), computeResumeAnalysis
    // has no such internal guard yet. Caught locally so a new-engine
    // failure degrades to "no ResumeAnalysis row yet" rather than
    // aborting the rest of this background block.
    computeResumeAnalysis(resumeId).catch((error) => {
      console.error('Failed to compute new-engine resume analysis:', error)
      return null
    }),
  ])
  captureServerEvent(profileId, 'resume_analyzed')

  // Refresh the live Market Reality Assessment composite (MarketRealityComponentScore)
  // right after a new ResumeAnalysis exists — Experience/Resume are read
  // from the latest ResumeAnalysis row (see market-reality/compute.ts), so
  // this is the natural trigger point. Evidence/Effort/Market are also
  // recomputed here rather than left stale, since they're cheap, non-LLM
  // computations (DB counts + a cached market lookup) — not because a
  // resume upload logically changes them.
  if (resumeAnalysisResult) {
    try {
      await computeMarketRealityComponents(profileId)
      await computeMarketRealityCompositeGrade(profileId)
    } catch (error) {
      console.error('Failed to refresh Market Reality Assessment composite after resume upload:', error)
    }
  }

  // Extraction above is what typically first learns the candidate's real
  // name/email — this is the main trigger point for the single admin
  // new-candidate notification (no-ops until both are actually known).
  maybeNotifyAdminOfNewCandidate(profileId).catch(() => {})
  // Mirrors every real candidate into the CRM — safe to call repeatedly
  // (see candidate-sync.ts), and must never block or fail resume upload.
  syncCandidateToCrm(profileId).catch(() => {})

  try {
    const analyzed = await prisma.resume.findUnique({
      where: { id: resumeId },
      select: { atsScore: true, resultsScore: true, experienceScore: true },
    })
    if (analyzed) {
      await applyResumeImprovedRewrite(profileId, previousResume, analyzed)
    }
  } catch (error) {
    console.error('Failed to apply resume-improved baseline rewrite:', error)
  }
}
