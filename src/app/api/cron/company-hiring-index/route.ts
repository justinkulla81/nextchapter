import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { rebuildHiringIndex } from '@/lib/companies/hiring-index'

export const maxDuration = 300

// Nightly company hiring index (src/lib/companies/hiring-index.ts): links unlinked
// postings to companies, copies open board postings into the opening history,
// closes openings whose listing was archived, rebuilds the market pay benchmarks,
// prices every opening and live posting against them, and recomputes each
// company's hiring profile and employer pay level. Set-based SQL; rerun-safe.
export const GET = withCronRun('company-hiring-index', async () => {
  const result = await rebuildHiringIndex()
  return NextResponse.json(result)
})
