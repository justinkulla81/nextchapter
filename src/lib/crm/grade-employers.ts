import 'server-only'
import type { CrmLeadQuality } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { nextGrade, type AutoGrade } from './grade-rules'

const CHUNK = 5000

export interface GradeRunResult { considered: number; changed: number; toA: number; toB: number; toC: number }

/**
 * Grades employer organizations that are still ungraded and raises the ones this job
 * graded earlier when a layoff notice or enough open jobs now exist. Nightly, set-based
 * reads and chunked writes; rules live in grade-rules.ts.
 */
export async function gradeEmployerOrgs(): Promise<GradeRunResult> {
  const rows = await prisma.$queryRaw<
    { id: string; grade: CrmLeadQuality; setBy: string | null; hasLayoffNotice: boolean; openNow: number }[]
  >`
    SELECT o.id, o."leadQuality" AS grade, o."leadQualitySetBy" AS "setBy",
      EXISTS (SELECT 1 FROM "WarnNotice" w WHERE w."companyId" = o."companyId") AS "hasLayoffNotice",
      COALESCE((SELECT h."openNow" FROM "CompanyHiringProfile" h WHERE h."companyId" = o."companyId"), 0)::int AS "openNow"
    FROM "CrmOrganization" o
    WHERE 'EMPLOYER' = ANY (o."orgTypes"::text[])
      AND (o."leadQuality" = 'UNGRADED' OR o."leadQualitySetBy" = 'AUTO')
  `
  const byGrade: Record<AutoGrade, string[]> = { A: [], B: [], C: [] }
  for (const r of rows) {
    const g = nextGrade(r.grade, r.setBy, { hasLayoffNotice: r.hasLayoffNotice, openNow: r.openNow })
    if (g) byGrade[g].push(r.id)
  }
  const result: GradeRunResult = { considered: rows.length, changed: 0, toA: byGrade.A.length, toB: byGrade.B.length, toC: byGrade.C.length }
  for (const grade of ['A', 'B', 'C'] as const) {
    const ids = byGrade[grade]
    for (let i = 0; i < ids.length; i += CHUNK) {
      // The guard repeats the eligibility rule, so a grade set by hand between the
      // read above and this write is left alone.
      const { count } = await prisma.crmOrganization.updateMany({
        where: { id: { in: ids.slice(i, i + CHUNK) }, OR: [{ leadQuality: 'UNGRADED' }, { leadQualitySetBy: 'AUTO' }] },
        data: { leadQuality: grade, leadQualitySetBy: 'AUTO' },
      })
      result.changed += count
    }
  }
  return result
}
