/**
 * Department heads at the colleges in workforce board areas with layoffs —
 * career services, alumni relations, development, executive/continuing
 * education — read from each college's own website and extracted with
 * Claude Haiku 4.5 through the Batch API (half price, results within a day).
 *
 *   npx tsx --env-file=.env.local scripts/workforce/college-contacts.ts crawl <pages.jsonl> [limit]
 *   npx tsx --env-file=.env.local scripts/workforce/college-contacts.ts submit <pages.jsonl>
 *   npx tsx --env-file=.env.local scripts/workforce/college-contacts.ts collect <batchId> <pages.jsonl>
 *
 * Scope: public and private nonprofit colleges (IPEDS sectors 1, 2, 4) in
 * the counties of boards with a WARN filing in the last year, not checked
 * before. Cost is metered per college — about half a cent each — so widen
 * the scope only with sign-off.
 */
import { appendFileSync, readFileSync, writeFileSync } from 'fs'
import Anthropic from '@anthropic-ai/sdk'
import { PrismaClient } from '@prisma/client'
import { readCollegePages, type PageText } from '../../src/lib/workforce/college-pages'
import { buildContactsRequest, CONTACTS_MODEL, verifiedContacts } from '../../src/lib/workforce/college-contacts'
import { boardCountyKeys } from '../../src/lib/workforce/board-area'

type Crawled = { collegeId: string; name: string; pages: PageText[] }

const prisma = new PrismaClient()

async function targets(limit: number) {
  const active = await prisma.warnNotice.groupBy({
    by: ['workforceBoardId'],
    where: { workforceBoardId: { not: null }, dismissedAt: null, noticeDate: { gte: new Date(Date.now() - 365 * 86_400_000) } },
  })
  const boards = await prisma.workforceBoard.findMany({ where: { id: { in: active.map((a) => a.workforceBoardId!) } } })
  const colleges = await prisma.localCollege.findMany({
    where: { sector: { in: [1, 2, 4] }, website: { not: null }, contactsCheckedAt: null },
    orderBy: [{ size: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
  })
  const inArea = colleges.filter((c) => boards.some((b) => {
    if (b.state !== c.state) return false
    const keys = boardCountyKeys(b)
    return keys === 'all' || (!!c.countyKey && keys.includes(c.countyKey))
  }))
  return inArea.slice(0, limit)
}

async function crawl(file: string, limit: number) {
  const list = await targets(limit)
  console.log(`${list.length} colleges to read`)
  writeFileSync(file, '')
  let done = 0
  let withPages = 0
  const queue = [...list]
  const worker = async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      const pages = await readCollegePages(c.website!).catch(() => [])
      appendFileSync(file, JSON.stringify({ collegeId: c.id, name: c.name, pages } satisfies Crawled) + '\n')
      done++
      if (pages.length) withPages++
      if (done % 50 === 0) console.log(`${done}/${list.length} read, ${withPages} with pages`)
    }
  }
  await Promise.all(Array.from({ length: 16 }, worker))
  console.log(`done: ${done} read, ${withPages} with pages`)
}

function load(file: string): Crawled[] {
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Crawled)
}

async function submit(file: string) {
  const rows = load(file).filter((r) => r.pages.length)
  const requests = rows.map((r) => ({ custom_id: r.collegeId, params: buildContactsRequest(r.name, r.pages) }))
  const chars = requests.reduce((s, r) => s + JSON.stringify(r.params).length, 0)
  // ~4 characters a token; Haiku 4.5 at batch rates is $0.50 per million input tokens.
  console.log(`${requests.length} requests, about ${Math.round(chars / 4).toLocaleString()} input tokens, about $${((chars / 4 / 1e6) * 0.5).toFixed(2)} input at batch rates`)
  const batch = await new Anthropic().messages.batches.create({ requests })
  console.log(`batch ${batch.id} ${batch.processing_status}`)
}

async function collect(batchId: string, file: string) {
  const client = new Anthropic()
  const batch = await client.messages.batches.retrieve(batchId)
  if (batch.processing_status !== 'ended') {
    console.log(`batch ${batchId} is ${batch.processing_status}:`, JSON.stringify(batch.request_counts))
    return
  }
  const crawled = new Map(load(file).map((r) => [r.collegeId, r]))
  let inTok = 0
  let outTok = 0
  let people = 0
  let offices = 0
  let colleges = 0
  const seen = new Set<string>()
  for await (const result of await client.messages.batches.results(batchId)) {
    seen.add(result.custom_id)
    const row = crawled.get(result.custom_id)
    if (!row || result.result.type !== 'succeeded') {
      if (result.result.type !== 'succeeded') console.log(`${result.custom_id}: ${result.result.type}`)
      continue
    }
    const msg = result.result.message
    inTok += msg.usage.input_tokens
    outTok += msg.usage.output_tokens
    const text = msg.content.find((b) => b.type === 'text')
    const contacts = verifiedContacts(text && text.type === 'text' ? text.text : '', row.pages)
    await prisma.$transaction([
      prisma.collegeContact.deleteMany({ where: { collegeId: row.collegeId } }),
      prisma.collegeContact.createMany({ data: contacts.map((c) => ({ ...c, collegeId: row.collegeId })) }),
      prisma.localCollege.update({ where: { id: row.collegeId }, data: { contactsCheckedAt: new Date(), contactsPagesRead: row.pages.length } }),
    ])
    if (contacts.length) colleges++
    people += contacts.filter((c) => c.name).length
    offices += contacts.filter((c) => !c.name).length
  }
  // Colleges whose sites gave nothing to read were never sent; they are checked too.
  for (const r of crawled.values()) {
    if (!r.pages.length && !seen.has(r.collegeId)) {
      await prisma.localCollege.update({ where: { id: r.collegeId }, data: { contactsCheckedAt: new Date(), contactsPagesRead: 0 } })
    }
  }
  // Haiku 4.5: $1 / $5 per million tokens, half at batch rates.
  const cost = (inTok / 1e6) * 0.5 + (outTok / 1e6) * 2.5
  console.log(JSON.stringify({ model: CONTACTS_MODEL, collegesWithContacts: colleges, people, officeLines: offices, inputTokens: inTok, outputTokens: outTok, costUsd: Math.round(cost * 100) / 100 }))
}

const [cmd, a, b] = process.argv.slice(2)
const run = cmd === 'crawl' ? crawl(a, Number(b ?? 100_000))
  : cmd === 'submit' ? submit(a)
  : cmd === 'collect' ? collect(a, b)
  : Promise.reject(new Error('usage: crawl <file> [limit] | submit <file> | collect <batchId> <file>'))
run.then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1) })
