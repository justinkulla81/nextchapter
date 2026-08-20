import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { computeAllCompanySignals } from '@/lib/companies/signals'
import { computeAllApplicationOutcomes } from '@/lib/companies/application-outcomes'
import { getOrCreateCompany, lookupCompanyByNormalizedName } from '@/lib/companies/company-lookup'
import type { Prisma } from '@prisma/client'

// Nightly company_signals + company_application_outcomes job — Phase 2
// Master Script, Part C, Prompt 2. Everything here comes from
// ExclusiveJobPosting and JobPosting, already-built infrastructure; no WARN
// input (see the CompanySignal schema comment for why) and no per-posting
// LLM call (see skills-extraction.ts for that cost-scoping decision).
//
// Idempotent via UPSERT on [companyId, weekStartDate], same "rerunning a
// week overwrites cleanly" convention as population-snapshot's cron — a
// mid-run crash just gets overwritten cleanly on the next run, not left
// half-stale.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const weekStartDate = getMondayOfWeek(new Date())
  const now = new Date()

  const signals = await computeAllCompanySignals(now)

  let signalsWritten = 0
  let signalErrors = 0
  for (const signal of signals) {
    try {
      const company = await getOrCreateCompany(signal.companyName)
      await prisma.companySignal.upsert({
        where: { companyId_weekStartDate: { companyId: company.id, weekStartDate } },
        update: {
          openRolesTotal: signal.openRolesTotal,
          openRolesDirectorPlus: signal.openRolesDirectorPlus,
          rolesDelta4wk: signal.rolesDelta4wk,
          rolesDelta12wk: signal.rolesDelta12wk,
          trajectory: signal.trajectory,
          topFunctionsHiring: signal.topFunctionsHiring as unknown as Prisma.InputJsonValue,
          topSkillsRequested: signal.topSkillsRequested as unknown as Prisma.InputJsonValue,
          medianPostingAgeDays: signal.medianPostingAgeDays,
        },
        create: {
          companyId: company.id,
          weekStartDate,
          openRolesTotal: signal.openRolesTotal,
          openRolesDirectorPlus: signal.openRolesDirectorPlus,
          rolesDelta4wk: signal.rolesDelta4wk,
          rolesDelta12wk: signal.rolesDelta12wk,
          trajectory: signal.trajectory,
          topFunctionsHiring: signal.topFunctionsHiring as unknown as Prisma.InputJsonValue,
          topSkillsRequested: signal.topSkillsRequested as unknown as Prisma.InputJsonValue,
          medianPostingAgeDays: signal.medianPostingAgeDays,
        },
      })
      signalsWritten++
    } catch (error) {
      signalErrors++
      console.error(`company-signals: failed for ${signal.companyName}`, error)
    }
  }

  // Application outcomes — only for companies that already have a Company
  // row (see application-outcomes.ts header comment on why this doesn't
  // create new ones from JobPosting's noisier free-text company names).
  const outcomes = await computeAllApplicationOutcomes()
  let outcomesWritten = 0
  let outcomeErrors = 0
  for (const outcome of outcomes) {
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
      console.error(`company-signals: outcome failed for ${outcome.companyNameNormalized}`, error)
    }
  }

  return NextResponse.json({
    weekStartDate: weekStartDate.toISOString(),
    signalsComputed: signals.length,
    signalsWritten,
    signalErrors,
    outcomesComputed: outcomes.length,
    outcomesWritten,
    outcomeErrors,
  })
}
