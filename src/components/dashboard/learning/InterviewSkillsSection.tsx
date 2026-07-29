import Link from 'next/link'
import type { InterviewSkillsData } from '@/lib/learning/build-learning-plan'

// Branches on what's actually true for this candidate rather than showing
// the same three links to everyone — no narrative yet is a different next
// step than a narrative nobody feels ready to say out loud, which is
// different again from already having a live job description to prep
// against.
export function InterviewSkillsSection({ data }: { data: InterviewSkillsData }) {
  if (!data.hasNarrative) {
    return (
      <div className="rounded-lg border border-border p-4">
        <p className="text-sm text-foreground">
          You haven&apos;t built your core story yet — that&apos;s the foundation everything else in
          Interview Prep adapts from.
        </p>
        <Link
          href="/dashboard/interview-prep"
          className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-4"
        >
          Build your story
        </Link>
      </div>
    )
  }

  if (data.narrativeComfortIsLow) {
    return (
      <div className="rounded-lg border border-border p-4">
        {data.coreStatementExcerpt && (
          <p className="text-sm italic text-foreground">&ldquo;{data.coreStatementExcerpt}&rdquo;</p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          You said you&apos;re not fully comfortable telling this yet — the fastest way to fix that
          is saying it out loud until it stops feeling rehearsed.
        </p>
        <Link
          href="/dashboard/interview-prep"
          className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-4"
        >
          Practice it
        </Link>
      </div>
    )
  }

  if (data.hasActiveJobDescription) {
    return (
      <div className="rounded-lg border border-border p-4">
        <p className="text-sm text-foreground">
          You have an active job description on file — Tough Questions are already generated
          against it, specific to this role instead of generic.
        </p>
        <Link
          href="/dashboard/interview-prep"
          className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-4"
        >
          Review Tough Questions
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm text-foreground">
        Your story&apos;s built and you feel good about it — add a job description in Interview Prep
        to get questions tailored to a specific role.
      </p>
      <Link
        href="/dashboard/interview-prep"
        className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-4"
      >
        Go to Interview Prep
      </Link>
    </div>
  )
}
