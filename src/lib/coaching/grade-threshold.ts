import type { Grade } from '@/lib/scoring/grade'

const GRADE_ORDER: Grade[] = ['A', 'B', 'C', 'D', 'F']

export function isAtOrBelowGrade(grade: Grade, threshold: Grade): boolean {
  return GRADE_ORDER.indexOf(grade) >= GRADE_ORDER.indexOf(threshold)
}
