// Guards the one landmine the Market Reality Grade recalibration explicitly
// found and fixed: market-reality/blend.ts's GRADE_MAX_SCORE table is a
// hand-authored mirror of grade.ts's scoreToGrade cutoffs (used for the
// market-cap math), and the two used to be two separately-maintained copies
// that could silently drift apart. blend.ts is now the single source of
// truth for GRADE_MAX_SCORE, but this test still asserts the derived
// relationship holds — belt-and-suspenders against a future hand-edit to
// either table without the other.
import { describe, it, expect } from 'vitest'
import { scoreToGrade, type Grade } from '@/lib/scoring/grade'
import { GRADE_MAX_SCORE, oneGradeAbove } from '@/lib/scoring/market-reality/blend'

describe('grade boundary consistency', () => {
  it('GRADE_MAX_SCORE[g] is exactly one below the floor of the grade above g', () => {
    const grades: Grade[] = ['F', 'D', 'C', 'B', 'A']
    for (const grade of grades) {
      const above = oneGradeAbove(grade)
      if (above === grade) continue // A has no grade above it
      expect(scoreToGrade(GRADE_MAX_SCORE[grade] + 1), `GRADE_MAX_SCORE.${grade} + 1 should score as ${above}`).toBe(above)
      expect(scoreToGrade(GRADE_MAX_SCORE[grade]), `GRADE_MAX_SCORE.${grade} should still score as ${grade}`).toBe(grade)
    }
  })
})
