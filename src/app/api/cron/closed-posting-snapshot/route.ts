import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/run'
import { rebuildClosedPostingSnapshot } from '@/lib/jobs/ghost-risk-data'

export const maxDuration = 300

// Nightly rebuild of the closed-postings snapshot (ghost-risk-data.ts): how many times each company + title + location has been posted
// and closed, grouped once here so no server instance has to. It was a step of the board-light-rows job until 2026-11-07, when that job was
// cut off twice without writing it; as its own job it runs after the reconcile (04:40, up to about 13 minutes) and cannot be starved by it.
// Safe to run again at any time: it adds a row and keeps the newest few. Each step's time goes on the ledger row, so a stall names its step.
export const GET = withCronRun(
  'closed-posting-snapshot',
  async (_request, ctx) => {
    const { keys } = await rebuildClosedPostingSnapshot((step, ms) => ctx.progress({ step, ms }))
    return NextResponse.json({ closedPostingKeys: keys })
  },
  { recordResult: true }
)
