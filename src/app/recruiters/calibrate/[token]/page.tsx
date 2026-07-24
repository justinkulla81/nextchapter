import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CalibrationTool } from '@/components/recruiter/CalibrationTool'

export default async function RecruiterCalibratePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const recruiter = await prisma.recruiter.findUnique({ where: { accessToken: token } })
  if (!recruiter) notFound()

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">NextChapter for Recruiters</p>
        <h1 className="text-2xl font-semibold tracking-tight">Search Calibration Memo</h1>
        <p className="text-muted-foreground">
          Paste a client brief and get an instant read on redundant requirements, conflicting
          asks, comp mismatches, and adjacent profiles worth considering.
        </p>
      </div>
      <CalibrationTool token={token} />
      <div className="mt-10 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-4 text-sm">
        <Link href={`/recruiters/job-board/submit/${token}`} className="text-primary underline underline-offset-4">
          Post a role to the Job Board
        </Link>
        <Link
          href={`/recruiters/job-board/submissions/${token}`}
          className="text-primary underline underline-offset-4"
        >
          My Job Board postings
        </Link>
      </div>
    </div>
  )
}
