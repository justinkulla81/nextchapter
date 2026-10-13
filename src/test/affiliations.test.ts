import { describe, expect, it } from 'vitest'
import { AFFILIATION_LABELS, VISIBILITY, appliesAcrossAffiliations, visibleTo, type AffiliationKind } from '@/lib/affiliations/visibility'

const kinds = Object.keys(AFFILIATION_LABELS) as AffiliationKind[]

describe('who sees what', () => {
  it('no one ever sees mood check-ins', () => {
    for (const k of kinds) expect(VISIBILITY[k].mood.level).toBe('NONE')
  })
  it('only a coach sees how someone likes to be coached', () => {
    for (const k of kinds.filter((k) => k !== 'COACH')) expect(VISIBILITY[k].tone.level).toBe('NONE')
  })
  it('outplacement never sees an individual: counts only, and only on opt-in', () => {
    for (const r of Object.values(VISIBILITY.OUTPLACEMENT)) expect(r.level).not.toBe('MEMBER')
    expect(visibleTo('OUTPLACEMENT', new Set())).toEqual([])
  })
  it('recruiters see the Dossier only after the member opts in', () => {
    expect(visibleTo('RECRUITER', new Set())).toEqual([])
    expect(visibleTo('RECRUITER', new Set(['you opt in to the recruiter database']))).toEqual([{ field: 'dossier', level: 'MEMBER' }])
  })
  it('a college sees search detail only when the member shares it', () => {
    expect(visibleTo('COLLEGE', new Set()).some((v) => v.field === 'searchDetail')).toBe(false)
    expect(visibleTo('COLLEGE', new Set(['you share search detail with career services'])).some((v) => v.field === 'searchDetail')).toBe(true)
  })
})

describe('changes made through one affiliation', () => {
  it('a college "no longer looking" does not pause the whole member', () => {
    expect(appliesAcrossAffiliations('COLLEGE', { stage: 'STAYING' })).toBe(false)
  })
  it('facts that are true everywhere still apply: laid off, interviewing, offer, landed', () => {
    expect(appliesAcrossAffiliations('COLLEGE', { journey: 'LAID_OFF', stage: 'APPLYING' })).toBe(true)
    expect(appliesAcrossAffiliations('COLLEGE', { stage: 'LANDED' })).toBe(true)
  })
  it('the member can always change their own situation', () => {
    expect(appliesAcrossAffiliations('MEMBER', { stage: 'STAYING' })).toBe(true)
  })
})
