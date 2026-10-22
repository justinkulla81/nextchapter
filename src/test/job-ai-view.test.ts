import { describe, expect, it } from 'vitest'
import { jobAiView } from '@/lib/jobs/job-ai-view'
import { aiSkillItem, AI_SKILL_ITEMS } from '@/lib/skills/ai-skills'
import type { AiMarketData } from '@/lib/skills/ai-market'

const ids = AI_SKILL_ITEMS.slice(0, 5).map((i) => i.id)
const live = (premium: unknown) =>
  ({ asOf: '2026-10-20T00:00:00Z', functions: { data_ai: { label: 'Data & Analytics', premium } } }) as unknown as AiMarketData
const PAYS = { nAi: 100, nBase: 200, medAi: 150000, medBase: 120000, rawUsd: 30000, rawPct: 25, likeUsd: 20000, likePct: 17 }

describe('jobAiView', () => {
  it('is null when the posting asks for no AI skill', () => {
    expect(jobAiView({ aiSkillGroups: [], aiSkillItems: [] }, live(PAYS))).toBeNull()
    expect(jobAiView({}, null)).toBeNull()
  })
  it('names up to three skills by label and counts the rest', () => {
    const v = jobAiView({ aiSkillGroups: ['applied'], aiSkillItems: ids }, null)!
    expect(v.skills).toEqual(ids.slice(0, 3).map((i) => aiSkillItem(i)!.label))
    expect(v.more).toBe(2)
    expect(v.paySentence).toBeNull()
  })
  it('adds the premium only when the like-for-like comparison says AI skills pay more', () => {
    const base = { aiSkillGroups: ['applied'], aiSkillItems: ids, targetFunction: 'data_ai' }
    expect(jobAiView(base, live(PAYS))!.paySentence).toMatch(/^In Data & Analytics jobs on our board that ask for an AI skill, posted pay is .*17%.*Posted pay only, as of /)
    expect(jobAiView(base, live({ ...PAYS, likePct: -3, rawUsd: -100 }))!.paySentence).toBeNull()
    expect(jobAiView(base, live({ ...PAYS, likePct: undefined, likeUsd: undefined }))!.paySentence).toBeNull()
    expect(jobAiView({ ...base, targetFunction: 'nonsense' }, live(PAYS))!.paySentence).toBeNull()
  })
})
