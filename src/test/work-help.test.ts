import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/anthropic', () => ({ getAnthropicClient: () => ({}) }))
vi.mock('@/lib/community/moderation', () => ({ looksLikePromptInjection: () => false }))

import { findLeak, scrubKnown, type KnownIdentifiers } from '@/lib/work-help/leak'
import { canSeeQuestion } from '@/lib/work-help/eligibility'
import { genericAnalysis, normalizeAnalysis } from '@/lib/work-help/analyze'
import { OPTION_CATALOG } from '@/lib/work-help/constants'

const ids: KnownIdentifiers = { names: ['Justin Kulla'], companies: ['Acme Corp', 'Globex'], places: ['Denver'] }

describe('leak checks', () => {
  it('removes the member’s name, employers and city, and reports what it found', () => {
    const { text, found } = scrubKnown('At Acme Corp in Denver, my boss told Justin to wait.', ids)
    expect(text).not.toMatch(/acme|denver|justin/i)
    expect([...found].sort()).toEqual(['company', 'name', 'place'])
  })

  it('does not touch words that merely contain a known name', () => {
    const { text } = scrubKnown('Denverite traditions and globexample are unrelated.', ids)
    expect(text).toBe('Denverite traditions and globexample are unrelated.')
  })

  it('flags a leftover company, name, city, contact detail, link or blank marker', () => {
    expect(findLeak('I work at globex and it is hard', ids)).toMatch(/company/)
    expect(findLeak('Email me at a.b@example.com', ids)).toMatch(/email/)
    expect(findLeak('See https://example.com/post', ids)).toMatch(/link/)
    expect(findLeak('My manager at [removed] keeps doing this', ids)).toMatch(/blank/)
  })

  it('passes a general question', () => {
    expect(findLeak('How do you handle a manager who takes credit for your work?', ids)).toBeNull()
  })
})

describe('who can see a question', () => {
  const q = { candidateId: 'asker', seniorityBand: 'SENIOR', excludedCompanies: ['acme'] }
  it('shows it to someone at the same level at another company', () => {
    expect(canSeeQuestion({ id: 'v', seniorityBand: 'SENIOR', companies: ['initech'] }, q)).toBe(true)
  })
  it('hides it from the asker, other levels, and anyone at the asker’s employer', () => {
    expect(canSeeQuestion({ id: 'asker', seniorityBand: 'SENIOR', companies: [] }, q)).toBe(false)
    expect(canSeeQuestion({ id: 'v', seniorityBand: 'MID', companies: [] }, q)).toBe(false)
    expect(canSeeQuestion({ id: 'v', seniorityBand: 'SENIOR', companies: ['acme'] }, q)).toBe(false)
  })
  it('does not narrow by level when the asker’s level is unknown', () => {
    expect(canSeeQuestion({ id: 'v', seniorityBand: 'MID', companies: [] }, { ...q, seniorityBand: null })).toBe(true)
  })
})

describe('the options', () => {
  const opt = (key: keyof typeof OPTION_CATALOG) => ({ key, why: 'a reason', firstStep: 'a step' })
  it('keeps looking outside last, drops repeats, and caps at four', () => {
    const r = normalizeAnalysis({
      acknowledgement: 'That is hard.',
      needsLegalPointer: false,
      options: [opt('look_outside'), opt('document_impact'), opt('document_impact'), opt('talk_directly'), opt('internal_move'), opt('coach_session')],
    })
    expect(r?.options.map((o) => o.key)).toEqual(['document_impact', 'talk_directly', 'internal_move', 'coach_session'])
  })
  it('gives up on a single option so the standard set is used', () => {
    expect(normalizeAnalysis({ acknowledgement: 'x', needsLegalPointer: false, options: [opt('look_outside')] })).toBeNull()
  })
  it('never starts the standard set with leaving', () => {
    const g = genericAnalysis()
    expect(g.options[0].key).not.toBe('look_outside')
    expect(g.generic).toBe(true)
  })
})

describe('who can use it', () => {
  it('shows the Help entry only to employed members', async () => {
    const { REDESIGN_PLACES } = await import('@/lib/nav/redesign-places')
    const { visibleTabs } = await import('@/lib/nav/places')
    const help = REDESIGN_PLACES.find((p) => p.key === 'help')!
    expect(visibleTabs(help, { employed: true }).some((t) => t.href === '/dashboard/work-help')).toBe(true)
    expect(visibleTabs(help, { employed: false }).some((t) => t.href === '/dashboard/work-help')).toBe(false)
  })

  it('uses the same employed check as the in-work workspace', async () => {
    const { canUseWorkHelp } = await import('@/lib/work-help/access')
    const { isInWorkMember } = await import('@/lib/in-work/constants')
    expect(canUseWorkHelp).toBe(isInWorkMember)
  })
})
