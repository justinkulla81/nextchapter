import { prisma } from '@/lib/prisma'
import { getMemberEvidence } from '@/lib/evidence/load'
import { AI_SAMPLE_MAX_POINTS, EVIDENCE_POINTS } from '@/lib/evidence/score'
import { platformLabel, REVIEW_STATUS_LABEL } from '@/lib/evidence/external-reviews'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { renderMarkdownLinks } from '@/lib/text/render-markdown-links'
import { removeExternalReviews } from '@/app/dashboard/work-samples/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { ExternalReviewsForm } from './ExternalReviewsForm'

// The member's evidence score, their tier, the one thing that would raise it
// most, and their imported reviews from other platforms. Lives on Work
// Samples because work samples are themselves evidence.
export async function EvidenceCard({ candidateId }: { candidateId: string }) {
  const [evidence, plus, reviews] = await Promise.all([
    getMemberEvidence(candidateId),
    isDossierUnlocked(candidateId),
    prisma.externalReviewStat.findMany({ where: { candidateId }, orderBy: { createdAt: 'desc' } }),
  ])

  const headline =
    evidence.tier === 'CANDIDATE_PLUS_VERIFIED'
      ? `You're Candidate+ Verified. Evidence score: ${evidence.score} of 100.`
      : evidence.tier === 'CANDIDATE_PLUS'
        ? `You're Candidate+. Add one piece of evidence to become Candidate+ Verified. Evidence score: ${evidence.score} of 100.`
        : `Evidence score: ${evidence.score} of 100.`

  return (
    <section className="space-y-4 rounded-lg border border-border p-4" aria-labelledby="evidence-heading">
      <div className="space-y-1">
        <h2 id="evidence-heading" className="text-lg font-semibold tracking-tight">
          Your evidence
        </h2>
        <p className="text-sm font-medium text-foreground">{headline}</p>
        <p className="text-sm text-muted-foreground">{evidence.nextStep}</p>
        {evidence.tier === 'MEMBER' ? (
          <p className="text-sm text-muted-foreground">
            Recruiters and employers only see Candidate+ members. {renderMarkdownLinks(plus.reason)}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Verified members appear first with recruiters and employers who use NextChapter, with an Evidence badge.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          How it&apos;s scored: each completed reference {EVIDENCE_POINTS.reference} points, each work sample {EVIDENCE_POINTS.portfolio}, an AI work sample up to {AI_SAMPLE_MAX_POINTS} (most of it for a measured result),
          imported reviews up to {EVIDENCE_POINTS.importedReviewsMax} (more reviews and a higher rating earn more), reviews from NextChapter
          clients up to {EVIDENCE_POINTS.clientReview}. Each extra one of the same kind counts a bit less. Maximum 100.
        </p>
      </div>

      {reviews.length > 0 && (
        <ul className="space-y-2">
          {reviews.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-4 rounded-md bg-muted/40 p-3 text-sm">
              <div className="space-y-0.5">
                <p className="font-medium text-foreground">
                  {platformLabel(r.platform, r.platformLabel)}: {r.rating} average from {r.reviewCount.toLocaleString()} review
                  {r.reviewCount === 1 ? '' : 's'}
                  {r.jobsCompleted != null ? `, ${r.jobsCompleted.toLocaleString()} jobs` : ''}
                </p>
                <p className="text-muted-foreground">
                  {REVIEW_STATUS_LABEL[r.status] ?? r.status}
                  {r.status === 'REJECTED' && r.checkNote ? `: ${r.checkNote}` : ''}
                  {' · '}
                  <a href={r.profileUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                    View profile
                  </a>
                  {r.screenshotUrl && (
                    <>
                      {' · '}
                      <a href={r.screenshotUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                        Screenshot
                      </a>
                    </>
                  )}
                </p>
              </div>
              <form action={removeExternalReviews.bind(null, r.id)}>
                <SubmitButton variant="ghost" size="sm">
                  Remove
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}

      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-primary">
          Add reviews from Upwork, Toptal, Catalant or another platform
        </summary>
        <div className="mt-3">
          <ExternalReviewsForm />
        </div>
      </details>
    </section>
  )
}
