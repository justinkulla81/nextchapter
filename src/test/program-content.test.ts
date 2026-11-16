import { describe, expect, it } from 'vitest'
import { analyzeJobSpec, SAMPLE_SPEC } from '@/lib/workforce/program-content'

describe('analyzeJobSpec', () => {
  it('reads the sample finance role: flags tasks, suggests skills, notes wording', () => {
    const r = analyzeJobSpec(SAMPLE_SPEC)
    expect(r.family).toBe('Finance and accounting')
    expect(r.tasks.map((t) => t.phrase)).toEqual(expect.arrayContaining(['Data entry', 'Drafting routine messages', 'Summaries and notes']))
    expect(r.adds.length).toBeGreaterThan(0)
    expect(r.wording.some((w) => w.includes('equivalent experience'))).toBe(true)
    expect(r.wording.some((w) => w.includes('does not mention AI'))).toBe(true)
  })
  it('does not ask for AI fluency when the spec already names AI', () => {
    const r = analyzeJobSpec('Marketing manager. You will use generative AI tools to draft campaigns and measure results.')
    expect(r.alreadyMentionsAi).toBe(true)
    expect(r.adds.some((a) => a.skill === 'AI tool fluency')).toBe(false)
  })
  it('falls back to a general reading for an unrecognised role', () => {
    const r = analyzeJobSpec('Lighthouse keeper responsible for the lamp and the logbook on the northern coast.')
    expect(r.family).toBeNull()
    expect(r.adds.length).toBeGreaterThan(0)
  })
})
