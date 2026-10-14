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
    it(`${f} does not filter by board work type`, () => {
      const src = readFileSync(path.resolve(__dirname, '../..', f), 'utf8')
      expect(src).not.toMatch(/workTypes|jobBoardWorkTypes|classifyWorkType/)
    })
  }
})
