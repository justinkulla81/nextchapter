import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// The seasonal-adjustment step lives in a Python script (scripts/employment-report/nc_white_collar_index.py). This runs its own checks
// against the published public/reports/wc-index.csv, so the factors, the adjusted rates and the index cannot drift from the site file.
const python = (() => {
  try {
    execFileSync('python3', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

describe('wc index seasonal adjustment (Python script)', () => {
  it.skipIf(!python)('passes its own checks against the published series', () => {
    const script = path.join(process.cwd(), 'scripts/employment-report/test_seasonal.py')
    const out = execFileSync('python3', ['-I', script], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    expect(out).toBe('')
  })
})
