// Shared tenure-in-role calculation for ResumeAnalysisFacts.roles — was
// duplicated identically in dimensions.ts and reviewer-questions.ts;
// extracted here so seniority-band.ts's new contextual-level branch can
// reuse the same math instead of adding a third copy.

import type { ResumeAnalysisFacts } from './extract-facts'

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30

export function roleTenureMonths(role: ResumeAnalysisFacts['roles'][number]): number | null {
  if (!role.startDate) return null
  const start = new Date(role.startDate).getTime()
  const end = role.endDate ? new Date(role.endDate).getTime() : Date.now()
  return (end - start) / MS_PER_MONTH
}
