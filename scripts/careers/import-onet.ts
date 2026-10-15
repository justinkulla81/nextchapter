// Loads the O*NET database into the career taxonomy tables: occupations, job
// zones, skills, knowledge, technology/tools, alternate titles and the curated
// related-occupation lists. Re-runnable: occupations upsert on their SOC code and
// the skill, title and relation rows are replaced as a set, so a newer O*NET
// release can be loaded over an older one. BLS pay and projection columns on
// Occupation are left alone (see import-bls.ts).
//
// Download "O*NET Database, text format" from https://www.onetcenter.org/database.html
// (free, CC BY 4.0), unzip it, then:
//
// By default only white-collar occupations are loaded (SOC groups in src/lib/careers/scope.ts,
// O*NET Job Zone 4 or 5). Use --scope all to load everything, and --prune after changing scope to
// remove occupations that are no longer in it.
//
//   npm run careers:import-onet -- --dir /path/to/db_30_0_text --version 30.0 [--scope white-collar|all] [--prune] [--dry-run]
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../../src/lib/prisma'
import { normalizeTitle } from '../../src/lib/careers/title-match'
import { inWhiteCollarScope, type ImportScope } from '../../src/lib/careers/scope'
import {
  parseJobZones,
  parseOnetAltTitles,
  parseOnetOccupations,
  parseOnetRated,
  parseOnetRelated,
  parseOnetTasks,
  parseOnetTechnology,
  type OnetElementRow,
} from '../../src/lib/careers/import-parsers'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function read(dir: string, file: string): string {
  return readFileSync(join(dir, file), 'utf8')
}

// Abilities and Work Activities add resolution to the comparison but are not essential, so a
// release that lacks the file still loads.
function readOptional(dir: string, file: string): string | null {
  try {
    return read(dir, file)
  } catch {
    console.warn(`  ${file} not found in ${dir}; skipping it.`)
    return null
  }
}

function chunks<T>(rows: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}

async function main() {
  const dir = arg('dir')
  const version = arg('version') ?? null
  const dryRun = process.argv.includes('--dry-run')
  if (!dir) {
    console.error('Usage: import-onet --dir <unzipped O*NET text folder> [--version 30.0] [--dry-run]')
    process.exit(1)
  }

  const scope = (arg('scope') ?? 'white-collar') as ImportScope
  if (scope !== 'white-collar' && scope !== 'all') {
    console.error('--scope must be white-collar or all.')
    process.exit(1)
  }
  const prune = process.argv.includes('--prune')

  const everyOccupation = parseOnetOccupations(read(dir, 'Occupation Data.txt'))
  const zones = parseJobZones(read(dir, 'Job Zones.txt'))
  const occupations = scope === 'all' ? everyOccupation : everyOccupation.filter((o) => inWhiteCollarScope(o.socCode, zones.get(o.socCode)))
  console.log(`Scope ${scope}: ${occupations.length} of ${everyOccupation.length} occupations.`)
  const known = new Set(occupations.map((o) => o.socCode))
  const keep = (r: { socCode: string }) => known.has(r.socCode)

  const elements: OnetElementRow[] = [
    ...parseOnetRated(read(dir, 'Skills.txt'), 'SKILL'),
    ...parseOnetRated(read(dir, 'Knowledge.txt'), 'KNOWLEDGE'),
    ...[['Abilities.txt', 'ABILITY'], ['Work Activities.txt', 'ACTIVITY']].flatMap(([file, kind]) => {
      const text = readOptional(dir, file)
      return text ? parseOnetRated(text, kind as 'ABILITY' | 'ACTIVITY') : []
    }),
    ...parseOnetTechnology(read(dir, 'Technology Skills.txt')),
  ].filter(keep)

  const altSeen = new Set<string>()
  const altTitles = parseOnetAltTitles(read(dir, 'Alternate Titles.txt'))
    .filter(keep)
    .map((a) => ({ socCode: a.socCode, title: a.title, titleNormalized: normalizeTitle(a.title) }))
    .filter((a) => {
      const key = `${a.socCode}|${a.titleNormalized}`
      if (!a.titleNormalized || altSeen.has(key)) return false
      altSeen.add(key)
      return true
    })

  const related = parseOnetRelated(read(dir, 'Related Occupations.txt')).filter((r) => known.has(r.socCode) && known.has(r.relatedSocCode))

  const tasksText = readOptional(dir, 'Task Statements.txt')
  const tasks = tasksText ? parseOnetTasks(tasksText).filter(keep) : []

  const skills = new Map<string, { id: string; name: string; kind: string }>()
  for (const e of elements) if (!skills.has(e.skillId)) skills.set(e.skillId, { id: e.skillId, name: e.name, kind: e.kind })

  console.log(
    `Parsed ${occupations.length} occupations, ${skills.size} skills/knowledge/tools, ${elements.length} occupation-skill rows, ${altTitles.length} alternate titles, ${related.length} related pairs, ${tasks.length} tasks.`
  )
  if (dryRun) return

  for (const batch of chunks(occupations, 200)) {
    await prisma.$transaction(
      batch.map((o) =>
        prisma.occupation.upsert({
          where: { socCode: o.socCode },
          create: { socCode: o.socCode, title: o.title, description: o.description, jobZone: zones.get(o.socCode) ?? null, onetVersion: version },
          update: { title: o.title, description: o.description, jobZone: zones.get(o.socCode) ?? null, onetVersion: version },
        })
      )
    )
  }

  await prisma.skill.createMany({ data: [...skills.values()], skipDuplicates: true })

  await prisma.$transaction(
    async (tx) => {
      await tx.occupationSkill.deleteMany()
      for (const batch of chunks(elements, 5000)) {
        await tx.occupationSkill.createMany({
          data: batch.map((e) => ({ socCode: e.socCode, skillId: e.skillId, importance: e.importance, level: e.level, hotTech: e.hotTech })),
        })
      }
      await tx.occupationAltTitle.deleteMany()
      for (const batch of chunks(altTitles, 5000)) await tx.occupationAltTitle.createMany({ data: batch })
      await tx.occupationRelated.deleteMany()
      await tx.occupationRelated.createMany({ data: related })
      if (tasksText) {
        await tx.occupationTask.deleteMany()
        for (const batch of chunks(tasks, 5000)) await tx.occupationTask.createMany({ data: batch })
      }
      if (prune) {
        const kept = occupations.map((o) => o.socCode)
        // People mapped to a pruned occupation are re-matched the next time they open the Pivot Tool.
        await tx.candidateOccupation.deleteMany({ where: { socCode: { notIn: kept } } })
        const removed = await tx.occupation.deleteMany({ where: { socCode: { notIn: kept } } })
        console.log(`Pruned ${removed.count} occupations outside the scope.`)
      }
    },
    { timeout: 300_000, maxWait: 30_000 }
  )

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
