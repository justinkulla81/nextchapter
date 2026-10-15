// College email safety, against the real database on a throwaway college
// deleted at the end:
//
//   - sender name, reply-to and the unsubscribe footer
//   - Resend events: opens and clicks recorded (unsubscribe clicks aren't),
//     temporary bounces ignored, hard bounces and complaints suppress
//   - unsubscribe and resubscribe (only an unsubscribe can be undone)
//   - suppressed alumni are skipped by every send and every audience, and
//     show in the CRM updates file
//
//   npm run verify:email-safety
import { randomUUID } from 'crypto'
import { prisma } from '../../src/lib/prisma'
import { emailSettingsFrom, sendCampaign, unsubscribeUrls, withFooter } from '../../src/lib/higher-ed/outreach'
import { applyHigherEdEvent, memberForToken, resubscribeMember, suppressMember } from '../../src/lib/higher-ed/email-events'
import { audienceCount } from '../../src/lib/higher-ed/composer'
import { countInvitable } from '../../src/lib/higher-ed/invites'
import { updatesExportRows } from '../../src/lib/higher-ed/views'
import type { AccessToken } from '../../src/lib/higher-ed/workspaces'

let passed = 0
const failures: string[] = []
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) passed++
  else failures.push(`${name}: expected ${e}, got ${a}`)
}

const tag = `emtest${randomUUID().slice(0, 8)}`

async function main() {
  const inst = await prisma.institution.create({
    data: { slug: tag, name: 'Email Test College', isDemo: true, isSampleData: true, enabledFeatures: { email: { fromName: 'ETC Alumni', replyTo: 'alumni@etc.test' } } },
    select: { id: true, slug: true, name: true },
  })
  try {
    check('Sender settings', emailSettingsFrom({ email: { fromName: 'ETC Alumni', replyTo: 'alumni@etc.test' } }, { name: 'X', programBrandName: null }), { fromName: 'ETC Alumni', replyTo: 'alumni@etc.test' })
    check('Sender defaults to the program name', emailSettingsFrom({}, { name: 'X College', programBrandName: 'X NextChapter' }), { fromName: 'X NextChapter', replyTo: null })
    const u = unsubscribeUrls(tag, 'tok')
    check('Footer carries the unsubscribe link', withFooter('Hi', 'X', u.page).endsWith(`Stop these emails: ${u.page}`), true)

    const mk = (n: string, i: number) =>
      prisma.institutionMember.create({ data: { institutionId: inst.id, email: `${n}@${tag}.test`, firstName: n, classYear: 2000, externalId: `x${i}` }, select: { id: true } })
    const [a, b, c, d] = await Promise.all([mk('ann', 1), mk('bo', 2), mk('cy', 3), mk('di', 4)])
    const camp = await prisma.outreachCampaign.create({ data: { institutionId: inst.id, type: 'CUSTOM', subject: 's', body: 'b', createdBy: 'verify' }, select: { id: true } })
    const send = (memberId: string) => prisma.outreachSend.create({ data: { campaignId: camp.id, memberId, email: 'x', providerMessageId: `${tag}-${memberId}` }, select: { id: true, claimToken: true } })
    const [sa] = await Promise.all([send(a.id), send(b.id), send(c.id)])
    const ev = (memberId: string, type: string, data: Record<string, unknown> = {}) => applyHigherEdEvent({ type, data: { email_id: `${tag}-${memberId}`, ...data } })

    check('Unknown email ids pass through to list mail', await applyHigherEdEvent({ type: 'email.opened', data: { email_id: 'nope' } }), 'ignored')
    await ev(a.id, 'email.opened')
    await ev(a.id, 'email.clicked', { click: { link: `https://x/i/${tag}/unsubscribe?t=1` } })
    let row = await prisma.outreachSend.findUniqueOrThrow({ where: { id: sa.id }, select: { openedAt: true, clickedAt: true } })
    check('Open recorded, unsubscribe click is not a click', [!!row.openedAt, row.clickedAt], [true, null])
    await ev(a.id, 'email.clicked', { click: { link: 'https://x/i/join' } })
    row = await prisma.outreachSend.findUniqueOrThrow({ where: { id: sa.id }, select: { openedAt: true, clickedAt: true } })
    check('Real click recorded', !!row.clickedAt, true)

    await ev(b.id, 'email.bounced', { bounce: { type: 'Transient' } })
    check('Temporary bounce changes nothing', (await prisma.institutionMember.findUniqueOrThrow({ where: { id: b.id } })).emailSuppressedAt, null)
    await ev(b.id, 'email.bounced', { bounce: { type: 'Permanent', subType: 'General' } })
    await ev(c.id, 'email.complained')
    const reasons = await prisma.institutionMember.findMany({ where: { id: { in: [b.id, c.id] } }, select: { id: true, emailSuppressedReason: true }, orderBy: { email: 'asc' } })
    check('Hard bounce and complaint suppress', reasons.map((r) => r.emailSuppressedReason), ['BOUNCED', 'COMPLAINED'])

    // Unsubscribe from the token, undo it; a bounce can't be undone.
    const viaToken = await memberForToken(sa.claimToken)
    await suppressMember(viaToken!.id, 'UNSUBSCRIBED')
    check('Unsubscribe from the email link', (await prisma.institutionMember.findUniqueOrThrow({ where: { id: a.id } })).emailSuppressedReason, 'UNSUBSCRIBED')
    check('Resubscribe after an unsubscribe', await resubscribeMember(a.id), true)
    check('No resubscribe after a bounce', await resubscribeMember(b.id), false)

    // Everything skips suppressed alumni.
    // Only Di was never emailed; suppress Di and the invite list is empty.
    check('Di is due an invitation', await countInvitable(inst.id), 1)
    await suppressMember(d.id, 'UNSUBSCRIBED')
    check('Join invitations skip unsubscribed alumni', await countInvitable(inst.id), 0)
    await resubscribeMember(d.id)
    const r = await sendCampaign({ institutionId: inst.id, type: 'CUSTOM', subject: 'Hi {{firstName}}', body: 'x {{link}}', createdBy: 'verify', recipients: [a, b, c, d].map((m) => ({ memberId: m.id })) })
    check('Send skips bounced and complained', [r.sent, r.skipped], [2, 2])
    check('Composer audience excludes them', await audienceCount(inst.id, 'all'), 2)
    const ctx = { tokens: new Set<AccessToken>(['INSTITUTION_ADMIN']), institution: { ...inst, programBrandName: null, logoUrl: null, accentColor: null, isDemo: true, tier: 'INSTITUTION' as const }, staffUsers: [], mode: 'own' as const, email: 'v', userId: 'v' }
    const exp = await updatesExportRows(ctx)
    check('CRM file says why', exp.map((e) => e.email_status), [null, 'bounced', 'complained', null])
    // Roster re-import can't undo it: doNotContact is separate.
    await prisma.institutionMember.update({ where: { id: b.id }, data: { doNotContact: false } })
    check('Clearing do-not-contact keeps the bounce', (await prisma.institutionMember.findUniqueOrThrow({ where: { id: b.id } })).emailSuppressedReason, 'BOUNCED')
  } finally {
    await prisma.institution.delete({ where: { id: inst.id } }).catch(() => {})
    await prisma.$disconnect()
  }
  console.log(`${passed} passed, ${failures.length} failed (test college deleted)`)
  for (const f of failures) console.log('  FAIL ' + f)
  if (failures.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
