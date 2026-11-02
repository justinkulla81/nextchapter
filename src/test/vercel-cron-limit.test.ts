import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Vercel rejects the whole deploy when vercel.json has more than 100 crons.
const VERCEL_CRON_LIMIT = 100

const config = JSON.parse(readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')) as {
  crons?: { path: string; schedule: string }[]
}

describe('vercel.json crons', () => {
  it(`stays within Vercel's limit of ${VERCEL_CRON_LIMIT}`, () => {
    expect((config.crons ?? []).length).toBeLessThanOrEqual(VERCEL_CRON_LIMIT)
  })

  it('has no duplicate path and schedule pairs', () => {
    const keys = (config.crons ?? []).map((c) => `${c.path} ${c.schedule}`)
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([])
  })
})
