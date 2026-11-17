import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RESUME_NOT_REJECTED } from '@/lib/resume/not-rejected'

// `looksLikeResume: { not: false }` compiles to SQL `<> false`, which drops never-classified (NULL) uploads.
// On 2026-11-17 that hid the owner's own upload from the resume studio, so they only got the profile draft.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(name) ? [p] : []
  })
}

describe('resume upload filter', () => {
  it('keeps unclassified uploads', () => {
    expect(RESUME_NOT_REJECTED).toEqual({ OR: [{ looksLikeResume: null }, { looksLikeResume: true }] })
  })

  it('is not written as not: false anywhere', () => {
    const offenders = files(join(process.cwd(), 'src')).filter((f) => !f.endsWith('resume-not-rejected.test.ts') && /looksLikeResume:\s*\{\s*not:\s*false/.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })
})
