import 'server-only'
import { prisma } from '@/lib/prisma'

const STALE_AFTER_DAYS = 14
const MAX_REMINDERS = 3

export interface EmailReminder {
  contactId: string
  name: string
  company: string | null
  email: string | null
  linkedinUrl: string | null
  daysSinceLastOutreach: number | null // null = never reached out
  lastOutreachAt: Date | null
}

// Surfaced on the Success Dashboard so starring someone actually does
// something beyond a visual pin — it's the input to this reminder list.
// Only starred (isPriority) contacts qualify: emailing everyone you've ever
// emailed before would just be noise, but a candidate who starred someone
// and then let two weeks go by without following up is exactly the "you
// meant to do this" gap a reminder should close.
export async function getEmailReminders(candidateId: string): Promise<EmailReminder[]> {
  const staleCutoff = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000)

  const starred = await prisma.supportNetworkContact.findMany({
    where: { candidateId, isPriority: true, removedAt: null },
    select: {
      id: true,
      name: true,
      company: true,
      email: true,
      linkedinUrl: true,
      outreachLogs: { orderBy: { loggedAt: 'desc' }, take: 1, select: { loggedAt: true } },
    },
  })

  const due = starred
    .map((contact) => {
      const lastOutreach = contact.outreachLogs[0]?.loggedAt ?? null
      const daysSinceLastOutreach = lastOutreach
        ? Math.floor((Date.now() - lastOutreach.getTime()) / (24 * 60 * 60 * 1000))
        : null
      return { contact, lastOutreach, daysSinceLastOutreach }
    })
    .filter(({ lastOutreach }) => !lastOutreach || lastOutreach < staleCutoff)
    .sort((a, b) => {
      // Never-contacted first, then longest-overdue.
      if (!a.lastOutreach && b.lastOutreach) return -1
      if (a.lastOutreach && !b.lastOutreach) return 1
      if (!a.lastOutreach && !b.lastOutreach) return 0
      return a.lastOutreach!.getTime() - b.lastOutreach!.getTime()
    })
    .slice(0, MAX_REMINDERS)

  return due.map(({ contact, lastOutreach, daysSinceLastOutreach }) => ({
    contactId: contact.id,
    name: contact.name,
    company: contact.company,
    email: contact.email,
    linkedinUrl: contact.linkedinUrl,
    daysSinceLastOutreach,
    lastOutreachAt: lastOutreach,
  }))
}

const DEFAULT_STALE_CONTACT_WINDOW_DAYS = 30

export interface StaleContact {
  contactId: string
  name: string
  company: string | null
  isPriority: boolean
  daysSinceLastOutreach: number | null // null = never reached out
  lastOutreachAt: Date | null
}

// General-purpose version of getEmailReminders above — every contact, not
// just starred ones, and an adjustable window instead of the fixed 14-day/
// top-3 shortlist that feeds the dashboard's own reminder card. This is the
// raw input Prompt 87's unified follow-up view is meant to read from (along
// with stale contacts, it also folds in unanswered applications and
// post-interview thank-yous) — deliberately not wired into any UI here, so
// this doesn't become a second, competing reminder surface.
export async function getStaleContacts(
  candidateId: string,
  windowDays: number = DEFAULT_STALE_CONTACT_WINDOW_DAYS
): Promise<StaleContact[]> {
  const staleCutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

  const contacts = await prisma.supportNetworkContact.findMany({
    where: { candidateId, removedAt: null },
    select: {
      id: true,
      name: true,
      company: true,
      isPriority: true,
      outreachLogs: { orderBy: { loggedAt: 'desc' }, take: 1, select: { loggedAt: true } },
    },
  })

  return contacts
    .map((contact) => {
      const lastOutreach = contact.outreachLogs[0]?.loggedAt ?? null
      const daysSinceLastOutreach = lastOutreach
        ? Math.floor((Date.now() - lastOutreach.getTime()) / (24 * 60 * 60 * 1000))
        : null
      return { contact, lastOutreach, daysSinceLastOutreach }
    })
    .filter(({ lastOutreach }) => !lastOutreach || lastOutreach < staleCutoff)
    .sort((a, b) => {
      if (!a.lastOutreach && b.lastOutreach) return -1
      if (a.lastOutreach && !b.lastOutreach) return 1
      if (!a.lastOutreach && !b.lastOutreach) return 0
      return a.lastOutreach!.getTime() - b.lastOutreach!.getTime()
    })
    .map(({ contact, lastOutreach, daysSinceLastOutreach }) => ({
      contactId: contact.id,
      name: contact.name,
      company: contact.company,
      isPriority: contact.isPriority,
      daysSinceLastOutreach,
      lastOutreachAt: lastOutreach,
    }))
}
