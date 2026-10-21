// O*NET skill / tool ids named in free text (a job's title and description, a member's skill
// keywords), through the aliases that are safe to find inside text (text-skill-aliases.json,
// built by scripts/careers/build-text-skill-aliases.ts). Deterministic and fast: every 1-5 word
// window of the text is looked up once. Pure, unit-tested in src/test/text-skill-ids.test.ts.

import aliases from './text-skill-aliases.json'
import { normalizeSkillText } from '@/lib/careers/vectors'

const ALIASES: ReadonlyMap<string, string[]> = new Map(Object.entries(aliases as Record<string, string[]>))
const MAX_WORDS = 5

/** Skill ids the text names. */
export function textSkillIds(...texts: (string | null | undefined)[]): Set<string> {
  const out = new Set<string>()
  for (const text of texts) {
    if (!text) continue
    const words = normalizeSkillText(text).split(' ').filter(Boolean)
    for (let i = 0; i < words.length; i++) {
      let phrase = ''
      for (let n = 0; n < MAX_WORDS && i + n < words.length; n++) {
        phrase = n === 0 ? words[i] : `${phrase} ${words[i + n]}`
        const ids = ALIASES.get(phrase)
        if (ids) for (const id of ids) out.add(id)
      }
    }
  }
  return out
}
