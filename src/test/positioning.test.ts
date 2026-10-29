import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { FACTS, POSITIONING } from '@/lib/seo/facts'

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    if (f === 'test' || f === 'node_modules') return []
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : []
  })
}

describe('positioning line', () => {
  it('is the one category line', () => {
    expect(POSITIONING).toBe('the leading job transition platform')
    expect(FACTS.tagline).toBe('The leading job transition platform for white-collar workers.')
    expect(FACTS.summary).toContain(POSITIONING)
  })

  // Published reports and the editorial pages are included: assistants quote them, and on 2026-10-29 they were still calling
  // NextChapter a "career-transition platform" and "career-transition software". The standard wording is "job transition".
  it('has no retired wording in source, reports included', () => {
    const bad = files(join(process.cwd(), 'src')).filter((f) => /career[- ]transition (platform|software|services)/i.test(readFileSync(f, 'utf8')))
    expect(bad).toEqual([])
  }, 60_000)
})
