import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { PrintReportButton } from '@/components/dashboard/PrintReportButton'
import { getSourcedCandidateResumeSignedUrl } from '../actions'

export default async function CandidateBookPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const recruiter = await prisma.recruiter.findUnique({ where: { userId: user.id } })
  if (!recruiter) redirect('/recruiters/signup')

  const booked = await prisma.sourcedCandidate.findMany({
    where: { recruiterId: recruiter.id, inBook: true },
    orderBy: { name: 'asc' },
  })

  const withResumes = await Promise.all(
    booked.map(async (candidate) => ({
      candidate,
      resumeUrl: await getSourcedCandidateResumeSignedUrl(candidate.id),
    }))
  )

  captureServerEvent(recruiter.id, 'candidate_book_viewed', { count: booked.length })

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-16 print:max-w-none print:px-0">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <Link href="/recruiters/candidates" className="text-sm text-muted-foreground underline underline-offset-4">
            ← Back to my candidates
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">My candidate book</h1>
          <p className="mt-1 text-muted-foreground">
            The candidates you&apos;ve curated to present to an employer, with your commentary on each resume.
          </p>
        </div>
        {booked.length > 0 && <PrintReportButton />}
      </div>

      {booked.length === 0 ? (
        <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          Nothing here yet — open a signed-up candidate and select &quot;Add to book&quot; to include them.
        </p>
      ) : (
        <div className="space-y-6">
          {withResumes.map(({ candidate, resumeUrl }) => (
            <div key={candidate.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-foreground">{candidate.name}</p>
                  <p className="text-sm text-muted-foreground">{candidate.email}</p>
                </div>
                {resumeUrl && (
                  <a
                    href={resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-sm text-brand underline underline-offset-4 print:hidden"
                  >
                    View resume →
                  </a>
                )}
              </div>
              {candidate.resumeCommentary && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{candidate.resumeCommentary}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
