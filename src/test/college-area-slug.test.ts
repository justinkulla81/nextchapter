import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { areaSlug, collegePath, territoryFromCodeSlug } from '@/lib/seo/college-bar'

// Puerto Rico college links were built with stateSlug, which gives "pr", so every one was a 404 (2026-11-19).
describe('college addresses for territories', () => {
  it('uses the territory name, not its code', () => {
    expect(collegePath(areaSlug('PR'), 'atlantic-university')).toBe('/higher-education/puerto-rico/atlantic-university')
    expect(areaSlug('NY')).toBe('new-york')
    expect(areaSlug('VI')).toBe('u-s-virgin-islands')
  })

  it('recognizes the old code addresses so they can redirect', () => {
    expect(territoryFromCodeSlug('pr')).toBe('PR')
    expect(territoryFromCodeSlug('gu')).toBe('GU')
    expect(territoryFromCodeSlug('ny')).toBeNull()
    expect(territoryFromCodeSlug('puerto-rico')).toBeNull()
  })

  it('no code builds a college path with stateSlug', () => {
    const files: string[] = []
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f)
        if (statSync(p).isDirectory()) { if (f !== 'test') walk(p) } else if (/\.tsx?$/.test(f)) files.push(p)
      }
    }
    walk(join(process.cwd(), 'src'))
    const bad = files.filter((f) => readFileSync(f, 'utf8').includes('collegePath(stateSlug('))
    expect(bad).toEqual([])
  })
})
