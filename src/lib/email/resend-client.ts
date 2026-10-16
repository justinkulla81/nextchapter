import { Resend } from 'resend'
import { isValidElement, type ReactNode } from 'react'
import {
  AudienceTag,
  audienceFromContent,
  hasAudienceTag,
  withAudienceHtml,
  withAudienceText,
  type EmailAudience,
} from '@/lib/email/audience-tag'
import { IntakeEmailLayout } from '@/emails/intake-email-layout'

// Reserved by RFC 2606 / 6761: these can never receive mail, so a send is a
// guaranteed hard bounce that costs daily quota and hurts sender reputation.
// Seeded sample users (test-candidate-NN@nextchapter.test, scratch-*@...) live
// in the production database, so every dispatcher would otherwise mail them.
const RESERVED_TLDS = ['test', 'invalid', 'example', 'localhost']
const RESERVED_DOMAINS = ['example.com', 'example.org', 'example.net']

/** True for addresses that can never be delivered (reserved TLDs / example domains). */
export function isUndeliverableAddress(address: string): boolean {
  const match = address.match(/<([^>]+)>\s*$/)
  const email = (match ? match[1] : address).trim().toLowerCase()
  const domain = email.split('@')[1]
  if (!domain) return false
  if (RESERVED_DOMAINS.includes(domain)) return true
  return RESERVED_TLDS.includes(domain.split('.').pop() ?? '')
}

/** The audience a React email template declares: its AudienceTag, or the intake layout's audience prop. */
function audienceFromReact(node: ReactNode, depth = 0): EmailAudience | null {
  if (depth > 40 || node == null || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = audienceFromReact(child, depth + 1)
      if (found) return found
    }
    return null
  }
  if (!isValidElement(node)) return null
  const props = node.props as { audience?: EmailAudience; children?: ReactNode }
  if (node.type === AudienceTag) return props.audience ?? null
  if (node.type === IntakeEmailLayout) return props.audience ?? 'candidate'
  return audienceFromReact(props.children, depth + 1)
}

/**
 * Resend client whose `emails.send` silently drops undeliverable recipients.
 * A send with no deliverable recipient left is skipped and reported as a
 * success, so callers don't log it as a failure or retry it.
 *
 * Pass `audience` for emails built as HTML or text strings: every such email
 * then ends with the same small "NextChapter · Coach" line the React templates
 * carry (see audience-tag.tsx). A string email sent without one is logged so a
 * new sender can't quietly ship unmarked.
 *
 * Every send also gets an `X-NextChapter-Audience` header (candidate, coach, …),
 * read from the audience argument, the template's own AudienceTag, or the tag in
 * a string body, so inbox filters and logs can sort mail by audience.
 */
export function createResend(apiKey?: string, audience?: EmailAudience): Resend {
  const client = new Resend(apiKey)
  const emails = client.emails
  const send = emails.send.bind(emails)

  emails.send = (async (inputPayload, options) => {
    let payload = inputPayload
    const declared =
      audience ??
      (payload.react ? audienceFromReact(payload.react as ReactNode) : null) ??
      (typeof payload.html === 'string' ? audienceFromContent(payload.html) : null) ??
      (typeof payload.text === 'string' ? audienceFromContent(payload.text) : null)
    if (audience) {
      if (typeof payload.html === 'string') payload = { ...payload, html: withAudienceHtml(audience, payload.html) }
      if (typeof payload.text === 'string') payload = { ...payload, text: withAudienceText(audience, payload.text) }
    } else if (
      (typeof payload.html === 'string' && !hasAudienceTag(payload.html)) ||
      (typeof payload.html !== 'string' && typeof payload.text === 'string' && !hasAudienceTag(payload.text))
    ) {
      console.warn(`Email "${String(payload.subject).slice(0, 60)}" has no audience tag; pass an audience to createResend.`)
    }
    if (declared) payload = { ...payload, headers: { ...payload.headers, 'X-NextChapter-Audience': declared } }
    else if (payload.react) console.warn(`Email "${String(payload.subject).slice(0, 60)}" renders no AudienceTag.`)
    const original = (Array.isArray(payload.to) ? payload.to : [payload.to]).filter(
      (to): to is string => typeof to === 'string',
    )
    const deliverable = original.filter((to) => !isUndeliverableAddress(to))
    if (deliverable.length === original.length) return send(payload, options)
    if (deliverable.length === 0) {
      return { data: { id: 'skipped-undeliverable-recipient' }, error: null, headers: null }
    }
    return send({ ...payload, to: deliverable }, options)
  }) as typeof emails.send

  return client
}
