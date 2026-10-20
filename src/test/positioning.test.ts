import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { FACTS, POSITIONING } from '@/lib/seo/facts'

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    // Published report text is editorial and quotes other sources.
    if (f === 'test' || f === 'node_modules' || f === 'reports') return []
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : []
  })
}

describe('positioning line', () => {
  it('is the one category line', () => {
    expect(POSITIONING).toBe('the leading job transition platform')
    expect(FACTS.tagline).toBe('The leading job transition platform for white-collar workers.')
    expect(FACTS.summary).toContain(POSITIONING)
  })

  it('has no retired wording in source', () => {
    const bad = files(join(process.cwd(), 'src')).filter((f) => /career[- ]transition platform/i.test(readFileSync(f, 'utf8')))
    expect(bad).toEqual([])
  }, 60_000)
})
