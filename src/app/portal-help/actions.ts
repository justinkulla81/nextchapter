'use server'

import { headers } from 'next/headers'
import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOutplacementOrgUser } from '@/lib/employer/outplacement-auth'
import { getCurrentRecruiter } from '@/lib/recruiter/current-recruiter'
import { getCurrentCoach } from '@/lib/coach/current-coach'
import { getInstitutionAccess } from '@/lib/higher-ed/access'
import { captureServerEvent } from '@/lib/posthog/server'
import { HELP_MESSAGE_MAX, isConversationKind, mentionsCrisis, type HelpFormKind } from '@/lib/help/constants'
import { notifyAdminOfPortalHelp } from '@/lib/help/notify'
import { storeHelpScreenshot } from '@/lib/help/screenshot'
import type { PortalHelpPortal } from '@/lib/help/constants'

export type PortalHelpState = { error?: string; sent?: boolean; kind?: HelpFormKind; email?: string | null; message?: string } | undefined

const KINDS = new Set<HelpFormKind>(['help', 'problem', 'idea', 'feedback'])

type Requester = { name: string; email: string | null; org: string | null; id: string; feedbackSource: 'EMPLOYER' | 'RECRUITER' | 'COACH' | 'OTHER' }

/**
 * Who is asking, resolved on the server from the portal's own session. The
 * client only says which portal it is in; it never supplies a name or email.
 */
async function resolveRequester(portal: PortalHelpPortal, slug: string | null): Promise<Requester | null> {
  if (portal === 'EMPLOYER') {
    const u = await getCurrentOutplacementOrgUser()
    return { name: u.fullName || u.email || 'Employer user', email: u.email, org: u.orgName, id: u.userId, feedbackSource: 'EMPLOYER' }
  }
  if (portal === 'RECRUITER') {
    const r = await getCurrentRecruiter()
    return { name: r.fullName, email: r.workEmail, org: r.firmName, id: r.id, feedbackSource: 'RECRUITER' }
  }
  if (portal === 'COACH') {
    const c = await getCurrentCoach()
    const { data: { user } } = await (await createClient('coach')).auth.getUser()
    return { name: c.fullName, email: user?.email ?? null, org: c.firmName, id: c.id, feedbackSource: 'COACH' }
  }
  if (portal === 'INSTITUTION' && slug) {
    const access = await getInstitutionAccess(slug)
    // A demo guest pass is a prospect looking around, not a customer.
    if (!access || access === 'signed-out' || access.mode === 'demo-guest') return null
    return { name: access.email ?? 'Institution user', email: access.email ?? null, org: access.institution.name, id: access.userId, feedbackSource: 'OTHER' }
  }
  return null
}

/**
 * Help & feedback from a partner portal (employer, recruiter, coach,
 * institution). Help and problems open a conversation in the same admin Help
 * inbox the candidates use; ideas and feedback become ProductFeedback.
 */
export async function submitPortalHelp(portal: PortalHelpPortal, slug: string | null, _prev: PortalHelpState, formData: FormData): Promise<PortalHelpState> {
  const who = await resolveRequester(portal, slug)
  if (!who) return { error: 'Your session ended. Sign in again, then send your message.' }

  const kindRaw = String(formData.get('kind') ?? '') as HelpFormKind
  const kind: HelpFormKind = KINDS.has(kindRaw) ? kindRaw : 'help'
  const message = String(formData.get('message') ?? '').replace(/\r\n/g, '\n').trim().slice(0, HELP_MESSAGE_MAX)
  const contextPath = String(formData.get('contextPath') ?? '').trim().slice(0, 300) || null
  const contextTitle = String(formData.get('contextTitle') ?? '').trim().slice(0, 200) || null
  if (message.length < 3) return { error: 'Write a few words so we know what this is about.', message }
  const crisis = mentionsCrisis(message)
  const label = [who.name, who.org].filter(Boolean).join(' · ')

  if (!isConversationKind(kind)) {
    const fb = await prisma.productFeedback.create({
      data: {
        source: who.feedbackSource, personLabel: label, contactEmail: who.email, rawText: message,
        channel: kind === 'idea' ? 'portal idea' : 'portal feedback', contextPath, receivedAt: new Date(),
      },
    })
    captureServerEvent(who.id, 'product_feedback_submitted', { feedbackId: fb.id, kind, page: contextPath, portal })
    return { sent: true, kind, email: who.email }
  }

  let screenshotPath: string | null = null
  const file = formData.get('screenshot')
  if (kind === 'problem' && file instanceof File && file.size > 0) {
    const stored = await storeHelpScreenshot(`portal-${portal.toLowerCase()}`, file)
    if (stored === 'too_big') return { error: 'That screenshot is over 5 MB. Try a smaller one, or send without it.', message }
    if (stored === 'bad_type') return { error: 'Screenshots need to be PNG, JPG or WebP.', message }
    screenshotPath = stored
  }

  const subject = message.split('\n')[0].slice(0, 90) + (message.split('\n')[0].length > 90 ? '…' : '')
  const userAgent = (await headers()).get('user-agent')?.slice(0, 300) ?? null
  const request = await prisma.helpRequest.create({
    data: {
      portal, requesterName: who.name, requesterEmail: who.email, requesterOrg: who.org,
      kind: kind === 'problem' ? 'PROBLEM' : 'HELP', subject, contextPath, contextTitle, userAgent, screenshotPath,
      flaggedCrisis: crisis, messages: { create: { body: message } },
    },
  })
  after(() => notifyAdminOfPortalHelp(request.id, message))
  captureServerEvent(who.id, 'help_request_submitted', { requestId: request.id, type: kind, page: contextPath, portal, crisis, hasScreenshot: !!screenshotPath })
  return { sent: true, kind, email: who.email }
}
