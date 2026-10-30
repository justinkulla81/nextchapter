import { describe, expect, it } from 'vitest'
import { CITATION_PROMPTS } from '@/lib/ai-visibility/prompts'
import { citationGroupOf, citationShare } from '@/lib/mcp/tracking'

describe('MCP tracking', () => {
  it('only groups prompt keys that exist', () => {
    const keys = new Set(CITATION_PROMPTS.map((p) => p.key))
    const grouped = CITATION_PROMPTS.filter((p) => citationGroupOf(p.key))
    expect(grouped.length).toBeGreaterThan(15)
    expect(citationGroupOf('resume-ai-ats')).toBe('resume')
    expect(keys.has('resume-ai-ats')).toBe(true)
  })
  it('counts cited over asked per group and skips errors', () => {
    const s = citationShare([
      { promptKey: 'resume-ai-ats', cited: true, error: null },
      { promptKey: 'resume-after-layoff', cited: false, error: null },
      { promptKey: 'resume-help-senior', cited: true, error: 'timeout' },
      { promptKey: 'data:state:TX', cited: true, error: null },
    ])
    expect(s.resume).toEqual({ asked: 2, cited: 1 })
    expect(s.job_search).toEqual({ asked: 0, cited: 0 })
  })
})
