'use server'

import { headers } from 'next/headers'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import {
  HELP_MESSAGE_MAX, HELP_SCREENSHOT_BUCKET, HELP_SCREENSHOT_MAX_BYTES, isConversationKind, mentionsCrisis, parseHelpAudience,
  type HelpAudience, type HelpFormKind,
} from '@/lib/help/constants'
import { resolveRequester, type Requester } from '@/lib/help/requester'
import { notifyAdminOfHelp } from '@/lib/help/notify'
import { logHelpOnCrm } from '@/lib/help/crm-note'

export type HelpFormState =
  | { error?: string; sent?: boolean; kind?: HelpFormKind; requestId?: string; message?: string }
  | undefined

const KINDS = new Set<HelpFormKind>(['help', 'problem', 'idea', 'feedback'])

/** The portal the form was sent from tells us which session to check; the session decides who they are. */
const currentRequester = (formData: FormData): Promise<Requester | null> =>
  resolveRequester(parseHelpAudience(formData.get('audience')))

const SOURCE_BY_AUDIENCE = { CANDIDATE: 'CANDIDATE', EMPLOYER: 'EMPLOYER', COACH: 'COACH', RECRUITER: 'RECRUITER' } as const

/** Stores a problem screenshot in a private bucket, creating the bucket the first time. */
async function storeScreenshot(candidateId: string, file: File): Promise<string | 'too_big' | 'bad_type' | null> {
  if (file.size > HELP_SCREENSHOT_MAX_BYTES) return 'too_big'
  const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as Record<string, string>)[file.type]
  if (!ext) return 'bad_type'
  const admin = createAdminClient()
  const path = `${candidateId}/${crypto.randomUUID()}.${ext}`
  let { error } = await admin.storage.from(HELP_SCREENSHOT_BUCKET).upload(path, file, { contentType: file.type })
  if (error && /not found/i.test(error.message)) {
    await admin.storage.createBucket(HELP_SCREENSHOT_BUCKET, { public: false, fileSizeLimit: HELP_SCREENSHOT_MAX_BYTES })
    ;({ error } = await admin.storage.from(HELP_SCREENSHOT_BUCKET).upload(path, file, { contentType: file.type }))
  }
  if (error) {
    console.error('Help screenshot upload failed:', error)
    return null
  }
  return path
}

// No revalidatePath in these actions: revalidating re-renders the page the
// form was sent from (the whole dashboard, from the corner panel), which made
// sending take seconds. /dashboard/help is dynamic, so it is fresh on every
// visit; when the form is used on that page, it refreshes itself.

/**
 * The Help & feedback form in the candidate, employer and coach portals. Help
 * and problems open a conversation in the admin Help inbox; ideas and
 * feedback become ProductFeedback for Vision → Feedback. A candidate's
 * messages are also noted on their CRM record.
 */
export async function submitHelpForm(_prev: HelpFormState, formData: FormData): Promise<HelpFormState> {
  const profile = await currentRequester(formData)
  if (!profile) return { error: 'Your session ended. Sign in again, then send your message.' }
  const isCandidate = profile.audience === 'CANDIDATE'

  const kindRaw = String(formData.get('kind') ?? '') as HelpFormKind
  const kind: HelpFormKind = KINDS.has(kindRaw) ? kindRaw : 'help'
  const message = String(formData.get('message') ?? '').replace(/\r\n/g, '\n').trim().slice(0, HELP_MESSAGE_MAX)
  const contextPath = String(formData.get('contextPath') ?? '').trim().slice(0, 300) || null
  const contextTitle = String(formData.get('contextTitle') ?? '').trim().slice(0, 200) || null
  if (message.length < 3) return { error: 'Write a few words so we know what this is about.', message }

  const crisis = mentionsCrisis(message)

  if (!isConversationKind(kind)) {
    const fb = await prisma.productFeedback.create({
      data: {
        source: SOURCE_BY_AUDIENCE[profile.audience], rawText: message,
        ...(isCandidate
          ? { candidateId: profile.id }
          : { portalUserId: profile.id, personLabel: [profile.name, profile.orgName].filter(Boolean).join(', ') }),
        channel: kind === 'idea' ? 'in-app idea' : 'in-app feedback', contextPath, receivedAt: new Date(),
      },
    })
    // After the response: the sender shouldn't wait on the CRM.
    if (isCandidate) after(() => logHelpOnCrm(profile.id, kind === 'idea' ? 'Shared an idea' : 'Gave feedback', message, `help-feedback:${fb.id}`))
    captureServerEvent(profile.id, 'product_feedback_submitted', { feedbackId: fb.id, kind, audience: profile.audience, page: contextPath, crisis })
    return { sent: true, kind }
  }

  let screenshotPath: string | null = null
  const file = formData.get('screenshot')
  if (kind === 'problem' && file instanceof File && file.size > 0) {
    const stored = await storeScreenshot(profile.id, file)
    if (stored === 'too_big') return { error: 'That screenshot is over 5 MB. Try a smaller one, or send without it.', message }
    if (stored === 'bad_type') return { error: 'Screenshots need to be PNG, JPG or WebP.', message }
    screenshotPath = stored
  }

  const subject = message.split('\n')[0].slice(0, 90) + (message.split('\n')[0].length > 90 ? '…' : '')
  const userAgent = (await headers()).get('user-agent')?.slice(0, 300) ?? null
  const request = await prisma.helpRequest.create({
    data: {
      candidateId: profile.id, audience: profile.audience,
      requesterName: isCandidate ? null : [profile.name, profile.orgName].filter(Boolean).join(', '),
      requesterEmail: isCandidate ? null : profile.email,
      kind: kind === 'problem' ? 'PROBLEM' : 'HELP', subject,
      contextPath, contextTitle, userAgent, screenshotPath, flaggedCrisis: crisis,
      messages: { create: { body: message } },
    },
  })
  // The CRM note and the email to the admin run after the response, so the
  // candidate sees "Sent" right away.
  after(async () => {
    if (isCandidate) await logHelpOnCrm(profile.id, kind === 'problem' ? `Reported a problem: ${subject}` : `Asked for help: ${subject}`, message, `help:${request.id}`)
    await notifyAdminOfHelp(request.id, message, false)
  })
  captureServerEvent(profile.id, 'help_request_submitted', {
    requestId: request.id, type: kind, audience: profile.audience, page: contextPath, hasScreenshot: !!screenshotPath, crisis,
  })
  return { sent: true, kind, requestId: request.id }
}

/** The requester adds to one of their own conversations. */
export async function replyToHelpRequest(requestId: string, _prev: HelpFormState, formData: FormData): Promise<HelpFormState> {
  const profile = await currentRequester(formData)
  if (!profile) return { error: 'Your session ended. Sign in again, then send your reply.' }
  const message = String(formData.get('message') ?? '').replace(/\r\n/g, '\n').trim().slice(0, HELP_MESSAGE_MAX)
  if (message.length < 1) return { error: 'Write your reply first.' }
  const request = await prisma.helpRequest.findFirst({ where: { id: requestId, candidateId: profile.id, audience: profile.audience }, select: { id: true, flaggedCrisis: true } })
  if (!request) return { error: 'That conversation isn’t available.', message }

  const crisis = mentionsCrisis(message)
  const now = new Date()
  await prisma.helpRequest.update({
    where: { id: requestId },
    data: {
      messages: { create: { body: message } },
      lastMessageAt: now, lastMessageFromAdmin: false, candidateLastReadAt: now,
      // Writing back reopens a resolved conversation.
      status: 'OPEN', resolvedAt: null,
      flaggedCrisis: request.flaggedCrisis || crisis,
    },
  })
  after(() => notifyAdminOfHelp(requestId, message, true))
  captureServerEvent(profile.id, 'help_reply_sent', { requestId, from: profile.audience.toLowerCase(), audience: profile.audience, crisis })
  return { sent: true }
}

/** Clears the "reply waiting" badge for one conversation. */
export async function markHelpRequestRead(requestId: string, audience: HelpAudience = 'CANDIDATE'): Promise<void> {
  const profile = await resolveRequester(parseHelpAudience(audience))
  if (!profile) return
  // No revalidation: refreshing the portal here flashed its loading screen.
  // The badges are recomputed on the next page the candidate opens.
  await prisma.helpRequest.updateMany({ where: { id: requestId, candidateId: profile.id, audience: profile.audience }, data: { candidateLastReadAt: new Date() } })
}
