// Builds the skill alias table: the many ways people write a tool ("SFDC", "MS Excel") mapped to the
// O*NET technology skill they mean. Run after careers:import-onet. Re-runnable: it replaces rows
// it built (BUILTIN, NAME, LLM) and keeps any an admin added (ADMIN).
//
// 1. Every tool's own name and its variants without filler words and vendor prefixes.
// 2. The hand-written shorthand in src/lib/careers/skill-aliases.ts (BUILTIN_ALIASES).
// 3. The project's ~150 skill terms (src/lib/companies/skills-extraction.ts) and, with
//    --include-resume-keywords, resume keywords that appear on at least --min-count profiles.
//    Terms that still match no tool are listed, so you can see what is left.
// 4. Optionally (--llm), a model drafts a match for the leftovers. This is the ONLY step that costs
//    money: one call per 25 terms, capped by --max-calls (default 20), run by you offline, never at
//    runtime. Each answer must be one of the candidate tools offered for that term or "none".
//    Review the LLM rows afterwards; delete any that are wrong from SkillAlias.
//
//   npm run careers:build-aliases -- [--include-resume-keywords] [--min-count 3] [--llm] [--max-calls 20] [--dry-run]
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { prisma } from '../../src/lib/prisma'
import { getAnthropicClient } from '../../src/lib/anthropic'
import { SKILL_TERMS } from '../../src/lib/companies/skills-extraction'
import { buildAliasRows, type AliasRow, type ToolCandidate } from '../../src/lib/careers/skill-aliases'
import { normalizeSkillText } from '../../src/lib/careers/vectors'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const has = (name: string) => process.argv.includes(`--${name}`)

function tokens(s: string): Set<string> {
  return new Set(normalizeSkillText(s).split(' ').filter((t) => t.length > 1))
}

// A few likely tools for a term, by shared words, so the model chooses among real options.
function candidatesFor(term: string, tools: ToolCandidate[], n = 6): ToolCandidate[] {
  const t = tokens(term)
  return tools
    .map((tool) => {
      const tt = tokens(tool.name)
      let shared = 0
      for (const w of t) if (tt.has(w)) shared++
      return { tool, score: shared / Math.max(t.size, 1) }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.tool)
}

const answerSchema = z.object({ matches: z.array(z.object({ term: z.string(), skillId: z.string().nullable() })) })

async function draftWithModel(unmapped: string[], tools: ToolCandidate[], maxCalls: number): Promise<AliasRow[]> {
  const out: AliasRow[] = []
  const client = getAnthropicClient()
  const batches: string[][] = []
  for (let i = 0; i < unmapped.length; i += 25) batches.push(unmapped.slice(i, i + 25))
  const toRun = batches.slice(0, maxCalls)
  console.log(`LLM: ${unmapped.length} terms in ${batches.length} batches; running ${toRun.length} (cap ${maxCalls}).`)
  for (const batch of toRun) {
    const offered = new Map(batch.map((t) => [t, candidatesFor(t, tools)] as const))
    const withOptions = batch.filter((t) => (offered.get(t)?.length ?? 0) > 0)
    if (withOptions.length === 0) continue
    const prompt = `For each term from job postings and resumes, decide whether it names the SAME product or technology as one of the offered O*NET tools. Answer with the tool's id only if it is clearly the same thing (an abbreviation, a different spelling, or the same product under a vendor prefix). If it is a different product, a general skill, or you are not sure, answer null. Never answer with an id that is not offered for that term.

${withOptions.map((t) => `Term: "${t}"\nOffered: ${offered.get(t)!.map((c) => `${c.id} = ${c.name}`).join(' | ')}`).join('\n\n')}`
    try {
      const stream = client.messages.stream({
        model: 'claude-sonnet-5',
        max_tokens: 1500,
        thinking: { type: 'disabled' },
        output_config: { format: zodOutputFormat(answerSchema), effort: 'low' },
        messages: [{ role: 'user', content: prompt }],
      })
      const message = await stream.finalMessage()
      for (const m of message.parsed_output?.matches ?? []) {
        const allowed = new Set((offered.get(m.term) ?? []).map((c) => c.id))
        if (m.skillId && allowed.has(m.skillId)) out.push({ alias: normalizeSkillText(m.term), skillId: m.skillId, source: 'LLM' })
      }
    } catch (error) {
      console.error('LLM batch failed; skipping it:', error)
    }
  }
  return out
}

async function main() {
  const dryRun = has('dry-run')
  const skills = await prisma.skill.findMany({ where: { kind: 'TECHNOLOGY' }, select: { id: true, name: true } })
  if (skills.length === 0) {
    console.error('No technology skills found. Run careers:import-onet first.')
    process.exit(1)
  }
  const tools: ToolCandidate[] = skills

  let terms = [...SKILL_TERMS]
  if (has('include-resume-keywords')) {
    const minCount = Number(arg('min-count') ?? 3)
    const counts = new Map<string, number>()
    for (const p of await prisma.candidateProfile.findMany({ select: { resumeKeywords: true } })) {
      for (const k of new Set(p.resumeKeywords.map(normalizeSkillText).filter(Boolean))) counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    const common = [...counts.entries()].filter(([, n]) => n >= minCount).map(([k]) => k)
    console.log(`Resume keywords on at least ${minCount} profiles: ${common.length}.`)
    terms = [...terms, ...common]
  }

  const { rows, unmapped } = buildAliasRows(tools, terms)
  console.log(`${tools.length} tools; ${rows.length} aliases built; ${unmapped.length} of ${terms.length} terms matched no tool.`)
  if (unmapped.length > 0) console.log(`Unmapped sample: ${unmapped.slice(0, 25).join(', ')}`)

  let all = rows
  if (has('llm')) {
    const drafted = await draftWithModel(unmapped, tools, Number(arg('max-calls') ?? 20))
    console.log(`LLM drafted ${drafted.length} aliases.`)
    const seen = new Set(rows.map((r) => r.alias))
    all = [...rows, ...drafted.filter((d) => !seen.has(d.alias))]
  } else if (unmapped.length > 0) {
    console.log('Pass --llm to have a model draft matches for these (costs money; see the header of this script).')
  }
  if (dryRun) return console.log('Dry run: nothing written.')

  await prisma.$transaction(async (tx) => {
    await tx.skillAlias.deleteMany({ where: { source: { in: ['BUILTIN', 'NAME', 'LLM'] } } })
    for (let i = 0; i < all.length; i += 5000) await tx.skillAlias.createMany({ data: all.slice(i, i + 5000), skipDuplicates: true })
  })
  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
