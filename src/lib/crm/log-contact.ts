import 'server-only'
import type { CrmActivityType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { refreshTouchFields } from './sync'

export const CONTACT_CHANNELS = ['EMAIL', 'LINKEDIN', 'CALL', 'MEETING', 'TEXT', 'OTHER'] as const
export type ContactChannel = (typeof CONTACT_CHANNELS)[number]

const TYPES: Record<ContactChannel, CrmActivityType> = {
  EMAIL: 'EMAIL', LINKEDIN: 'LINKEDIN_MESSAGE', CALL: 'CALL',
  MEETING: 'MEETING', TEXT: 'NOTE', OTHER: 'NOTE',
}

// The admin works in Eastern time; "today" means today there.
const TZ = 'America/New_York'

function localToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

/**
 * A contact you made by hand — LinkedIn above all, which can never log
 * itself — from the People list or the browser extension.
 *
 * Dated now when it happened today, so it sorts correctly against the mail
 * the sync logs to the minute; an earlier day gets midday Eastern, since the
 * time was never known. It used to stamp every entry at noon UTC, which put
 * a message sent this afternoon at 8am.
 *
 * Derived fields are recomputed rather than bumped by hand, which is what
 * sets "waiting on a reply": the last thing that happened was you.
 */
export async function logManualContact(input: {
  personId: string
  channel: string
  /** YYYY-MM-DD, Eastern. Omitted or today: now. */
  date?: string | null
  note?: string | null
  loggedByEmail: string | null
}): Promise<{ occurredAt: Date; type: CrmActivityType }> {
  const channel = (CONTACT_CHANNELS as readonly string[]).includes(input.channel)
    ? (input.channel as ContactChannel)
    : 'OTHER'
  const type = TYPES[channel]
  const day = input.date?.trim()
  const occurredAt = !day || day >= localToday()
    ? new Date()
    : new Date(`${day}T16:00:00Z`) // midday Eastern

  await prisma.crmActivity.create({
    data: {
      type, direction: 'OUTBOUND', personId: input.personId, occurredAt,
      subject: `Contacted by ${channel === 'LINKEDIN' ? 'LinkedIn' : channel.toLowerCase()}`,
      body: input.note?.trim() || null,
      isAutoLogged: false, loggedByEmail: input.loggedByEmail,
    },
  })
  await refreshTouchFields([input.personId])
  return { occurredAt, type }
}
