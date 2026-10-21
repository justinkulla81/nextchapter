import { prisma } from '@/lib/prisma'
import { getMemberEvidence } from '@/lib/evidence/load'
import { AI_SAMPLE_MAX_POINTS, EVIDENCE_POINTS } from '@/lib/evidence/score'
import { platformLabel, REVIEW_STATUS_LABEL } from '@/lib/evidence/external-reviews'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { renderMarkdownLinks } from '@/lib/text/render-markdown-links'
import { removeExternalReviews } from '@/app/dashboard/work-samples/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { ArrowRight, Check } from 'lucide-react'
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
  return <EvidenceView evidence={evidence} plusReason={plus.reason} reviews={reviews} />
}

type Evidence = Awaited<ReturnType<typeof getMemberEvidence>>
type Reviews = Awaited<ReturnType<typeof prisma.externalReviewStat.findMany>>

export function EvidenceView({ evidence, plusReason, reviews }: { evidence: Evidence; plusReason: string; reviews: Reviews }) {
  const tierLabel = evidence.tier === 'CANDIDATE_PLUS_VERIFIED' ? 'Candidate+ Verified' : evidence.tier === 'CANDIDATE_PLUS' ? 'Candidate+' : 'Member'
  const tierTone = evidence.tier === 'CANDIDATE_PLUS_VERIFIED' ? 'bg-success/10 text-success' : evidence.tier === 'CANDIDATE_PLUS' ? 'bg-brand/10 text-brand' : 'bg-muted text-muted-foreground'

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-6" aria-labelledby="evidence-heading">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-1">
          <h2 id="evidence-heading" className="font-serif text-2xl font-semibold tracking-tight text-navy">
            Your evidence
          </h2>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tierTone}`}>
            {evidence.tier === 'CANDIDATE_PLUS_VERIFIED' && <Check className="size-3.5" aria-hidden />}
            {tierLabel}
          </span>
        </div>
        <div className="min-w-40 text-right">
          <p className="text-4xl font-bold text-navy tabular-nums">
            {evidence.score}
            <span className="text-base font-medium text-muted-foreground"> of 100</span>
          </p>
          <div role="meter" aria-valuenow={evidence.score} aria-valuemin={0} aria-valuemax={100} aria-label="Evidence score" className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-orange" style={{ width: `${Math.min(100, evidence.score)}%` }} />
          </div>
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-xl bg-white px-4 py-3 text-base text-navy">
        <ArrowRight className="mt-1 size-4 shrink-0 text-orange" aria-hidden />
        <span>{evidence.nextStep}</span>
      </p>

      <p className="text-sm text-muted-foreground">
        {evidence.tier === 'MEMBER' ? (
          <>Recruiters and employers only see Candidate+ members. {renderMarkdownLinks(plusReason)}</>
        ) : (
          'Verified members appear first with recruiters and employers who use NextChapter, with an Evidence badge.'
        )}
      </p>

      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-primary underline underline-offset-4">How the score works</summary>
        <p className="mt-2 text-sm text-muted-foreground">
          Each completed reference {EVIDENCE_POINTS.reference} points, each work sample {EVIDENCE_POINTS.portfolio}, an AI work sample up to {AI_SAMPLE_MAX_POINTS} (most of it for a measured result),
          imported reviews up to {EVIDENCE_POINTS.importedReviewsMax} (more reviews and a higher rating earn more), reviews from NextChapter clients up to {EVIDENCE_POINTS.clientReview}. Each extra one of the same
          kind counts a bit less. Maximum 100.
        </p>
      </details>

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
        <summary className="cursor-pointer text-sm font-medium text-primary underline underline-offset-4">
          Add reviews from Upwork, Toptal, Catalant or another platform
        </summary>
        <div className="mt-3">
          <ExternalReviewsForm />
        </div>
      </details>
    </section>
  )
}
