import { describe, expect, it } from 'vitest'
import { readPostingAi } from '@/lib/ai-skills/taxonomy'

const keys = (r: ReturnType<typeof readPostingAi>) => r.skills.map((s) => s.key).sort()

describe('readPostingAi', () => {
  it('reads nothing from a posting with no AI in it', () => {
    expect(readPostingAi('Accounts Payable Manager', 'Own month-end close and vendor payments.')).toEqual({ tier: null, skills: [] })
  })

  it('puts an AI engineer in the builder tier and asks for build level', () => {
    const r = readPostingAi('Senior AI Engineer', 'Build RAG pipelines with embeddings and LangChain; ship agentic workflows.')
    expect(r.tier).toBe('builder')
    expect(keys(r)).toEqual(expect.arrayContaining(['ai-agents', 'llm-apps', 'rag']))
    expect(r.skills.find((s) => s.key === 'rag')?.level).toBe('builder')
  })

  it('treats an ordinary role that expects AI as embedded, practitioner level', () => {
    const r = readPostingAi('Marketing Manager', 'You will use ChatGPT and prompt engineering to speed up campaign copy.')
    expect(r.tier).toBe('embedded')
    expect(r.skills.find((s) => s.key === 'prompting')?.level).toBe('practitioner')
  })

  it('reads "familiarity with" as aware level', () => {
    const r = readPostingAi('Operations Analyst', 'Familiarity with generative AI tools is a plus.')
    expect(r.skills.find((s) => s.key === 'ai-tools')?.level).toBe('aware')
  })

  it('puts governance titles in the adjacent tier', () => {
    expect(readPostingAi('AI Governance Lead', 'Own responsible AI policy and the EU AI Act program.').tier).toBe('adjacent')
  })

  it('does not match inside other words', () => {
    expect(readPostingAi('Rager Safety Officer', 'Maintain the storage room and the Cursory review log.').tier).toBeNull()
  })

  it('ignores a lone "copilot" mention', () => {
    expect(readPostingAi('Flight Operations Manager', 'Coordinate pilot and copilot schedules.').tier).toBeNull()
  })
})
