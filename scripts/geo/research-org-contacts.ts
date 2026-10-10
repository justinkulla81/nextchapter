// Step 3: website + best public contact for the largest econ-dev / workforce
// nonprofit leads. Claude with web search + fetch; writes GeoOrgLead directly.
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { ask, jsonOf, pool, spent } from './_llm'

const CAP = 70
const prisma = new PrismaClient()
const limit = Number(process.argv.includes('--limit') ? process.argv[process.argv.indexOf('--limit') + 1] : 100000)

async function main() {
  const orgs = await prisma.geoOrgLead.findMany({
    where: { kind: { in: ['ECON_DEV', 'WORKFORCE'] }, revenue: { gte: 1_000_000 }, enrichedAt: null, dismissedAt: null },
    orderBy: { revenue: 'desc' }, take: limit,
  })
  console.log('orgs to research', orgs.length)
  let found = 0, contacts = 0, emails = 0, done = 0
  await pool(orgs, 5, async (o) => {
    const prompt = `Find the official website and best public contact for this US organization. Use web search; fetch its own site's contact/about/staff page if a search snippet is not enough.
Name: ${o.name}
Address: ${[o.street, o.city, o.state, o.zip].filter(Boolean).join(', ')}
Type: ${o.kind === 'WORKFORCE' ? 'workforce / job training nonprofit' : 'economic development organization'}
Rules: verify the site is this exact organization (name and city/state match). Contact = executive director / CEO / president (name + title), plus an email and phone only if literally printed on a page. Never guess or construct an email. confidence: "high" = from the org's own site; "medium" = from a reputable third-party page; "none" = not found.
Reply with ONLY JSON: {"website","contactName","contactTitle","email","phone","sourceUrl","confidence"} (null for unknown).`
    try {
      const r = await ask('orgs', CAP, prompt, { searches: 2, fetches: 2, maxTokens: 800 })
      const j = jsonOf<{ website: string | null; contactName: string | null; contactTitle: string | null; email: string | null; phone: string | null; sourceUrl: string | null; confidence: string }>(r.text)
      if (j && (j.confidence === 'high' || j.confidence === 'medium')) {
        await prisma.geoOrgLead.update({ where: { id: o.id }, data: {
          website: o.website ?? j.website, contactName: j.contactName, contactTitle: j.contactTitle,
          contactEmail: j.email, contactPhone: j.phone, contactSource: j.sourceUrl, contactConfidence: j.confidence, enrichedAt: new Date() } })
        if (j.website) found++
        if (j.contactName) contacts++
        if (j.email) emails++
      } else {
        await prisma.geoOrgLead.update({ where: { id: o.id }, data: { enrichedAt: new Date(), contactConfidence: 'none' } })
      }
    } catch (e) { if (String(e).includes('cap reached')) throw e; console.log('ERR', o.name.slice(0, 40), String(e).slice(0, 100)) }
    done++
    if (done % 25 === 0) console.log(`${done}/${orgs.length} website ${found} contact ${contacts} email ${emails} spent $${spent('orgs').toFixed(2)}`)
  }).catch((e) => console.log(String(e).slice(0, 160)))
  console.log(`DONE ${done} website ${found} contact ${contacts} email ${emails} cost $${spent('orgs').toFixed(2)}`)
}
main().finally(() => prisma.$disconnect())
