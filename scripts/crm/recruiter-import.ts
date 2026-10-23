/**
 * Adds researched recruiters to the CRM with their coverage tags. Dry run unless --apply.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/recruiter-import.ts data/recruiters/<file>.json [--apply]
 *
 * Each row: { fullName, title, firm, firmWebsite?, city?, state, email?, phone?, sourceUrl,
 *   industries: job-board keys, functions: function keys, coverageStates?: two-letter states or NATIONAL }.
 * Email only when the firm published it; nothing is guessed here. Goes through
 * addContactToCrm, so a name that matches someone else lands on the Review List.
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../../src/lib/prisma'
import { addContactToCrm, ensureOrg } from '../../src/lib/crm/add-contact'
import { classifyRecruiter } from '../../src/lib/crm/recruiter-kind'
import { INDUSTRY_KEYS, FUNCTION_KEYS, STATE_NAMES } from '../../src/lib/crm/coverage'

interface Row {
  fullName: string; title: string; firm: string; firmWebsite?: string; city?: string; state: string
  email?: string; phone?: string; sourceUrl: string
  industries: string[]; functions: string[]; coverageStates?: string[]
}

async function main() {
  const [file] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const apply = process.argv.includes('--apply')
  const rows: Row[] = JSON.parse(readFileSync(file, 'utf8'))
  const tally = { added: 0, matched: 0, review: 0, removed: 0, skipped: 0 }
  for (const r of rows) {
    // "Rick Barr, MD" is a title or credential after the name, not part of it.
    r.fullName = r.fullName.split(',')[0].trim()
    const industries = r.industries.filter((k) => INDUSTRY_KEYS.includes(k))
    const functions = r.functions.filter((k) => FUNCTION_KEYS.includes(k))
    const states = [...new Set([r.state, ...(r.coverageStates ?? [])].filter((s) => s === 'NATIONAL' || STATE_NAMES[s]))]
    const nameOk = r.fullName.trim().split(/\s+/).length >= 2 && !/[@\d]/.test(r.fullName)
    if (!nameOk || !r.firm || !r.sourceUrl || !states.length) { tally.skipped++; console.log('skip', r.fullName, '-', r.firm); continue }
    if (!apply) { tally.added++; continue }
    const org = await ensureOrg({ name: r.firm, type: 'VENDOR', website: r.firmWebsite ?? null, city: r.city ?? null, state: STATE_NAMES[r.state] ? r.state : null })
    const res = await addContactToCrm({
      fullName: r.fullName.trim(), title: r.title || null, email: r.email?.includes('@') ? r.email.trim().toLowerCase() : null, phone: r.phone ?? null,
      orgId: org.id, orgName: org.name, roles: ['RECRUITER_PROSPECT'], goals: ['ECOSYSTEM_RECRUITING'], priority: null,
      note: `Recruiter found in public firm listings. Source: ${r.sourceUrl}${r.city ? `. Based in ${r.city}, ${r.state}` : ''}.`,
    })
    if (res.outcome === 'removed') { tally.removed++; continue }
    tally[res.outcome]++
    const p = await prisma.crmPerson.findUniqueOrThrow({ where: { id: res.personId }, select: { coverageStates: true, coverageIndustries: true, coverageFunctions: true, location: true } })
    await prisma.crmPerson.update({
      where: { id: res.personId },
      data: {
        coverageStates: [...new Set([...p.coverageStates, ...states])], coverageIndustries: [...new Set([...p.coverageIndustries, ...industries])],
        coverageFunctions: [...new Set([...p.coverageFunctions, ...functions])], coverageSource: 'research',
        recruiterKind: classifyRecruiter({ title: r.title, atSearchFirm: true }),
        ...(p.location || !r.city ? {} : { location: `${r.city}, ${r.state}` }),
      },
    })
  }
  console.log(apply ? 'applied' : 'dry run (would add)', tally)
}
main().finally(() => prisma.$disconnect())
