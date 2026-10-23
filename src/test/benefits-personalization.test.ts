import { describe, expect, it } from 'vitest'
import catalog from '@/lib/benefits/catalog.json'
import { matchPrograms, type MemberFacts } from '@/lib/benefits/match'
import type { BenefitProgramRow } from '@/lib/benefits/types'

const rows = (catalog as unknown as { rows: (Omit<BenefitProgramRow, 'checkedAt'> & { checkedAt: string | null })[] }).rows.map((r) => ({ ...r, checkedAt: r.checkedAt ? new Date(r.checkedAt) : null })) as BenefitProgramRow[]

const marketer: MemberFacts = { state: 'TX', city: 'Austin', relocation: { scope: 'LOCAL', states: [] }, laidOff: true, pivoting: false, tags: [], workKnown: true, answered: true }
const PROFESSION_WORDS = /physicians?|nurses?|clinicians?|dentists?|pharmacists?|attorneys?|lawyers?|teachers?|educators?|professors?|engineers?|social workers?|journalists?|musicians?|geoscien|speech-language|audiolog/i
const PROFESSION_BODIES = /\b(IEEE|ASME|ASCE|NSPE|ACEP|AHRA|AMA|NASW|AGU|ASHA|CFA Institute|AICPA|SHRM|PMI|SPE)\b/

describe('personalization: nothing we know does not apply is shown', () => {
  it('shows a marketer in Texas no other state, no other city, and no profession-only program', () => {
    const m = matchPrograms(rows, marketer)
    expect(m.length).toBeGreaterThan(20)
    for (const x of m) {
      const p = x.program
      if (p.scope === 'STATE' && x.goal !== 'move') expect(p.state, p.name).toBe('TX')
      if (p.locality && x.goal !== 'move') expect(p.locality.toLowerCase(), p.name).toContain('austin')
      expect(`${p.name} ${p.eligibility ?? ''}`, p.name).not.toMatch(PROFESSION_WORDS)
      expect(p.name, p.name).not.toMatch(PROFESSION_BODIES)
    }
  })

  it('shows relocation money only for states the member would move to', () => {
    const stays = matchPrograms(rows, marketer).filter((x) => x.goal === 'move' && x.program.scope === 'STATE')
    expect(stays).toHaveLength(0)
    const picks = matchPrograms(rows, { ...marketer, relocation: { scope: 'STATES', states: ['MD'] } }).filter((x) => x.goal === 'move' && x.program.scope === 'STATE')
    for (const x of picks) expect(x.program.state).toBe('MD')
  })

  it('shows a profession program to that profession only', () => {
    const nurse = matchPrograms(rows, { ...marketer, tags: ['clinician'] })
    const nurseText = nurse.map((x) => `${x.program.name} ${x.program.eligibility ?? ''}`).join('\n')
    const marketerText = matchPrograms(rows, marketer).map((x) => `${x.program.name} ${x.program.eligibility ?? ''}`).join('\n')
    expect(nurse.length).toBeGreaterThanOrEqual(matchPrograms(rows, marketer).length - 5)
    expect(PROFESSION_WORDS.test(nurseText) || /ACEP|AHRA|\bAMA\b|ASHA/.test(nurseText)).toBe(true)
    expect(PROFESSION_WORDS.test(marketerText)).toBe(false)
  })

  it('keeps group-specific programs in when we have not asked, and drops them once the member answers no', () => {
    const unanswered = matchPrograms(rows, { ...marketer, answered: false })
    const answered = matchPrograms(rows, marketer)
    expect(unanswered.length).toBeGreaterThan(answered.length)
    expect(answered.some((x) => /\bVET TEC\b|GI Bill/i.test(x.program.name))).toBe(false)
    expect(unanswered.some((x) => /\bVET TEC\b|GI Bill/i.test(x.program.name))).toBe(true)
  })

  it('keeps profession programs in when we do not know the member\'s work', () => {
    const unknownWork = matchPrograms(rows, { ...marketer, workKnown: false })
    expect(unknownWork.length).toBeGreaterThan(matchPrograms(rows, marketer).length)
  })

  it('shows each real program once, even when it is filed twice', () => {
    const m = matchPrograms(rows, { ...marketer, relocation: { scope: 'ANYWHERE', states: [] } })
    const keys = m.map((x) => `${(x.program.url ?? '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[#?].*$/, '').replace(/\/$/, '')}|${x.program.state}|${x.goal}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('shows statewide programs to residents of that state, and not to residents of other states', () => {
    const ga = matchPrograms(rows, { ...marketer, state: 'GA', city: 'Atlanta' }).map((x) => x.program.name)
    expect(ga.some((n) => /Georgia partial earnings allowance/i.test(n))).toBe(true)
    const tx = matchPrograms(rows, marketer).map((x) => x.program.name)
    expect(tx.some((n) => /Georgia partial earnings allowance/i.test(n))).toBe(false)
  })
})
