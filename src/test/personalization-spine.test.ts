import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { JOURNEYS } from '@/lib/journey/journey'
import { SIGNALS, isSet, spineFor, spineGaps, spineProgress, type Drive } from '@/lib/personalization/spine'

const root = join(__dirname, '../..')
const leaf = (field: string, token?: string) => token ?? field.split('.').pop()!

describe('every question drives something that exists', () => {
  it('has unique keys, a question, a place to answer it and an opportunity', () => {
    expect(new Set(SIGNALS.map((s) => s.key)).size).toBe(SIGNALS.length)
    for (const s of SIGNALS) {
      expect(s.question.endsWith('?'), s.key).toBe(true)
      expect(s.where.href.startsWith('/'), s.key).toBe(true)
      expect(s.opportunity.length, s.key).toBeGreaterThan(20)
    }
  })
  it('drives at least one of the plan, learning, networking, opportunities, report or coaching', () => {
    for (const s of SIGNALS) {
      const drives = Object.entries(s.drives).filter(([, v]) => !!v) as [Drive, string][]
      expect(drives.length, s.key).toBeGreaterThan(0)
      for (const [, text] of drives) expect(text.length, s.key).toBeGreaterThan(15)
    }
  })
  it('names real files that really read the field', () => {
    const problems: string[] = []
    for (const s of SIGNALS) {
      if (s.readBy.length === 0) problems.push(`${s.key}: names no reader`)
      for (const file of s.readBy) {
        const path = join(root, file)
        if (!existsSync(path)) {
          problems.push(`${s.key}: ${file} does not exist`)
          continue
        }
        if (!new RegExp(`\\b${leaf(s.field, s.token)}\\b`).test(readFileSync(path, 'utf8'))) problems.push(`${s.key}: ${file} never reads ${leaf(s.field, s.token)}`)
      }
    }
    expect(problems).toEqual([])
  })
})

describe('every journey and stage has a spine', () => {
  it('each journey is asked enough to be personalized, at its starting stage', () => {
    for (const j of JOURNEYS) {
      const asked = spineFor(j.key, j.defaultStage)
      expect(asked.length, j.key).toBeGreaterThanOrEqual(5)
      // Every journey is asked how to coach and how comfortable reaching out is: the base of networking and coaching.
      expect(asked.map((s) => s.key), j.key).toEqual(expect.arrayContaining(['network_comfort', 'coaching_style', 'level', 'function']))
    }
  })
  it('a search needs more than a break does', () => {
    expect(spineFor('LAID_OFF', 'APPLYING').length).toBeGreaterThan(spineFor('TIME_OFF', 'STAYING').length)
  })
  it('career change needs the target function; others do not', () => {
    expect(spineFor('CAREER_CHANGE', 'EXPLORING').map((s) => s.key)).toContain('target_function')
    expect(spineFor('LAID_OFF', 'APPLYING').map((s) => s.key)).not.toContain('target_function')
  })
  it('fractional members are asked about their offer, open days and when an engagement ends', () => {
    expect(spineFor('FRACTIONAL', 'STAYING').map((s) => s.key)).toEqual(expect.arrayContaining(['offering', 'capacity', 'engagement_end']))
  })
  it('taking a break is asked for a return date, not a job search', () => {
    const keys = spineFor('TIME_OFF', 'STAYING').map((s) => s.key)
    expect(keys).toContain('return_date')
    expect(keys).not.toContain('target_role')
    expect(keys).not.toContain('application_volume')
  })
})

describe('culture is asked only if it matters', () => {
  const keys = (p: Record<string, unknown>) => spineFor('LAID_OFF', 'PREPARING', p).map((s) => s.key)
  it('always asks how much it matters', () => {
    expect(keys({})).toContain('culture_importance')
  })
  it('skips the details when it does not matter, or is not answered', () => {
    expect(keys({})).not.toContain('culture_details')
    expect(keys({ cultureFit: { importance: 'NOT_IMPORTANT' } })).not.toContain('culture_details')
  })
  it('asks the details when it matters', () => {
    expect(keys({ cultureFit: { importance: 'SOMEWHAT' } })).toContain('culture_details')
    expect(keys({ cultureFit: { importance: 'VERY' } })).toContain('culture_details')
  })
})

describe('what is missing', () => {
  it('names each gap with what it drives and what it opens', () => {
    const gaps = spineGaps('LAID_OFF', 'APPLYING', {})
    expect(gaps.length).toBeGreaterThan(5)
    for (const g of gaps) {
      expect(g.label.endsWith('?')).toBe(true)
      expect(g.why.length).toBeGreaterThan(15)
      expect(g.unlocks.length).toBeGreaterThan(15)
    }
  })
  it('fills in as the member answers', () => {
    const before = spineProgress('LAID_OFF', 'APPLYING', {})
    const after = spineProgress('LAID_OFF', 'APPLYING', { targetRoleType: 'VP Operations', highestLevelReached: 'VP' })
    expect(after.total).toBe(before.total)
    expect(after.done).toBe(before.done + 2)
    expect(spineGaps('LAID_OFF', 'APPLYING', { targetRoleType: 'VP Operations' }).map((g) => g.key)).not.toContain('target_role')
  })
  it('reads dotted paths and treats empty values as unanswered', () => {
    expect(isSet({ journeyDetails: { returnDate: '2026-12-01' } }, 'journeyDetails.returnDate')).toBe(true)
    expect(isSet({ journeyDetails: {} }, 'journeyDetails.returnDate')).toBe(false)
    expect(isSet({ targetIndustries: [] }, 'targetIndustries')).toBe(false)
    expect(isSet({ dealBreakers: '  ' }, 'dealBreakers')).toBe(false)
    expect(isSet({ openToRelocation: false }, 'openToRelocation')).toBe(true)
  })
})
