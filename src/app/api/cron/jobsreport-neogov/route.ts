import { NextResponse } from 'next/server'
import { runJobsReportNeogovFeed } from '@/lib/jobs/jobsreport-neogov-feed'
import { withCronRun } from '@/lib/cron/run'

export const maxDuration = 300

// Weekly (in bundle-gov-jobs-2). Keeps the jobs-report table's NEOGOV rows (geo us-neogov) current without GitHub secrets.
export const GET = withCronRun('jobsreport-neogov', async () => {
  const result = await runJobsReportNeogovFeed()
  console.log(`jobsreport-neogov: ${JSON.stringify(result)}`)
  return NextResponse.json(result)
})
