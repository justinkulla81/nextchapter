/**
 * Builds one layoff alert the way the live alert does, adds a "Write email" button (Gmail compose from
 * justin@launchyournextchapter.com, with a note written for each contact's role) to every contact that has
 * an address, and writes it to an HTML file. With --send it also emails it to Justin as a test. Live alerts are untouched.
 * No Hunter search, no model call.
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/send-layoff-alert-test.ts "24Hr Homecare" out.html [--send]
 */
import { writeFileSync } from 'node:fs'
import { prisma } from '../../src/lib/prisma'
import { createResend } from '../../src/lib/email/resend-client'
import { withAudienceHtml } from '../../src/lib/email/audience-tag'
import { alertBody, alertSubject, type AlertInput } from '../../src/lib/warn/layoff-alert-rules'
import { layoffPeople } from '../../src/lib/warn/layoff-alert-people'
import { buildLocalPicture, classifyLayoffIndustry } from '../../src/lib/warn/layoff-context'
import { pictureRows, talkingPoints, type Audience } from '../../src/lib/warn/layoff-picture'
import { withComposeLinks } from '../../src/lib/warn/layoff-alert-drafts'
import { employerSlug } from '../../src/lib/warn/layoff-pages'

const SITE = 'https://launchyournextchapter.com'
const TO = 'justin@launchyournextchapter.com'
const PARTNER: Record<string, Audience> = { rapid_response: 'rapid_response', workforce_board: 'workforce_board', job_centers: 'job_centers', economic_development: 'economic_development' }

async function main() {
  const [name, out] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const send = process.argv.includes('--send')
  const n = await prisma.warnNotice.findFirst({ where: { employer: { contains: name, mode: 'insensitive' } }, orderBy: [{ employees: { sort: 'desc', nulls: 'last' } }, { noticeDate: 'desc' }] })
  if (!n) { console.log('no notice'); return }
  const org = await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: n.normalizedEmployer }, select: { id: true, usState: true } })
  const state = n.state ?? org?.usState ?? null
  const company = n.companyId ? await prisma.company.findUnique({ where: { id: n.companyId }, select: { industry: true } }) : null
  const industry = await classifyLayoffIndustry({ employer: n.employer, companyIndustry: company?.industry ?? null, naics: n.industry, sicDescription: null, allowModel: false })
  const picture = await buildLocalPicture({ employer: n.employer, employees: n.employees, state, county: n.county, industryKey: industry?.key ?? null })
  const rel = await layoffPeople(org?.id ?? n.promotedOrgId ?? null, { state, county: n.county, address: n.address, workforceBoardId: n.workforceBoardId, industryKey: industry?.key ?? null })
  const withPitch = rel.groups.map((g) => (PARTNER[g.key] ? { ...g, pitch: talkingPoints(picture, PARTNER[g.key]) ?? undefined } : g))
  const groups = withComposeLinks(withPitch, { picture, peoplePage: `${SITE}/network/company/${employerSlug(n.employer, null)}` })
  const input: AlertInput = {
    employer: n.employer, employees: n.employees, percent: null, kind: n.source === 'WARN_FILING' ? 'warn' : 'news', confirmed: true,
    inCrm: !!org, people: 0, warm: 0, contactsFound: 0, place: [n.county, state].filter(Boolean).join(', ') || rel.placeLabel, groups,
    picture: { rows: pictureRows(picture, { industryLabel: industry?.label ?? null, industrySource: industry?.source ?? null }) },
  }
  const { draftFor, draftKind } = await import('../../src/lib/warn/layoff-alert-drafts')
  const dctx = { picture, peoplePage: `${SITE}/network/company/${employerSlug(n.employer, null)}` }
  const printed = ['head_hr', 'rapid_response', 'workforce_board', 'job_centers', 'economic_development'].map((k) => {
    const c = withPitch.find((g) => g.key === k)?.cards.find((x) => x.email)
    const kind = c ? draftKind(k, c.title) : null
    if (!c || !kind) return `## ${k}: no contact with an email`
    const dr = draftFor(kind, c, dctx)
    return `## ${k} (to ${c.name})\nSUBJECT ARMS: ${dr.subjects?.map((s, i) => `${'ABC'[i]}) ${s}`).join(' | ') ?? dr.subject}\n\n${dr.body}`
  })
  if (out) writeFileSync(out.replace(/\.html$/, '.drafts.md'), printed.join('\n\n---\n\n'))
  const html = alertBody(input, { source: n.sourceUrl, org: org ? `${SITE}/support/admin/crm/organizations/${org.id}` : null, notices: `${SITE}/support/admin/crm/warn` })
  const banner = `<p style="max-width:640px;margin:0 auto 12px;padding:8px 12px;background:#FFF0D6;border-radius:6px;font:13px/1.4 sans-serif;color:#9A5B00">Test of the new "Write email" buttons. Each opens Gmail from ${TO} with a note for that person's role. Nothing sends until you press Send in Gmail. Real alerts have not changed.</p>`
  const full = `${banner}${html}`
  if (out) writeFileSync(out, `<!doctype html><meta charset="utf-8"><body style="margin:24px;background:#fff">${withAudienceHtml('admin', full)}</body>`)
  console.log(n.employer, n.source, state, n.employees, groups.map((g) => `${g.key}:${g.cards.length}(${g.cards.filter((c) => c.compose).length} buttons)`).join(' '))
  if (send) {
    const { error, data } = await createResend(process.env.RESEND_API_KEY, 'admin').emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>', to: TO, subject: `[TEST] ${alertSubject(input)}`, html: withAudienceHtml('admin', full),
    })
    console.log(error ? `send failed: ${JSON.stringify(error)}` : `sent ${data?.id}`)
  }
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
