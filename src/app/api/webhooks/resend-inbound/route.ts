import { NextResponse, after } from 'next/server'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { INTAKE_FORWARD_DOMAIN, INTAKE_MAX_FILE_BYTES } from '@/lib/recruiter/intake/constants'
import { resolveForwardLocalPart, splitAddress } from '@/lib/recruiter/intake/slug'
import { ingestIntake, intakeFileType, processIntakeResume } from '@/lib/recruiter/intake/pipeline'

// NextChapter Talent forwarding addresses (spec F3): Resend inbound on
// INTAKE_FORWARD_DOMAIN posts `email.received` here. One forwarded email can
// carry several resumes; each becomes its own intake. Webhook retries are
// idempotent on the provider email id.

export const maxDuration = 120

const MAX_ATTACHMENTS = 5

// A manual forward puts the original sender in the body
// ("From: Ana Diaz <ana@example.com>"); an auto-forward keeps them in From.
function forwardedSender(text: string | null): { name: string | null; email: string | null } {
  if (!text) return { name: null, email: null }
  const match = text.match(/^\s*>?\s*From:\s*(?:"?([^"<\n]+?)"?\s*)?<?([^\s<>@]+@[^\s<>]+)>?/im)
  return match ? { name: match[1]?.trim() || null, email: match[2].toLowerCase() } : { name: null, email: null }
}

function displayName(from: string): string | null {
  const match = from.match(/^\s*"?([^"<]+?)"?\s*</)
  return match ? match[1].trim() : null
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET
  const apiKey = process.env.RESEND_API_KEY
  if (!secret || !apiKey) return NextResponse.json({ error: 'not configured' }, { status: 503 })

  const payload = await request.text()
  const resend = new Resend(apiKey)
  let event
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: request.headers.get('svix-id') ?? '',
        timestamp: request.headers.get('svix-timestamp') ?? '',
        signature: request.headers.get('svix-signature') ?? '',
      },
      webhookSecret: secret,
    })
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }
  if (event.type !== 'email.received') return NextResponse.json({ ignored: event.type })

  const data = event.data
  const recipients = [...(data.received_for ?? []), ...(data.to ?? [])]
  const target = recipients.map(splitAddress).find((a) => a && a.domain === INTAKE_FORWARD_DOMAIN)

  // Claim the email id first: a webhook retry that races this one hits the
  // unique constraint and stops, so nothing is ingested twice.
  try {
    await prisma.intakeInboundEmail.create({
      data: {
        providerEmailId: data.email_id,
        toAddress: target ? `${target.local}@${target.domain}` : recipients.join(', ').slice(0, 300),
        fromAddress: data.from,
        subject: data.subject?.slice(0, 300) ?? null,
        status: 'received',
        attachmentCount: data.attachments?.length ?? 0,
      },
    })
  } catch {
    return NextResponse.json({ duplicate: true })
  }
  const log = (status: string, extra: { firmId?: string; recruiterId?: string | null } = {}) =>
    prisma.intakeInboundEmail
      .update({
        where: { providerEmailId: data.email_id },
        data: { status, firmId: extra.firmId ?? null, recruiterId: extra.recruiterId ?? null },
      })
      .catch(() => {})

  if (!target) {
    await log('unknown_address')
    return NextResponse.json({ ok: true })
  }

  const firms = await prisma.recruiterFirm.findMany({
    where: { slug: { not: null }, status: 'VERIFIED' },
    select: { slug: true, recruiters: { where: { intakeSlug: { not: null }, firmRole: { in: ['ADMIN', 'RECRUITER'] } }, select: { intakeSlug: true } } },
  })
  const resolved = resolveForwardLocalPart(
    target.local,
    firms.map((f) => ({ slug: f.slug!, recruiterSlugs: f.recruiters.map((r) => r.intakeSlug!) }))
  )
  if (!resolved) {
    await log('unknown_address')
    return NextResponse.json({ ok: true })
  }
  const firm = await prisma.recruiterFirm.findUniqueOrThrow({ where: { slug: resolved.firmSlug } })
  const recruiter = resolved.recruiterSlug
    ? await prisma.recruiter.findFirst({ where: { recruiterFirmId: firm.id, intakeSlug: resolved.recruiterSlug } })
    : null

  // Process after acknowledging so Resend doesn't time out and retry.
  after(async () => {
    try {
      const fromAddress = splitAddress(data.from)
      const fromEmail = fromAddress ? `${fromAddress.local}@${fromAddress.domain}` : null
      const firmEmails = await prisma.recruiter.findMany({ where: { recruiterFirmId: firm.id }, select: { workEmail: true } })
      const fromRecruiter = !!fromEmail && firmEmails.some((r) => r.workEmail.toLowerCase() === fromEmail)

      const received = await resend.emails.receiving.get(data.email_id)
      const bodyText = received.data?.text ?? null
      const forwarded = fromRecruiter ? forwardedSender(bodyText) : { name: displayName(data.from), email: fromEmail }

      const list = await resend.emails.receiving.attachments.list({ emailId: data.email_id })
      const resumes = (list.data?.data ?? [])
        .filter((a) => a.filename && intakeFileType(a.filename) && a.size <= INTAKE_MAX_FILE_BYTES)
        .slice(0, MAX_ATTACHMENTS)
      if (resumes.length === 0) {
        await log('no_resume_attachment', { firmId: firm.id, recruiterId: recruiter?.id })
        return
      }

      const exclude = [...firmEmails.map((r) => r.workEmail), `${target.local}@${target.domain}`]
      let ingested = 0
      for (const attachment of resumes) {
        const response = await fetch(attachment.download_url)
        if (!response.ok) continue
        const buffer = Buffer.from(await response.arrayBuffer())
        const result = await ingestIntake({
          firm,
          recruiter,
          source: 'FORWARD',
          entryPoint: recruiter ? 'PERSONAL_ADDRESS' : 'FIRM_ADDRESS',
          // With several resumes in one email the sender can't be all of
          // them: let each resume's own text supply the email.
          person: resumes.length === 1 ? { fullName: forwarded.name, email: forwarded.email } : {},
          file: { buffer, fileName: attachment.filename!, contentType: attachment.content_type },
          consentScopes: [],
          excludeEmails: exclude.concat(fromRecruiter && fromEmail ? [fromEmail] : []),
        })
        if (!result.ok) continue
        ingested++
        await processIntakeResume(result.resumeId).catch((error) => console.error('Talent intake processing failed:', error))
      }
      await log(ingested > 0 ? 'ingested' : 'no_candidate_email', { firmId: firm.id, recruiterId: recruiter?.id })
      captureServerEvent(recruiter?.id ?? firm.id, 'talent_forward_received', {
        firmId: firm.id,
        recruiterId: recruiter?.id ?? null,
        attachments: resumes.length,
        ingested,
        manualForward: fromRecruiter,
      })
    } catch (error) {
      console.error('Talent inbound email failed:', error)
      await log('error', { firmId: firm.id, recruiterId: recruiter?.id })
    }
  })

  return NextResponse.json({ ok: true })
}
