import { describe, expect, it } from 'vitest'
import { MAX_IMPORT, jobStatusLabel, parseJobRows } from '@/lib/workforce/group-jobs'

describe('parseJobRows', () => {
  it('reads pipe, tab and comma rows, skipping a header', () => {
    const text = ['Title,Company,Location,Link', 'Controller | Acme Co | Louisville, KY | https://acme.example/jobs/1', 'Analyst\tBeta\tLouisville\thttps://beta.example/2', '"Director, Ops",Gamma,Remote,https://gamma.example/3'].join('\n')
    const { rows, errors } = parseJobRows(text)
    expect(errors).toEqual([])
    expect(rows.map((r) => r.title)).toEqual(['Controller', 'Analyst', 'Director, Ops'])
    expect(rows[0]).toMatchObject({ company: 'Acme Co', location: 'Louisville, KY', url: 'https://acme.example/jobs/1' })
  })
  it('refuses a bare link, a bad link and a repeated link, with the line number', () => {
    const { rows, errors } = parseJobRows(['https://only-a-link.example/x', 'T | C | L | not a url', 'T | C | L | https://ok.example/1', 'T2 | C2 | L | https://ok.example/1'].join('\n'))
    expect(rows).toHaveLength(1)
    expect(errors.map((e) => e.line)).toEqual([1, 2, 4])
  })
  it('stops at the import limit and says so', () => {
    const text = Array.from({ length: MAX_IMPORT + 5 }, (_, i) => `T${i} | C | L | https://x.example/${i}`).join('\n')
    const r = parseJobRows(text)
    expect(r.rows).toHaveLength(MAX_IMPORT)
    expect(r.truncated).toBe(true)
  })
  it('names the status in plain words', () => {
    expect(jobStatusLabel('pending', false, false)).toBe('Waiting for NextChapter review')
    expect(jobStatusLabel('approved', false, false)).toBe('Live for your group')
    expect(jobStatusLabel('approved', false, true)).toBe('Expired')
    expect(jobStatusLabel('rejected', false, false)).toBe('Not approved')
    expect(jobStatusLabel('approved', true, false)).toBe('Removed')
    expect(jobStatusLabel('org_pending', false, false)).toBe('Waiting for your review')
  })
})
