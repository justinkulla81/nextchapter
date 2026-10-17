// The monthly "from your college, for you" email: one short, personal note to
// every alum on the roster: where they are (in transition or not), events
// coming up, new alumni-only jobs and projects, a classmate's news and the
// college's latest news. Off until the college admin switches it on (Admin ›
// Services); goes out from the nightly job on the chosen day, in batches so a
// big roster finishes over a few nights. Uses sendCampaign: suppressed and
// do-not-contact alumni are skipped, every email has one-click unsubscribe,
// and demo colleges never email.

import 'server-only'
import { prisma } from '@/lib/prisma'
import { sendCampaign } from './outreach'

const DAY = 86_400_000
const BATCH = 400

export type MonthlySettings = { on: boolean; day: number; month: string | null; campaignId: string | null }

export function readMonthly(enabledFeatures: unknown): MonthlySettings {
  const o = ((enabledFeatures as { monthly?: Partial<MonthlySettings> } | null)?.monthly ?? {}) as Partial<MonthlySettings>
  return { on: o.on === true, day: typeof o.day === 'number' && o.day >= 1 && o.day <= 28 ? o.day : 15, month: typeof o.month === 'string' ? o.month : null, campaignId: typeof o.campaignId === 'string' ? o.campaignId : null }
}

const SUBJECT = 'This month from {{college}}, for you'
const BODY = `Hi {{firstName}},

{{stageLine}}

{{jobsLine}}{{eventsLine}}{{classLine}}{{newsLine}}
Your {{college}} page: {{link}}

{{college}}`

function line(label: string, items: string[]) {
  return items.length ? `${label}\n${items.map((x) => `- ${x}`).join('\n')}\n\n` : ''
}

// The personal parts for each member.
async function personalize(institutionId: string, memberIds: string[], now: Date) {
  const [members, events, jobs, opps, news, notes] = await Promise.all([
    prisma.institutionMember.findMany({ where: { id: { in: memberIds } }, select: { id: true, classYear: true, transitionFlags: { where: { state: 'IN_TRANSITION' }, select: { id: true }, take: 1 } } }),
    prisma.collegeEvent.findMany({ where: { institutionId, cancelledAt: null, startsAt: { gte: now, lte: new Date(now.getTime() + 45 * DAY) } }, orderBy: { startsAt: 'asc' }, take: 3, select: { title: true, startsAt: true } }),
    prisma.exclusiveJobPosting.findMany({ where: { institutionScopeId: institutionId, archivedAt: null, createdAt: { gte: new Date(now.getTime() - 31 * DAY) } }, orderBy: { createdAt: 'desc' }, take: 3, select: { title: true, companyName: true } }).catch(() => []),
    prisma.alumniOpportunity.count({ where: { institutionId, status: 'OPEN', createdAt: { gte: new Date(now.getTime() - 31 * DAY) } } }),
    prisma.collegeNewsPost.findFirst({ where: { institutionId, publishedAt: { lte: now, gte: new Date(now.getTime() - 45 * DAY) } }, orderBy: { publishedAt: 'desc' }, select: { title: true } }),
    prisma.classNote.findMany({ where: { institutionId, hiddenAt: null, createdAt: { gte: new Date(now.getTime() - 45 * DAY) } }, orderBy: { createdAt: 'desc' }, take: 200, select: { body: true, member: { select: { firstName: true, lastName: true, classYear: true } } } }),
  ])
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const jobsItems = jobs.map((j) => `${j.title}${j.companyName ? ` at ${j.companyName}` : ''}`)
  if (opps) jobsItems.push(`${opps} new project${opps === 1 ? '' : 's'}, fractional role${opps === 1 ? '' : 's'} or board seat${opps === 1 ? '' : 's'} posted by alumni`)
  return new Map(
    members.map((m) => {
      const inTransition = m.transitionFlags.length > 0
      const classmate = notes.find((n) => m.classYear && n.member.classYear === m.classYear)
      return [
        m.id,
        {
          stageLine: inTransition
            ? 'You told us you’re between roles. Your college is in your corner: a counselor, alumni who will take your call, and programs that may be free for you. Start on your page.'
            : 'Thinking about your next move, a promotion or something new? Alumni who’ll take a call and roles posted just for alumni are on your page.',
          jobsLine: line('New for alumni this month:', jobsItems),
          eventsLine: line('Coming up:', events.map((e) => `${e.title}, ${fmt.format(e.startsAt)}`)),
          classLine: classmate ? line(`From the class of ${classmate.member.classYear}:`, [`${[classmate.member.firstName, classmate.member.lastName].filter(Boolean).join(' ')}: ${classmate.body.slice(0, 160)}`]) : '',
          newsLine: news ? line('College news:', [news.title]) : '',
        },
      ]
    }),
  )
}

// Send to everyone due this month who hasn't had it yet, up to BATCH per call.
export async function sendMonthlyEmail(institutionId: string, opts: { onlyMemberIds?: string[]; createdBy: string; now?: Date } = { createdBy: 'monthly' }) {
  const now = opts.now ?? new Date()
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { enabledFeatures: true } })
  const settings = readMonthly(inst.enabledFeatures)
  const month = now.toISOString().slice(0, 7)
  const test = !!opts.onlyMemberIds?.length
  // One campaign per month: later batches go into the same one.
  let campaignId = !test && settings.month === month ? settings.campaignId : null
  if (!test && !campaignId) {
    const c = await prisma.outreachCampaign.create({ data: { institutionId, type: 'CUSTOM', subject: SUBJECT, body: BODY, createdBy: opts.createdBy }, select: { id: true } })
    campaignId = c.id
    const ef = (inst.enabledFeatures ?? {}) as Record<string, unknown>
    await prisma.institution.update({ where: { id: institutionId }, data: { enabledFeatures: { ...ef, monthly: { ...settings, month, campaignId } } } })
  }
  const already = campaignId ? new Set((await prisma.outreachSend.findMany({ where: { campaignId }, select: { memberId: true } })).map((s) => s.memberId)) : new Set<string>()
  const due = test
    ? opts.onlyMemberIds!
    : (
        await prisma.institutionMember.findMany({
          where: { institutionId, affiliation: { in: ['ALUM', 'STAFF_ALUM'] }, doNotContact: false, emailSuppressedAt: null, status: { not: 'OPTED_OUT' } },
          select: { id: true },
          orderBy: { id: 'asc' },
        })
      )
        .map((m) => m.id)
        .filter((id) => !already.has(id))
        .slice(0, BATCH)
  if (!due.length) return { sent: 0, skipped: 0, remaining: 0, demo: false }
  const values = await personalize(institutionId, due, now)
  const r = await sendCampaign({
    institutionId,
    type: 'CUSTOM',
    subject: SUBJECT,
    body: BODY,
    createdBy: opts.createdBy,
    recipients: due.map((memberId) => ({ memberId, extra: values.get(memberId) ?? {} })),
    ...(campaignId ? { campaignId } : {}),
  })
  return { sent: r.sent, skipped: r.skipped, remaining: test ? 0 : Math.max(0, (await countDue(institutionId, campaignId)) ), demo: r.demo }
}

async function countDue(institutionId: string, campaignId: string | null) {
  const total = await prisma.institutionMember.count({ where: { institutionId, affiliation: { in: ['ALUM', 'STAFF_ALUM'] }, doNotContact: false, emailSuppressedAt: null, status: { not: 'OPTED_OUT' } } })
  const done = campaignId ? await prisma.outreachSend.count({ where: { campaignId } }) : 0
  return total - done
}

// Nightly: every college with it on, on or after its day, until the month's run is done.
export async function runMonthlyEmails(now = new Date()) {
  const colleges = await prisma.institution.findMany({ select: { id: true, enabledFeatures: true } })
  const out: { institutionId: string; sent: number; remaining: number }[] = []
  for (const c of colleges) {
    const s = readMonthly(c.enabledFeatures)
    if (!s.on || now.getUTCDate() < s.day) continue
    const r = await sendMonthlyEmail(c.id, { createdBy: 'monthly-email', now })
    if (r.sent || r.remaining) out.push({ institutionId: c.id, sent: r.sent, remaining: r.remaining })
  }
  return out
}
