import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { computeAllCompanySignals } from '@/lib/companies/signals'
import { computeAllApplicationOutcomes } from '@/lib/companies/application-outcomes'
import { getOrCreateCompany, lookupCompanyByNormalizedName } from '@/lib/companies/company-lookup'
import type { Prisma } from '@prisma/client'
import { syncCompanyGraph } from '@/lib/companies/company-graph-sync'
import { sweepCompanyIndustries } from '@/lib/companies/industry-sweep'

// The signals write used to be one find + one upsert per company, run one at a
// time. With ~5,000 employers that outran the platform's 300-second limit around
// company 450, every night, on the same companies — so nine in ten never got a
// weekly signal. It is now a handful of bulk statements.
export const maxDuration = 300

const INDUSTRY_SWEEP_LIMIT = 300 // companies per night (~$0.60 at most)
const INDUSTRY_SWEEP_DEADLINE_MS = 150_000

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

  // One lookup for every existing company; only the (few) employers with no row
  // yet cost a create.
  const idByKey = new Map(
    (await prisma.company.findMany({ select: { id: true, canonicalNameNormalized: true } })).map((c) => [
      c.canonicalNameNormalized,
      c.id,
    ])
  )
  let signalErrors = 0
  const rows: Prisma.CompanySignalCreateManyInput[] = []
  for (const signal of signals) {
    try {
      let companyId = idByKey.get(signal.companyNameNormalized)
      if (!companyId) {
        companyId = (await getOrCreateCompany(signal.companyName)).id
        idByKey.set(signal.companyNameNormalized, companyId)
      }
      rows.push({
        companyId,
        weekStartDate,
        openRolesTotal: signal.openRolesTotal,
        openRolesDirectorPlus: signal.openRolesDirectorPlus,
        rolesDelta4wk: signal.rolesDelta4wk,
        rolesDelta12wk: signal.rolesDelta12wk,
        trajectory: signal.trajectory,
        topFunctionsHiring: signal.topFunctionsHiring as unknown as Prisma.InputJsonValue,
        topSkillsRequested: signal.topSkillsRequested as unknown as Prisma.InputJsonValue,
        medianPostingAgeDays: signal.medianPostingAgeDays,
      })
    } catch (error) {
      signalErrors++
      console.error(`company-signals: failed for ${signal.companyName}`, error)
    }
  }

  // This week's rows are wholly derived from the postings, so they are replaced as
  // a unit: one transaction, readers see the old week until it commits, and a
  // crash leaves the old week intact (same "a rerun overwrites cleanly" contract
  // the per-row upsert had).
  const CHUNK = 500
  const chunks: Prisma.CompanySignalCreateManyInput[][] = []
  for (let i = 0; i < rows.length; i += CHUNK) chunks.push(rows.slice(i, i + CHUNK))
  await prisma.$transaction([
    prisma.companySignal.deleteMany({ where: { weekStartDate } }),
    ...chunks.map((data) => prisma.companySignal.createMany({ data })),
  ])
  const signalsWritten = rows.length

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

  // Keep the company graph whole (postings, employers, firms, CRM organisations)
  // and give new companies an industry — both bounded, both incremental.
  let graph = null
  let industries = null
  try {
    graph = await syncCompanyGraph({ postingNameLimit: 300 })
  } catch (error) {
    console.error('company-signals: company graph sync failed', error)
  }
  try {
    industries = await sweepCompanyIndustries({ limit: INDUSTRY_SWEEP_LIMIT, deadlineMs: INDUSTRY_SWEEP_DEADLINE_MS })
  } catch (error) {
    console.error('company-signals: industry sweep failed', error)
  }

  return NextResponse.json({
    weekStartDate: weekStartDate.toISOString(),
    graph,
    industries,
    signalsComputed: signals.length,
    signalsWritten,
    signalErrors,
    outcomesComputed: outcomes.length,
    outcomesWritten,
    outcomeErrors,
  })
}
