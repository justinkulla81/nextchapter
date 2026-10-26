import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { computeAllCompanySignals } from '@/lib/companies/signals'
import { getOrCreateCompany } from '@/lib/companies/company-lookup'
import type { Prisma } from '@prisma/client'
import { withCronRun } from '@/lib/cron/run'

// The signals write used to be one find + one upsert per company, run one at a
// time. With ~5,000 employers that outran the platform's 300-second limit around
// company 450, every night, on the same companies — so nine in ten never got a
// weekly signal. It is now a handful of bulk statements.
// Reading every open posting and matching skills in each one took 230-290 seconds on a board of
// ~530,000 live jobs, so any slow database moment cut the run off at 300 and the week had no
// signals. The two older snapshots are counted in SQL now, and the limit has room to spare.
export const maxDuration = 800

// Nightly company_signals job — Phase 2
// Master Script, Part C, Prompt 2. Everything here comes from
// ExclusiveJobPosting and JobPosting, already-built infrastructure; no WARN
// input (see the CompanySignal schema comment for why) and no per-posting
// LLM call (see skills-extraction.ts for that cost-scoping decision).
// Application outcomes (company-outcomes) and the company graph / industry sweep
// (company-graph) are their own jobs so none of them can starve another.
//
// Idempotent via UPSERT on [companyId, weekStartDate], same "rerunning a
// week overwrites cleanly" convention as population-snapshot's cron — a
// mid-run crash just gets overwritten cleanly on the next run, not left
// half-stale.
export const GET = withCronRun('company-signals', async () => {
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

  const allRows = [...rowByCompany.values()]

  // This week's rows are wholly derived from the postings, so they are replaced as
  // a unit: one transaction, readers see the old week until it commits, and a
  // crash leaves the old week intact (same "a rerun overwrites cleanly" contract
  // the per-row upsert had).
  const CHUNK = 500
  const write = (data: Prisma.CompanySignalCreateManyInput[]) => {
    const chunks: Prisma.CompanySignalCreateManyInput[][] = []
    for (let i = 0; i < data.length; i += CHUNK) chunks.push(data.slice(i, i + CHUNK))
    return prisma.$transaction([
      prisma.companySignal.deleteMany({ where: { weekStartDate } }),
      ...chunks.map((c) => prisma.companySignal.createMany({ data: c })),
    ])
  }
  // A company can be merged away (duplicate merge, delete) between the lookup above and
  // the write, which fails the whole week on the companyId foreign key. Keep only
  // companies that still exist, and if one vanishes in the gap, re-check once and retry.
  const stillExist = async (list: Prisma.CompanySignalCreateManyInput[]) => {
    const ids = new Set((await prisma.company.findMany({ where: { id: { in: list.map((r) => r.companyId) } }, select: { id: true } })).map((c) => c.id))
    return list.filter((r) => ids.has(r.companyId))
  }
  let rows = await stillExist(allRows)
  try {
    await write(rows)
  } catch (error) {
    if ((error as { code?: string }).code !== 'P2003') throw error
    rows = await stillExist(rows)
    await write(rows)
  }
  const skippedMerged = allRows.length - rows.length
  if (skippedMerged > 0) console.warn(`company-signals: skipped ${skippedMerged} companies merged away mid-run`)
  const signalsWritten = rows.length

  return NextResponse.json({
    weekStartDate: weekStartDate.toISOString(),
    signalsComputed: signals.length,
    signalsWritten,
    skippedMerged,
    signalErrors,
  })
})
