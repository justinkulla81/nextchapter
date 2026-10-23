/**
 * Adds the Sept 3 Master List (docs/funding/master-list-2026-09-03.csv) to the grants pipeline.
 *
 *   npm run crm:master-list              dry run, no writes
 *   npm run crm:master-list -- --commit
 *
 * The v7/v8 sheets were imported long ago; this later list (state and federal workforce money,
 * philanthropy, corporate programs) never was. A row is skipped when its funder already has a
 * funding lead, so re-running adds nothing twice. Rows whose "funder" is a category rather than
 * an organization ("State workforce agencies") are listed and skipped, not guessed at.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient, type CrmEligibility, type CrmFunderKind, type CrmLeadQuality, type CrmOrgType } from '@prisma/client'
import { normalizeOrgName } from '../../src/lib/text/org-name-match'
import { strictOrgKey, isRealOrgName } from '../../src/lib/crm/normalize'
import { funderKindFrom, valueTypesFrom, usStateFrom } from '../../src/lib/crm/funding'
import { toRows, parseCheckSize, parseDateish } from './parse'

const prisma = new PrismaClient()
const COMMIT = process.argv.includes('--commit')
const FILE = join(process.cwd(), 'docs/funding/master-list-2026-09-03.csv')

const GENERIC_FUNDERS = /·|^(state workforce agencies|local workforce development boards|academic research partners|neo\.tax|new york city \/ state procurement|guild \+|aws \/ google|nyc \+ state partners)/i

function eligibilityOf(route: string | null): CrmEligibility {
  const s = (route ?? '').toLowerCase()
  if (!s) return 'UNKNOWN'
  if (/nonprofit[- ]only|not eligible/.test(s)) return 'NONPROFIT_ONLY'
  if (/^direct|^yes|direct for-profit|explicitly includes for-profit/.test(s)) return 'FOR_PROFIT_ELIGIBLE'
  if (/partner|provider|vendor|subrecipient|grantee|employer|pilot|procure/.test(s)) return 'PARTNER_OR_RESEARCH'
  return 'UNKNOWN'
}

/** The sheet's 0-10 score becomes the lead grade. */
function qualityFrom(score: string | null): CrmLeadQuality {
  const n = parseFloat(score ?? '')
  if (Number.isNaN(n)) return 'UNGRADED'
  return n >= 8 ? 'A' : n >= 7 ? 'B' : n >= 6 ? 'C' : 'D'
}

function orgTypesFor(funder: string, kind: string): CrmOrgType[] {
  const t: CrmOrgType[] = ['FUNDER_GRANT']
  if (/department|dept|commission|\bdol\b|\beda\b|\bnsf\b|office|governor|agency|workforce|dws|dli|hecc|dhcd|leo\b|sbs|esd|^new york$|^connecticut$|^utah$|^massachusetts$|^michigan|college system/i.test(funder)) t.push('GOVERNMENT')
  else if (/foundation|fund\b|trust|ventures|google\.org|humanity ai|echoing green|schmidt|siegel|robin hood|workforce matters/i.test(funder) || /philanthrop/i.test(kind)) t.push('FOUNDATION')
  return t
}

async function main() {
  console.log(`FUNDING MASTER LIST — ${COMMIT ? 'COMMIT' : 'DRY RUN (no writes)'}`)
  const rows = toRows(readFileSync(FILE, 'utf8'))
  const norm = (n: string) => strictOrgKey(n, normalizeOrgName)

  const orgs = await prisma.crmOrganization.findMany({ select: { id: true, name: true, website: true } })
  const orgByKey = new Map(orgs.map((o) => [norm(o.name), o]))
  const pipelines = await prisma.crmPipeline.findMany({ where: { key: { in: ['grants', 'fundraising'] } }, include: { stages: true } })
  const pipeByKey = new Map(pipelines.map((p) => [p.key, p]))
  const existing = await prisma.crmOpportunity.findMany({
    where: { pipelineId: { in: pipelines.map((p) => p.id) } }, select: { title: true, orgId: true },
  })
  const titles = new Set(existing.map((o) => o.title.toLowerCase()))
  const orgsWithLead = new Set(existing.map((o) => o.orgId).filter((x): x is string => !!x))

  const plan: { row: (typeof rows)[number]; funder: string; title: string; pipe: string; orgId: string | null }[] = []
  const skipped: string[] = []
  const plannedOrgs = new Set<string>()
  const plannedTitles = new Set<string>()
  for (const r of rows) {
    const funder = r.get('Organization'); const prog = r.get('Opportunity')
    if (!funder || !prog || !isRealOrgName(funder)) continue
    if (GENERIC_FUNDERS.test(funder)) { skipped.push(`generic funder: ${funder} — ${prog}`); continue }
    const title = `${funder} — ${prog}`.slice(0, 180)
    if (titles.has(title.toLowerCase())) { skipped.push(`already a lead: ${title}`); continue }
    const org = orgByKey.get(norm(funder))
    if (org && orgsWithLead.has(org.id)) { skipped.push(`funder already has a lead: ${title}`); continue }
    if (plannedTitles.has(title.toLowerCase())) { skipped.push(`duplicate row: ${title}`); continue }
    // The "New Opportunities" sheet repeats funders the Master List already covers.
    if (r.get('Sheet') === 'New Opportunities' && plannedOrgs.has(norm(funder))) { skipped.push(`funder already in this list: ${title}`); continue }
    plannedTitles.add(title.toLowerCase()); plannedOrgs.add(norm(funder))
    const equity = /equity|venture debt|financing|investment/i.test(r.get('Funding Type') ?? '') && !/grant/i.test(r.get('Funding Type') ?? '')
    plan.push({ row: r, funder, title, pipe: equity ? 'fundraising' : 'grants', orgId: org?.id ?? null })
  }

  console.log(`rows ${rows.length}  to add ${plan.length}  skipped ${skipped.length}`)
  console.log(`  new organizations: ${new Set(plan.filter((p) => !p.orgId).map((p) => norm(p.funder))).size}`)
  console.log(`  with a link: ${plan.filter((p) => /^https?:/.test(p.row.get('Link') ?? '')).length}   with a dated deadline: ${plan.filter((p) => parseDateish(p.row.get('Deadline / Status'))).length}`)
  for (const s of skipped) console.log(`  skip  ${s}`)
  for (const p of plan) console.log(`  ADD   [${p.pipe}] ${p.title}${p.orgId ? '  (existing org)' : ''}`)
  if (!COMMIT) { console.log('\nDry run only. Re-run with --commit to write.'); return }

  const orgId = new Map<string, string>()
  let created = 0, opps = 0, deadlines = 0
  for (const p of plan) {
    const r = p.row
    const key = norm(p.funder)
    let id = p.orgId ?? orgId.get(key) ?? null
    const link = /^https?:/.test(r.get('Link') ?? '') ? r.get('Link')! : null
    const kind = r.get('Funding Type') ?? ''
    if (!id) {
      const o = await prisma.crmOrganization.create({
        data: {
          name: p.funder, canonicalNameNormalized: normalizeOrgName(p.funder), orgTypes: orgTypesFor(p.funder, kind),
          website: link, hqRegion: r.get('Geography'), usState: usStateFrom(r.get('Geography')),
          focus: r.get('Why it fits'),
        },
        select: { id: true },
      })
      id = o.id; orgId.set(key, id); created++
      const cs = parseCheckSize(r.get('Award Amount'))
      const kindEnum: CrmFunderKind | null = funderKindFrom(kind, p.funder) ?? 'GRANT'
      await prisma.crmInvestorProfile.create({
        data: {
          orgId: id, checkSizeMinUsd: cs.min, checkSizeMaxUsd: cs.max, checkSizeNote: r.get('Award Amount'),
          funderKind: kindEnum, valueTypes: valueTypesFrom(r.get('Award Amount'), kind), eligibility: eligibilityOf(r.get('For-Profit Route')),
        },
      })
    } else if (link) {
      await prisma.crmOrganization.updateMany({ where: { id, website: null }, data: { website: link } })
    }
    const pipe = pipeByKey.get(p.pipe)!
    const stage = pipe.stages.find((s) => s.key === 'identified') ?? pipe.stages[0]
    const cs = parseCheckSize(r.get('Award Amount'))
    const warm = r.get('Warm Connection')
    const note = [
      r.get('For-Profit Route') ? `Route: ${r.get('For-Profit Route')}` : null,
      warm ? `Warm connection: ${warm}${r.get('Connection Title') ? `, ${r.get('Connection Title')}` : ''}` : null,
      r.get('Verification') && !warm ? `Verification: ${r.get('Verification')}` : null,
    ].filter(Boolean).join('. ')
    const opp = await prisma.crmOpportunity.create({
      data: {
        pipelineId: pipe.id, stageId: stage.id, orgId: id, title: p.title, url: link,
        eligibility: eligibilityOf(r.get('For-Profit Route')), leadQuality: qualityFrom(r.get('Score')),
        amountUsdMin: cs.min, amountUsdMax: cs.max, nextStep: note || null,
      },
      select: { id: true },
    })
    opps++
    const status = r.get('Deadline / Status')
    if (status) {
      const d = parseDateish(status)
      await prisma.crmDeadline.create({
        data: {
          orgId: id, opportunityId: opp.id, label: `${r.get('Opportunity')} — deadline`.slice(0, 180), dueAt: d, rawText: d ? null : status,
          kind: d ? 'APPLICATION_CLOSE' : 'ROLLING_NO_DATE', sourceUrl: link,
        },
      })
      deadlines++
    }
  }
  console.log(`\nCreated ${created} organizations, ${opps} leads, ${deadlines} deadlines.`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
