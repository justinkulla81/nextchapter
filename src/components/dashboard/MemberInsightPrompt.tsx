import { getNextJobToReview } from '@/lib/job-reviews/data'
import { JobReviewPromptCard } from '@/components/job-reviews/JobReviewPromptCard'
import { CultureSurveyPrompt } from '@/components/dashboard/CultureSurveyPrompt'

// The dashboard's last-priority prompt slot: ask the member to review one former job;
// when they have none left to review, fall back to describing a company's culture.
export async function MemberInsightPrompt({ candidateId }: { candidateId: string }) {
  const next = await getNextJobToReview(candidateId)
  if (!next) return <CultureSurveyPrompt candidateId={candidateId} />
  return (
    <JobReviewPromptCard
      moreCount={next.moreCount}
      job={{
        id: next.job.id,
        companyName: next.job.companyName,
        roleTitle: next.job.roleTitle,
        dates: `${next.job.startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} – ${next.job.endDate ? next.job.endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'present'}`,
        isCurrent: false,
        review: null,
      }}
    />
  )
}
