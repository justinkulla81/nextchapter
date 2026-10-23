import { NextResponse } from 'next/server'
import { syncCompanyGraph } from '@/lib/companies/company-graph-sync'
import { sweepCompanyIndustries } from '@/lib/companies/industry-sweep'
import { gradeEmployerOrgs } from '@/lib/crm/grade-employers'
import { tagNewChroTitles } from '@/lib/crm/chro-tagging'
import { withCronRun } from '@/lib/cron/run'

// Nightly company-graph upkeep: link postings, employers, firms and CRM organisations to
// their directory company, then give new companies an industry. Both are bounded and
// incremental. These used to run at the tail of company-signals and were skipped whenever
// the signals took most of the 300 seconds; now they have a run of their own.
export const maxDuration = 300

const INDUSTRY_SWEEP_LIMIT = 300 // companies per night (~$0.60 at most)
const INDUSTRY_SWEEP_DEADLINE_MS = 150_000
const RUN_BUDGET_MS = 270_000
const GRAPH_SYNC_MIN_LEFT_MS = 90_000
const SWEEP_MIN_LEFT_MS = 40_000
const CRM_UPKEEP_MIN_LEFT_MS = 30_000

export const GET = withCronRun('company-graph', async () => {
  const runStart = Date.now()
  const msLeft = () => RUN_BUDGET_MS - (Date.now() - runStart)

  // Keep the company graph whole (postings, employers, firms, CRM organisations)
  // and give new companies an industry — both bounded, both incremental.
  let graph = null
  let industries = null
  if (msLeft() > GRAPH_SYNC_MIN_LEFT_MS) {
    try {
      graph = await syncCompanyGraph({ postingNameLimit: 300 })
    } catch (error) {
      console.error('company-graph: company graph sync failed', error)
    }
  } else {
    console.warn('company-graph: skipped company graph sync, out of time')
  }
  // CRM upkeep: grade new employer organizations (and raise grades the job set earlier),
  // and tag new CHRO titles. Cheap SQL, no paid services; runs before the slow industry sweep.
  let grading = null
  let chroTagged = null
  if (msLeft() > CRM_UPKEEP_MIN_LEFT_MS) {
    try {
      grading = await gradeEmployerOrgs()
    } catch (error) {
      console.error('company-graph: employer grading failed', error)
    }
    try {
      chroTagged = await tagNewChroTitles()
    } catch (error) {
      console.error('company-graph: CHRO tagging failed', error)
    }
  } else {
    console.warn('company-graph: skipped CRM grading and CHRO tagging, out of time')
  }
  if (msLeft() > SWEEP_MIN_LEFT_MS) {
    try {
      industries = await sweepCompanyIndustries({
        limit: INDUSTRY_SWEEP_LIMIT,
        deadlineMs: Math.min(INDUSTRY_SWEEP_DEADLINE_MS, msLeft() - 20_000),
      })
    } catch (error) {
      console.error('company-graph: industry sweep failed', error)
    }
  } else {
    console.warn('company-graph: skipped industry sweep, out of time')
  }

  return NextResponse.json({ graph, grading, chroTagged, industries })
})
