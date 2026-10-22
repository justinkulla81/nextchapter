// What the open job says about AI, from fields the posting already carries and helpers that already exist:
// whether it asks for a specific AI skill (aiSkillGroups / aiSkillItems, the same test as the AI view on the
// board), and, only when the live like-for-like comparison says those skills pay more for this function, the
// premium in one plain sentence. Nothing is estimated here. Pure and client-safe; tested in src/test/job-ai-view.test.ts.

import { functionCode } from '@/lib/skills/ai-skill-market'
import { asOfText, paysMore, premiumPhrase, type AiMarketData } from '@/lib/skills/ai-market'
import { aiSkillItem } from '@/lib/skills/ai-skills'

export interface JobAiView {
  /** Up to three AI skills the posting names, by label. */
  skills: string[]
  /** How many more are named than shown. */
  more: number
  /** "In Data & Analytics jobs on our board that ask for an AI skill, posted pay is ... Posted pay only, as of Oct 20, 2026." */
  paySentence: string | null
}

const MAX_SKILLS = 3

export function jobAiView(
  posting: { aiSkillGroups?: readonly string[] | null; aiSkillItems?: readonly string[] | null; targetFunction?: string | null },
  live: AiMarketData | null | undefined
): JobAiView | null {
  if (!(posting.aiSkillGroups?.length ?? 0)) return null
  const labels = [...new Set((posting.aiSkillItems ?? []).map((id) => aiSkillItem(id)?.label).filter((l): l is string => !!l))]
  const code = functionCode(posting.targetFunction)
  const f = code ? live?.functions[code] : undefined
  const phrase = f && paysMore(f.premium) ? premiumPhrase(f.premium) : null
  const paySentence = f && phrase && live ? `In ${f.label} jobs on our board that ask for an AI skill, ${phrase}. Posted pay only, as of ${asOfText(live.asOf)}.` : null
  return { skills: labels.slice(0, MAX_SKILLS), more: Math.max(0, labels.length - MAX_SKILLS), paySentence }
}
