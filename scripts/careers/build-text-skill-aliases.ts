// Builds src/lib/careers/text-skill-aliases.json: the O*NET skill / tool aliases (SkillAlias)
// that are safe to look for inside free text (job titles and descriptions). Multi-word aliases
// are kept; a single word only when it isn't an ordinary English word (checked against the
// system word list, so "salesforce" and "netsuite" stay while "office", "scheme" and "julia"
// go). Office basics everyone has (Word, Outlook, PowerPoint…) are left out: they say nothing
// about a fit. Run after careers:build-aliases; the JSON is committed.
//
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/careers/build-text-skill-aliases.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { prisma } from '../../src/lib/prisma'
import { normalizeSkillText } from '../../src/lib/careers/vectors'

const BASIC = /^(microsoft (word|outlook|powerpoint|teams|office|windows|edge|365)|google (docs|sheets|drive|meet|workspace|chrome)|adobe acrobat|zoom|slack|email|electronic mail|web browser|internet browser|word processing|spreadsheet|presentation)\b/i

// Company names alone ("google", "oracle") say nothing about a skill.
const BRANDS = new Set(['google', 'facebook', 'linkedin', 'abbott', 'amazon', 'apple', 'microsoft', 'oracle', 'ibm', 'adobe', 'meta', 'twitter', 'youtube', 'instagram'])

let english: Set<string>
/** An ordinary English word, or one with a common ending ("reporting", "budgets"). */
function isEnglish(w: string): boolean {
  if (english.has(w)) return true
  for (const suffix of ['ing', 'ed', 'es', 's', 'er', 'ers', 'ment', 'ments']) {
    if (w.endsWith(suffix)) {
      const stem = w.slice(0, -suffix.length)
      if (english.has(stem) || english.has(`${stem}e`)) return true
    }
  }
  return false
}

async function main() {
  english = new Set(readFileSync('/usr/share/dict/words', 'utf8').split('\n').map((w) => w.trim().toLowerCase()).filter(Boolean))
  const rows = await prisma.skillAlias.findMany({ select: { alias: true, skillId: true, skill: { select: { name: true } } } })
  const out: Record<string, string[]> = {}
  let kept = 0
  for (const r of rows) {
    if (BASIC.test(r.skill.name)) continue
    const a = normalizeSkillText(r.alias)
    if (!a) continue
    const words = a.split(' ')
    const name = normalizeSkillText(r.skill.name).replace(/ software$/, '')
    const safe =
      words.length >= 2
        ? a.length >= 6 && !words.every((w) => isEnglish(w))
        : a.length >= 3 &&
          !isEnglish(a) &&
          !/^\d+$/.test(a) &&
          !BRANDS.has(a) &&
          // A short acronym ("crm", "emr", "seo") names a field, not the one product it is aliased to.
          (a.length > 5 || a === name)
    if (!safe) continue
    out[a] = [...new Set([...(out[a] ?? []), r.skillId])]
    kept++
  }
  const sorted = Object.fromEntries(Object.entries(out).sort(([x], [y]) => x.localeCompare(y)))
  writeFileSync('src/lib/careers/text-skill-aliases.json', JSON.stringify(sorted))
  console.log(`${rows.length} aliases, ${Object.keys(sorted).length} safe for free text (${kept} rows)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
