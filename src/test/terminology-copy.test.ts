import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Owner decision (docs/candidate-redesign.md, "Terms stay consistent"): "Higher education",
// not "Higher ed", where there is room. These files hold copy a member reads.
const CANDIDATE_COPY_FILES = [
  'src/lib/search-firms/match.ts',
  'src/lib/search-firms/recommend.ts',
  'src/lib/constants/industry-job-boards.ts',
  'src/lib/marketing/workforce-numbers-format.ts',
]

// Lines that match on text or name a real product (HigherEdJobs), not copy.
const NOT_COPY = /keywords|'higher education': \[|\.test\(|HigherEdJobs|higheredjobs|nonprofit_higher_ed|higher_ed|^\s*(\/\/|\*)/

describe('candidate-facing terminology', () => {
  for (const file of CANDIDATE_COPY_FILES) {
    it(`${file} says "higher education", not "higher ed"`, () => {
      const src = readFileSync(path.join(process.cwd(), file), 'utf8')
      const offending = src
        .split('\n')
        .filter((line) => !NOT_COPY.test(line))
        .filter((line) => /higher[ -]ed\b/i.test(line))
      expect(offending).toEqual([])
    })
  }
})
