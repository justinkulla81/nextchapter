import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { addToLists } from '@/lib/mailing/lists'
import { captureServerEvent } from '@/lib/posthog/server'
import { LEAD_LIST_KEY } from './config'

// Puts everyone who gives us an address on the public site into the CRM, the
// same way the contact form does: the person with this exact email, or a new
// one. Exact email only, never a guess on a name (an uncertain match belongs on
// the Review List, not here). Idempotent: filing the same lead twice changes
// nothing. A registered candidate is found by email and left as they are.

export interface FiledLead {
  email: string
  name?: string | null
  /** In words, matching the captured-emails page: "Newsletter", "Saved job", ... */
  channel: string
  detail?: string
  /** The journey (persona slug) they picked, when they picked one. */
  journey?: string
  /** A business audience (employer waitlist and the like): a B2B lead, not a job seeker. */
  b2b?: boolean
  capturedAt?: Date
}

/** Our own team's addresses (tests, aliases) are not leads. */
export function isInternalAddress(email: string): boolean {
  return email.toLowerCase().endsWith('@launchyournextchapter.com')
}

async function leadList() {
  return prisma.mailingList.upsert({
    where: { key: LEAD_LIST_KEY },
    update: {},
    create: {
      key: LEAD_LIST_KEY,
      name: 'Website leads',
      description: 'People who gave us an email on the public site (saved jobs, alerts, newsletter, waitlists). Gets the welcome and reminder emails; unsubscribing here stops them.',
      audience: 'Candidate',
      cadence: 'AD_HOC',
      sortOrder: 90,
    },
  })
}

export async function fileLeadInCrm(lead: FiledLead): Promise<string | null> {
  try {
    const email = lead.email.trim().toLowerCase()
    if (!email || isInternalAddress(email)) return null

    let person = await prisma.crmPerson.findFirst({
      where: { deletedAt: null, OR: [{ email }, { emails: { has: email } }] },
      select: { id: true, roles: true, candidateId: true },
    })
    let created = false
    if (!person) {
      person = await prisma.crmPerson.create({
        data: {
          fullName: lead.name?.trim() || email,
          email,
          emails: [email],
          roles: lead.b2b ? [] : ['JOB_SEEKER'],
          emailSource: 'website_signup',
          // A business lead has no organization yet: a human should look.
          needsCompletion: !!lead.b2b,
        },
        select: { id: true, roles: true, candidateId: true },
      })
      created = true
    } else if (!lead.b2b && !person.roles.includes('JOB_SEEKER')) {
      await prisma.crmPerson.update({ where: { id: person.id }, data: { roles: { push: 'JOB_SEEKER' } } })
    }

    const body = [lead.detail && `From: ${lead.detail}`, lead.journey && `Journey: ${lead.journey}`, lead.b2b ? 'Type: business lead' : 'Type: candidate lead']
      .filter(Boolean)
      .join('\n')
    await prisma.crmActivity
      .create({
        data: {
          type: 'NOTE',
          direction: 'INBOUND',
          personId: person.id,
          occurredAt: lead.capturedAt ?? new Date(),
          subject: `Website signup · ${lead.channel}`,
          body,
          isAutoLogged: true,
          sourceRef: `lead:${lead.channel}:${email}`,
        },
      })
      .catch((e: Prisma.PrismaClientKnownRequestError) => {
        // Already filed on an earlier capture: the unique (type, sourceRef) key says so.
        if (e?.code !== 'P2002') throw e
      })

    if (!lead.b2b) {
      const list = await leadList()
      await addToLists({
        email,
        personId: person.id,
        listIds: [list.id],
        addedVia: 'WEBSITE_SIGNUP',
        consentNote: `Gave their email on the site (${lead.channel}${lead.detail ? `, ${lead.detail}` : ''})`,
      })
    }

    if (created) captureServerEvent(email, 'lead_filed_in_crm', { personId: person.id, channel: lead.channel, b2b: !!lead.b2b, registered: !!person.candidateId })
    return person.id
  } catch (error) {
    console.error('Failed to file lead in CRM:', error)
    return null
  }
}
