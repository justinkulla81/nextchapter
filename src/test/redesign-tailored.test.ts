import { describe, it, expect } from 'vitest'
import { buildTailored, type TailoredInput } from '@/lib/redesign/tailored'
import type { Signal } from '@/lib/personalization/signals'

const sig = (key: Signal['key'], known: boolean, weight: number): Signal => ({ key, known, weight, label: known ? `${key} set` : `Add ${key}`, effect: 'jobs near you', href: `/dashboard/x/${key}` })
const base: TailoredInput = {
  journeyLabel: 'Laid off, looking',
  weekInSearch: 4,
  coachingStyle: 'GENTLE_ENCOURAGEMENT',
  signals: [sig('city', true, 25), sig('tools', false, 20), sig('industries', false, 15), sig('clearance', false, 0)],
  relocationAnswered: false,
  moneyHelp: null,
  targetCompanies: 0,
  recruitersCanSee: true,
  confidential: false,
  skillsConfirmed: 5,
  skillsToBuild: 0,
  exploringOtherRoles: false,
}

describe('buildTailored', () => {
  it('lists four groups, each row with one place to change it', () => {
    const { groups } = buildTailored(base)
    expect(groups.map((g) => g.title)).toEqual(['Your journey and how you are doing', 'Better jobs', 'Warmer introductions', 'Closer to hired'])
    for (const r of groups.flatMap((g) => g.rows)) expect(r.href.startsWith('/dashboard')).toBe(true)
  })

  it('names the open item that helps most as the best next step, with a button label', () => {
    const best = buildTailored(base).best
    expect(best?.key).toBe('signal-tools')
    expect(best?.cta).toBe('Add tools')
  })

  it('has no best step when everything is answered', () => {
    const done: TailoredInput = { ...base, signals: [sig('city', true, 25)], relocationAnswered: true, targetCompanies: 3, skillsToBuild: 2 }
    expect(buildTailored(done).best).toBeNull()
  })

  it('shows the clearance signal only when it is known', () => {
    const keys = buildTailored(base).groups[1].rows.map((r) => r.key)
    expect(keys).not.toContain('signal-clearance')
    expect(buildTailored({ ...base, signals: [sig('clearance', true, 0)] }).groups[1].rows.map((r) => r.key)).toContain('signal-clearance')
  })

  it('leaves out the recruiter row in confidential mode', () => {
    expect(buildTailored({ ...base, confidential: true }).groups[2].rows.map((r) => r.key)).not.toContain('recruiters')
  })

  it('says what is not set rather than hiding it', () => {
    const rows = buildTailored({ ...base, journeyLabel: null, coachingStyle: null }).groups[0].rows
    expect(rows[0].label).toBe('Your journey: not set')
    expect(rows[1].label).toBe('Tone: not chosen')
    expect(rows.every((r) => !r.done)).toBe(true)
  })
})
