/**
 * Weekly re-check of conference employer and speaker lists (see docs/seo/list-recheck.md).
 *   plan <out.json> [max]   writes the conferences due for a re-read (rules: src/lib/conferences/list-recheck.ts)
 *   load <plan.json> <result.json>...   loads only new, rule-following rows from the agents' result files; additive only
 * Result file shape: { "orgs": [{conferenceId, name, role, year, sourceUrl}], "people": [{conferenceId, name, title, organization, kind, sessionTitle, year, sourceUrl}] }
 * Never updates or deletes a row. Prints one JSON summary line.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { MAX_PER_RUN, cleanOrgs, cleanPeople, isDue, pickDue, type RawOrg, type RawPerson } from '../../src/lib/conferences/list-recheck'

const prisma = new PrismaClient()
const STATE_KEY = 'listrecheck:v1'
type State = Record<string, { at: string; hash: string | null }>

async function readState(): Promise<State> {
  return ((await prisma.topicSnapshot.findUnique({ where: { key: STATE_KEY } }))?.data as State | undefined) ?? {}
}

async function plan(out: string, max: number) {
  const now = new Date()
  const horizon = new Date(now.getTime() + 241 * 86_400_000)
  const [confs, emp, spk, state] = await Promise.all([
    prisma.conferenceEvent.findMany({
      where: { published: true, datesConfirmed: true, url: { not: null }, startDate: { gte: now, lte: horizon } },
      select: { id: true, name: true, url: true, importance: true, startDate: true, datesConfirmed: true, contentHash: true, organizer: true },
    }),
    prisma.conferenceEmployer.findMany({ distinct: ['seriesId'], select: { seriesId: true } }).catch(() => []),
    prisma.conferenceSpeaker.findMany({ distinct: ['seriesId'], select: { seriesId: true } }).catch(() => []),
    readState(),
  ])
  const file = JSON.parse(readFileSync(process.cwd() + '/src/lib/events/conference-employers.json', 'utf8')) as Record<string, unknown[]>
  const have = new Set<string>([...emp.map((r) => r.seriesId), ...spk.map((r) => r.seriesId), ...Object.keys(file).filter((k) => file[k].length)])
  const due = pickDue(confs.filter((c) => isDue(c, have.has(c.id), state[c.id]?.hash, now)), max)
  writeFileSync(out, JSON.stringify(due.map((c) => ({ id: c.id, name: c.name, url: c.url, start: c.startDate!.toISOString().slice(0, 10), organizer: c.organizer, hadLists: have.has(c.id), contentHash: c.contentHash })), null, 1))
  console.log(JSON.stringify({ candidates: confs.length, due: due.length }))
}

async function load(planFile: string, results: string[]) {
  const planned = JSON.parse(readFileSync(planFile, 'utf8')) as { id: string; hadLists: boolean; contentHash: string | null }[]
  const valid = new Set(planned.map((p) => p.id))
  const orgs: RawOrg[] = []
  const people: RawPerson[] = []
  for (const f of results) {
    try {
      const j = JSON.parse(readFileSync(f, 'utf8')) as { orgs?: RawOrg[]; people?: RawPerson[] }
      orgs.push(...(j.orgs ?? []))
      people.push(...(j.people ?? []))
    } catch (e) {
      console.error('skipped unreadable result file', f, String(e).slice(0, 80))
    }
  }
  const cleanO = cleanOrgs(orgs, valid)
  const cleanP = cleanPeople(people, valid)
  const o = cleanO.length
    ? await prisma.conferenceEmployer.createMany({ data: cleanO.map((r) => ({ seriesId: r.conferenceId, name: r.name, role: r.role, year: r.year, sourceUrl: r.sourceUrl })), skipDuplicates: true })
    : { count: 0 }
  const p = cleanP.length
    ? await prisma.conferenceSpeaker.createMany({ data: cleanP.map((r) => ({ seriesId: r.conferenceId, name: r.name, title: r.title ?? null, organization: r.organization ?? null, kind: r.kind ?? 'SPEAKER', sessionTitle: r.sessionTitle ?? null, year: r.year, sourceUrl: r.sourceUrl })), skipDuplicates: true })
    : { count: 0 }
  const state = await readState()
  const at = new Date().toISOString()
  for (const c of planned) state[c.id] = { at, hash: c.contentHash }
  await prisma.topicSnapshot.upsert({ where: { key: STATE_KEY }, create: { key: STATE_KEY, data: state as object }, update: { data: state as object, updatedAt: new Date() } })
  const got = new Set([...cleanO.map((r) => r.conferenceId), ...cleanP.map((r) => r.conferenceId)])
  console.log(JSON.stringify({ conferencesReread: planned.length, orgRowsAdded: o.count, peopleRowsAdded: p.count, conferencesNewlyWithLists: planned.filter((c) => !c.hadLists && got.has(c.id)).length }))
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2)
  if (cmd === 'plan') await plan(args[0], Number(args[1] ?? MAX_PER_RUN))
  else if (cmd === 'load') await load(args[0], args.slice(1))
  else throw new Error('usage: plan <out.json> [max] | load <plan.json> <result.json>...')
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
