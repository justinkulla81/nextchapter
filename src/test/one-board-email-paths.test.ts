import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// The one board's work-type filter must not change who gets which jobs by email:
// fresh-job alerts and Job Search Daily stay on their current (unfiltered) selection
// until the owner approves an opt-in. Guard: neither passes workTypes or reads the
// member's board choice.
const EMAIL_SELECTION_FILES = ['src/lib/jobs/fresh-job-alerts.ts', 'src/lib/job-search-daily/build.ts', 'src/lib/jobs/email-fit-scoring.ts']

describe('email job selection is unchanged by the one board', () => {
  for (const f of EMAIL_SELECTION_FILES) {
    it(`${f} ignores the member's board work-type toggles`, () => {
      const src = readFileSync(path.resolve(__dirname, '../..', f), 'utf8')
      expect(src).not.toMatch(/workTypes|jobBoardWorkTypes/)
    })
  }
  // Owner's rule (2026-10-15): fresh-job alerts send full-time jobs only.
  it('fresh-job alerts keep only full-time jobs', () => {
    const src = readFileSync(path.resolve(__dirname, '../..', 'src/lib/jobs/fresh-job-alerts.ts'), 'utf8')
    expect(src).toMatch(/classifyWorkType\(p\) === 'full_time'/)
  })
})
