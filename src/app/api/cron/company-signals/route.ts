import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { computeAllCompanySignals } from '@/lib/companies/signals'
import { computeAllApplicationOutcomes } from '@/lib/companies/application-outcomes'
import { getOrCreateCompany, lookupCompanyByNormalizedName } from '@/lib/companies/company-lookup'
import type { Prisma } from '@prisma/client'
import { syncCompanyGraph } from '@/lib/companies/company-graph-sync'
import { sweepCompanyIndustries } from '@/lib/companies/industry-sweep'
import { withCronRun } from '@/lib/cron/run'

// The signals write used to be one find + one upsert per company, run one at a
// time. With ~5,000 employers that outran the platform's 300-second limit around
// company 450, every night, on the same companies — so nine in ten never got a
// weekly signal. It is now a handful of bulk statements.
export const maxDuration = 300

const INDUSTRY_SWEEP_LIMIT = 300 // companies per night (~$0.60 at most)
const INDUSTRY_SWEEP_DEADLINE_MS = 150_000
// The whole run must finish inside maxDuration. The signals and outcomes are the
// job; the graph sync and industry sweep are incremental extras, so they only run
// with time to spare and the sweep's own deadline is trimmed to what is left.
const RUN_BUDGET_MS = 270_000
const GRAPH_SYNC_MIN_LEFT_MS = 90_000
const SWEEP_MIN_LEFT_MS = 40_000

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
export const GET = withCronRun('company-signals', async () => {
  const runStart = Date.now()
  const msLeft = () => RUN_BUDGET_MS - (Date.now() - runStart)
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
  // Two employer-name keys can resolve to one company (spelling variants, merged
  // duplicates, aliases). The week's row is unique per company, so those collapse
  // into one: counts add up, the rest comes from whichever name had more roles.
  const rowByCompany = new Map<string, Prisma.CompanySignalCreateManyInput>()
  for (const signal of signals) {
    try {
      let companyId = idByKey.get(signal.companyNameNormalized)
      if (!companyId) {
        companyId = (await getOrCreateCompany(signal.companyName)).id
        idByKey.set(signal.companyNameNormalized, companyId)
      }
      const next: Prisma.CompanySignalCreateManyInput = {
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
      }
      const prev = rowByCompany.get(companyId)
      if (!prev) {
        rowByCompany.set(companyId, next)
      } else {
        const lead = (next.openRolesTotal ?? 0) > (prev.openRolesTotal ?? 0) ? next : prev
        rowByCompany.set(companyId, {
          ...lead,
          openRolesTotal: (prev.openRolesTotal ?? 0) + (next.openRolesTotal ?? 0),
          openRolesDirectorPlus: (prev.openRolesDirectorPlus ?? 0) + (next.openRolesDirectorPlus ?? 0),
          rolesDelta4wk: (prev.rolesDelta4wk ?? 0) + (next.rolesDelta4wk ?? 0),
          rolesDelta12wk: (prev.rolesDelta12wk ?? 0) + (next.rolesDelta12wk ?? 0),
        })
      }
    } catch (error) {
      signalErrors++
      console.error(`company-signals: failed for ${signal.companyName}`, error)
    }
  }

  const rows = [...rowByCompany.values()]

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
    if (msLeft() < 60_000) {
      console.warn('company-signals: outcomes cut short, out of time')
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
      console.error(`company-signals: outcome failed for ${outcome.companyNameNormalized}`, error)
    }
  }

  // Keep the company graph whole (postings, employers, firms, CRM organisations)
  // and give new companies an industry — both bounded, both incremental.
  let graph = null
  let industries = null
  if (msLeft() > GRAPH_SYNC_MIN_LEFT_MS) {
    try {
      graph = await syncCompanyGraph({ postingNameLimit: 300 })
    } catch (error) {
      console.error('company-signals: company graph sync failed', error)
    }
  } else {
    console.warn('company-signals: skipped company graph sync, out of time')
  }
  if (msLeft() > SWEEP_MIN_LEFT_MS) {
    try {
      industries = await sweepCompanyIndustries({
        limit: INDUSTRY_SWEEP_LIMIT,
        deadlineMs: Math.min(INDUSTRY_SWEEP_DEADLINE_MS, msLeft() - 20_000),
      })
    } catch (error) {
      console.error('company-signals: industry sweep failed', error)
    }
  } else {
    console.warn('company-signals: skipped industry sweep, out of time')
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
})
