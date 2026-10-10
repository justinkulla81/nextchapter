import { describe, it, expect } from 'vitest'
import { EXCERPT_CHARS, excerptOf, skillsFrom } from '@/lib/jobs/posting-text'
import { jobSkillGap } from '@/lib/jobs/job-skill-gap'

describe('excerptOf', () => {
  it('keeps a short description whole and a missing one null', () => {
    expect(excerptOf('Lead the finance team.')).toBe('Lead the finance team.')
    expect(excerptOf('   ')).toBeNull()
    expect(excerptOf(null)).toBeNull()
  })

  it('truncates a long description near the limit, at a word, with an ellipsis', () => {
    const long = Array.from({ length: 800 }, (_, i) => `word${i}`).join(' ')
    const out = excerptOf(long)!
    expect(out.length).toBeLessThanOrEqual(EXCERPT_CHARS + 1)
    expect(out.endsWith('…')).toBe(true)
    expect(out.slice(0, -1).endsWith(' ')).toBe(false)
    // never ends in a half word: the last token is a whole "wordN"
    expect(out.slice(0, -1).split(' ').pop()).toMatch(/^word\d+$/)
  })
})

describe('skillsFrom', () => {
  it('reads skills from the FULL text, including past the stored excerpt', () => {
    const filler = 'We value collaboration and clear communication. '.repeat(60) // > 1,000 chars
    const text = `${filler} Requirements: experience with Snowflake and Airflow.`
    expect(excerptOf(text)!.toLowerCase()).not.toContain('snowflake') // excerpt lost it...
    expect(skillsFrom('Data Manager', text)).toEqual(expect.arrayContaining(['snowflake', 'airflow'])) // ...skills kept it
  })

  it('returns nothing for a posting with no description', () => {
    expect(skillsFrom('Director of Finance', null)).toEqual([])
  })
})

describe('jobSkillGap with stored skills', () => {
  it('uses the stored skills when the description is only an excerpt', () => {
    const g = jobSkillGap({
      title: 'Data Manager',
      description: 'Short excerpt that mentions nothing in the vocabulary.',
      skills: ['snowflake', 'airflow', 'python'],
      memberKeywords: ['python'],
    })
    expect(g.basis).toBe('posting')
    expect(g.have).toEqual(['python'])
    expect(g.missing).toEqual(['snowflake', 'airflow'])
  })

  it('still scans the description when no skills are stored', () => {
    const g = jobSkillGap({ title: 'Engineer', description: 'Python, SQL and Docker required.', skills: [], memberKeywords: [] })
    expect(g.basis).toBe('posting')
    expect(g.requested).toEqual(expect.arrayContaining(['python', 'sql']))
  })
})
