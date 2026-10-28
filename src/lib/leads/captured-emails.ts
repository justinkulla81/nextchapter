import { prisma } from '@/lib/prisma'

// Every place the site captures an email lands in its own table. This reads
// them all into one shape so the admin page and the daily digest show the
// same list. Read-only: nothing here writes or sends.

export interface CapturedEmail {
  email: string
  name: string | null
  /** The table it came from, in words: "Journey picker", "Newsletter", ... */
  channel: string
  /** Where on the site or which offer: the lead's source, guide, tier or audience. */
  detail: string
  capturedAt: Date
  unsubscribed: boolean
  /** The journey (persona slug) they picked, when they picked one. */
  journey?: string
  /** Where the form was submitted from, to match a first page view. */
  ip?: string | null
}

const PER_SOURCE_LIMIT = 2000

const KIND_LABEL: Record<string, string> = {
  journey: 'Journey picker',
  job_alert: 'Job alert',
  apply_save: 'Saved job',
  deadline_reminders: 'Deadline reminders',
  pay_check: 'Pay check',
  resume_check: 'Résumé check',
  layoff_alert: 'Layoff alert',
}

function clean(email: string): string {
  return email.trim().toLowerCase()
}

function fullName(first?: string | null, last?: string | null): string | null {
  const name = [first, last].filter(Boolean).join(' ').trim()
  return name || null
}

const DAY_MS = 24 * 60 * 60 * 1000

/** The last `days` days of captures. */
export function loadCapturedEmailsForDays(days: number): Promise<CapturedEmail[]> {
  return loadCapturedEmails(new Date(Date.now() - days * DAY_MS))
}

export async function loadCapturedEmails(since: Date): Promise<CapturedEmail[]> {
  const where = { createdAt: { gte: since } }
  const take = PER_SOURCE_LIMIT
  const orderBy = { createdAt: 'desc' } as const

  const [homepage, newsletter, contact, guides, resumes, coaching, tiers, waitlist] = await Promise.all([
    prisma.homepageLead.findMany({
      where,
      take,
      orderBy,
      select: { email: true, kind: true, source: true, situation: true, journeySlug: true, ip: true, createdAt: true, unsubscribedAt: true },
    }),
    prisma.newsletterSubscriber.findMany({
      where,
      take,
      orderBy,
      select: { email: true, source: true, ip: true, createdAt: true, unsubscribedAt: true },
    }),
    prisma.contactSubmission.findMany({
      where,
      take,
      orderBy,
      select: { email: true, fullName: true, audience: true, source: true, createdAt: true },
    }),
    prisma.guideLead.findMany({
      where,
      take,
      orderBy,
      select: { email: true, firstName: true, guideSlug: true, source: true, createdAt: true },
    }),
    prisma.resumeSubmissionLead.findMany({
      where,
      take,
      orderBy,
      select: { email: true, fullName: true, source: true, createdAt: true },
    }),
    prisma.coachingWaitlist.findMany({
      where,
      take,
      orderBy,
      select: { email: true, firstName: true, lastName: true, source: true, createdAt: true },
    }),
    prisma.membershipTierWaitlist.findMany({
      where,
      take,
      orderBy,
      select: { email: true, firstName: true, lastName: true, tier: true, source: true, createdAt: true },
    }),
    prisma.waitlistSignup.findMany({ where, take, orderBy, select: { audience: true, payload: true, createdAt: true } }),
  ])

  const rows: CapturedEmail[] = []

  for (const r of homepage) {
    rows.push({
      email: clean(r.email),
      name: null,
      channel: KIND_LABEL[r.kind] ?? r.kind,
      detail: r.source,
      capturedAt: r.createdAt,
      unsubscribed: r.unsubscribedAt != null,
      journey: (r.kind === 'journey' ? r.situation : r.journeySlug) || undefined,
      ip: r.ip,
    })
  }
  for (const r of newsletter) {
    rows.push({
      email: clean(r.email),
      name: null,
      channel: 'Newsletter',
      detail: r.source ?? '',
      capturedAt: r.createdAt,
      unsubscribed: r.unsubscribedAt != null,
      ip: r.ip,
    })
  }
  for (const r of contact) {
    rows.push({
      email: clean(r.email),
      name: r.fullName,
      channel: 'Contact form',
      detail: [r.audience, r.source].filter(Boolean).join(' · '),
      capturedAt: r.createdAt,
      unsubscribed: false,
    })
  }
  for (const r of guides) {
    rows.push({
      email: clean(r.email),
      name: r.firstName,
      channel: 'Guide download',
      detail: `${r.guideSlug} · ${r.source}`,
      capturedAt: r.createdAt,
      unsubscribed: false,
    })
  }
  for (const r of resumes) {
    rows.push({
      email: clean(r.email),
      name: r.fullName,
      channel: 'Résumé submission',
      detail: r.source,
      capturedAt: r.createdAt,
      unsubscribed: false,
    })
  }
  for (const r of coaching) {
    rows.push({
      email: clean(r.email),
      name: fullName(r.firstName, r.lastName),
      channel: 'Coaching waitlist',
      detail: r.source,
      capturedAt: r.createdAt,
      unsubscribed: false,
    })
  }
  for (const r of tiers) {
    rows.push({
      email: clean(r.email),
      name: fullName(r.firstName, r.lastName),
      channel: 'Plan waitlist',
      detail: `${r.tier} · ${r.source}`,
      capturedAt: r.createdAt,
      unsubscribed: false,
    })
  }
  for (const r of waitlist) {
    // The waitlist payload is free-form JSON from the form; only keep rows
    // that actually carry an email.
    const payload = r.payload as Record<string, unknown> | null
    const email = typeof payload?.email === 'string' ? payload.email : null
    if (!email) continue
    const name = typeof payload?.name === 'string' ? payload.name : null
    rows.push({
      email: clean(email),
      name,
      channel: 'Waitlist',
      detail: r.audience,
      capturedAt: r.createdAt,
      unsubscribed: false,
    })
  }

  return rows.sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())
}

export interface CapturedPerson {
  email: string
  name: string | null
  channels: string[]
  journey?: string
  ip?: string | null
  /** The first thing they did, in words: "Newsletter · home". */
  firstWhere: string
  firstSeen: Date
  lastSeen: Date
  unsubscribed: boolean
}

/** One entry per address: the same person on three forms is one person. */
export function groupByEmail(rows: CapturedEmail[]): CapturedPerson[] {
  const byEmail = new Map<string, CapturedPerson>()
  for (const r of rows) {
    const p = byEmail.get(r.email)
    if (!p) {
      byEmail.set(r.email, {
        email: r.email,
        name: r.name,
        channels: [r.channel],
        journey: r.journey,
        ip: r.ip,
        firstWhere: [r.channel, r.detail].filter(Boolean).join(' · '),
        firstSeen: r.capturedAt,
        lastSeen: r.capturedAt,
        unsubscribed: r.unsubscribed,
      })
      continue
    }
    if (!p.channels.includes(r.channel)) p.channels.push(r.channel)
    if (!p.name && r.name) p.name = r.name
    if (!p.journey && r.journey) p.journey = r.journey
    if (!p.ip && r.ip) p.ip = r.ip
    if (r.capturedAt < p.firstSeen) {
      p.firstSeen = r.capturedAt
      p.firstWhere = [r.channel, r.detail].filter(Boolean).join(' · ')
    }
    if (r.capturedAt > p.lastSeen) p.lastSeen = r.capturedAt
    p.unsubscribed = p.unsubscribed && r.unsubscribed
  }
  return [...byEmail.values()].sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
}
