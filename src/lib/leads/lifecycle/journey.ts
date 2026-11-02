import 'server-only'
import { prisma } from '@/lib/prisma'
import { getPersona } from '@/lib/constants/personas'
import { journeyChoices, inferJourney } from '@/lib/leads/infer-journey'
import { makeUnsubscribeToken } from '@/lib/mailing/unsubscribe-token'
import type { LeadStep } from './config'

// The one-tap journey question in the lifecycle emails ("Which sounds most like you?"). A tap lands on
// /api/lead-journey/<signed token>, which saves the answer and opens /start/<journey>. No table: the answer is a CRM note
// per address (sourceRef lead-journey:<email>), and HomepageLead.journeySlug when the address has such a row.

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'

export const journeyRef = (email: string) => `lead-journey:${email.trim().toLowerCase()}`

export interface JourneyChoice {
  label: string
  url: string
}

/** The four buttons: our guess from the search words first, then the situations most people pick. */
export function journeyButtons(email: string, step: LeadStep, detail: string | null): JourneyChoice[] {
  const token = makeUnsubscribeToken(email, null)
  return journeyChoices(inferJourney({ q: detail ?? '' }).slug)
    .map((s) => getPersona(s))
    .filter((p): p is NonNullable<ReturnType<typeof getPersona>> => !!p)
    .map((p) => ({ label: p.label, url: `${appUrl()}/api/lead-journey/${token}?p=${p.slug}&step=${step}` }))
}

export async function recordLeadJourney(email: string, slug: string): Promise<void> {
  const address = email.trim().toLowerCase()
  await prisma.homepageLead.updateMany({ where: { email: { equals: address, mode: 'insensitive' }, kind: { not: 'journey' } }, data: { journeySlug: slug } })
  const person = await prisma.crmPerson.findFirst({ where: { deletedAt: null, OR: [{ email: address }, { emails: { has: address } }] }, select: { id: true } })
  if (!person) return
  const label = getPersona(slug)?.label ?? slug
  const body = `Journey: ${slug}\nPicked in a lifecycle email (${label})`
  const sourceRef = journeyRef(address)
  const held = await prisma.crmActivity.findFirst({ where: { type: 'NOTE', sourceRef }, select: { id: true } })
  if (held) await prisma.crmActivity.update({ where: { id: held.id }, data: { body, occurredAt: new Date() } })
  else await prisma.crmActivity.create({ data: { type: 'NOTE', direction: 'INBOUND', personId: person.id, subject: 'Picked a journey', body, isAutoLogged: true, sourceRef } })
}

/** The journey slug each address picked in an email, by lower-cased address. */
export async function pickedJourneys(emails: string[]): Promise<Map<string, string>> {
  const rows = await prisma.crmActivity.findMany({ where: { type: 'NOTE', sourceRef: { in: emails.map(journeyRef) } }, select: { sourceRef: true, body: true } })
  const out = new Map<string, string>()
  for (const r of rows) {
    const slug = /Journey: (\S+)/.exec(r.body ?? '')?.[1]
    if (slug && r.sourceRef?.startsWith('lead-journey:') && getPersona(slug)) out.set(r.sourceRef.slice('lead-journey:'.length), slug)
  }
  return out
}
