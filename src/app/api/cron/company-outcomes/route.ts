import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { computeAllApplicationOutcomes } from '@/lib/companies/application-outcomes'
import { lookupCompanyByNormalizedName } from '@/lib/companies/company-lookup'
import { withCronRun } from '@/lib/cron/run'

// Nightly company_application_outcomes job. It used to be the second half of
// company-signals, which spent most of its 300 seconds on the signals and cut this
// short ("outcomes cut short, out of time"). Now it has the whole budget to itself.
// Idempotent via UPSERT on [companyId, weekStartDate].
export const maxDuration = 300

const RUN_BUDGET_MS = 270_000

export const GET = withCronRun('company-outcomes', async () => {
  const runStart = Date.now()
  const msLeft = () => RUN_BUDGET_MS - (Date.now() - runStart)
  const weekStartDate = getMondayOfWeek(new Date())

  // Application outcomes — only for companies that already have a Company
  // row (see application-outcomes.ts header comment on why this doesn't
  // create new ones from JobPosting's noisier free-text company names).
  const outcomes = await computeAllApplicationOutcomes()
  let outcomesWritten = 0
  let outcomeErrors = 0
  for (const outcome of outcomes) {
    if (msLeft() < 60_000) {
      console.warn('company-outcomes: outcomes cut short, out of time')
      break
    }
    try {
      const company = await lookupCompanyByNormalizedName(outcome.companyNameNormalized)
      if (!company) continue
      await prisma.companyApplicationOutcome.upsert({
        where: { companyId_weekStartDate: { companyId: company.id, weekStartDate } },
        update: {
          applications: outcome.applications,
          responses: outcome.responses,
          interviews: outcome.interviews,
          offers: outcome.offers,
          avgDaysToInterview: outcome.avgDaysToInterview,
          avgDaysToRejection: outcome.avgDaysToRejection,
        },
        create: {
          companyId: company.id,
          weekStartDate,
          applications: outcome.applications,
          responses: outcome.responses,
          interviews: outcome.interviews,
          offers: outcome.offers,
          avgDaysToInterview: outcome.avgDaysToInterview,
          avgDaysToRejection: outcome.avgDaysToRejection,
        },
      })
      outcomesWritten++
    } catch (error) {
      outcomeErrors++
      console.error(`company-outcomes: outcome failed for ${outcome.companyNameNormalized}`, error)
    }
  }

  return NextResponse.json({
    weekStartDate: weekStartDate.toISOString(),
    outcomesComputed: outcomes.length,
    outcomesWritten,
    outcomeErrors,
  })
})
