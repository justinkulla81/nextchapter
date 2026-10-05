import 'server-only'
import type { IntakeEntryPoint, IntakeSource, Prisma, Recruiter, RecruiterFirm } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractResumeText } from '@/lib/resume/extract-text'
import { captureServerEvent } from '@/lib/posthog/server'
import { sendIntakeFitAlert, sendIntakeSubmissionConfirmation } from '@/lib/email/send-intake'
import { INTAKE_PURGE_DAYS, isIntakeConsentScope } from './constants'
import { normalizeLinkedinUrl } from './slug'
import { parseIntakeResumeText, reserveParseSlot, toPrescanInput, type IntakeResumeFields } from './parse'
import { describeResume, prescanResume, type PrescanSearch, type PrescanSpecialty } from './prescan'
import { suggestRecruiter } from './routing'
import { defaultSubject, firstNameOf, pickReplyTemplate, renderReplyTemplate } from './reply-templates'

// NextChapter Talent intake pipeline (spec F2–F4, F3a). Every way in — the
// Inbound page, the "not a fit now" link, a forwarded email — goes through
// ingestIntake(); parsing/tagging/routing runs in processIntakeResume(),
// either right away or from the daily cron when the firm is over its cap.

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i

export function firstEmailIn(text: string | null | undefined, exclude: string[] = []): string | null {
  if (!text) return null
  const skip = new Set(exclude.map((e) => e.toLowerCase()))
  for (const match of text.matchAll(new RegExp(EMAIL_PATTERN, 'gi'))) {
    const email = match[0].toLowerCase()
    if (!skip.has(email) && !email.endsWith('.png') && !email.endsWith('.jpg')) return email
  }
  return null
}

export type IntakeFileInput = { buffer: Buffer; fileName: string; contentType: string | null }

export type IngestResult =
  | { ok: true; connectionId: string; intakeCandidateId: string; claimToken: string; resumeId: string }
  | { ok: false; reason: 'bad_file' | 'no_email' | 'disconnected' | 'upload_failed'; message: string }

export function intakeFileType(fileName: string): 'pdf' | 'docx' | null {
  const ext = fileName.split('.').pop()?.toLowerCase()
  return ext === 'pdf' || ext === 'docx' ? ext : null
}

export async function ingestIntake({
  firm,
  recruiter,
  source,
  entryPoint,
  person,
  file,
  consentScopes,
  ip,
  excludeEmails = [],
}: {
  firm: RecruiterFirm
  recruiter: Recruiter | null
  source: IntakeSource
  entryPoint: IntakeEntryPoint
  person: { fullName?: string | null; email?: string | null; linkedinUrl?: string | null; note?: string | null }
  file: IntakeFileInput
  consentScopes: string[]
  ip?: string | null
  // Addresses that must never be taken as the candidate's (the recruiter's
  // own address on a manual forward, our forwarding address).
  excludeEmails?: string[]
}): Promise<IngestResult> {
  const fileType = intakeFileType(file.fileName)
  if (!fileType) return { ok: false, reason: 'bad_file', message: 'Please upload a PDF or Word (.docx) file.' }

  const asFile = new File([new Uint8Array(file.buffer)], file.fileName, { type: file.contentType ?? undefined })
  const { text } = await extractResumeText(asFile, fileType)

  const email = (person.email?.trim().toLowerCase() || firstEmailIn(text, excludeEmails)) ?? null
  if (!email) {
    return { ok: false, reason: 'no_email', message: 'No email address found for this candidate.' }
  }

  const fullName = person.fullName?.trim() || file.fileName.replace(/\.(pdf|docx)$/i, '').replace(/[_-]+/g, ' ').trim()
  const linkedinUrl = normalizeLinkedinUrl(person.linkedinUrl)

  const existing = await prisma.intakeCandidate.findUnique({ where: { email } })
  // A person who disconnected from this firm stays disconnected unless they
  // come back themselves through the firm's page.
  if (existing && source === 'FORWARD') {
    const priorConnection = await prisma.intakeConnection.findUnique({
      where: { firmId_intakeCandidateId: { firmId: firm.id, intakeCandidateId: existing.id } },
    })
    if (priorConnection?.disconnectedAt) {
      return { ok: false, reason: 'disconnected', message: 'This candidate has disconnected from your firm.' }
    }
  }

  const intakeCandidate = existing
    ? await prisma.intakeCandidate.update({
        where: { id: existing.id },
        data: {
          // A self-submitted name/LinkedIn wins over what a forward guessed.
          ...(person.fullName?.trim() ? { fullName } : {}),
          ...(linkedinUrl ? { linkedinUrl } : {}),
        },
      })
    : await prisma.intakeCandidate.create({
        data: {
          email,
          fullName,
          linkedinUrl,
          purgeAt: new Date(Date.now() + INTAKE_PURGE_DAYS * 86_400_000),
        },
      })

  // Same LinkedIn under a different email: flag for the recruiter, never merge.
  const possibleDuplicate = linkedinUrl
    ? await prisma.intakeCandidate.findFirst({
        where: { linkedinUrl, id: { not: intakeCandidate.id } },
        select: { id: true },
      })
    : null

  const admin = createAdminClient()
  const filePath = `intake/${firm.id}/${crypto.randomUUID()}.${fileType}`
  const { error: uploadError } = await admin.storage
    .from('resumes')
    .upload(filePath, file.buffer, { contentType: file.contentType ?? undefined })
  if (uploadError) {
    console.error('Talent intake upload failed:', uploadError)
    return { ok: false, reason: 'upload_failed', message: 'Something went wrong saving the resume. Please try again.' }
  }

  const scopes = consentScopes.filter(isIntakeConsentScope)
  const assignment: Prisma.IntakeConnectionUncheckedUpdateInput = recruiter
    ? { recruiterId: recruiter.id, assignedById: 'system', assignedAt: new Date() }
    : {}

  const connection = await prisma.intakeConnection.upsert({
    where: { firmId_intakeCandidateId: { firmId: firm.id, intakeCandidateId: intakeCandidate.id } },
    create: {
      firmId: firm.id,
      intakeCandidateId: intakeCandidate.id,
      source,
      entryPoint,
      consentScopes: scopes,
      candidateNote: person.note?.trim() || null,
      possibleDuplicateOfId: possibleDuplicate?.id ?? null,
      ...(recruiter ? { recruiterId: recruiter.id, assignedById: 'system', assignedAt: new Date() } : {}),
    },
    update: {
      // A fresh submission re-opens a disconnected connection (the candidate
      // came back themselves — forwards were refused above).
      disconnectedAt: null,
      source,
      entryPoint,
      ...(scopes.length > 0 ? { consentScopes: scopes } : {}),
      ...(person.note?.trim() ? { candidateNote: person.note.trim() } : {}),
      ...assignment,
    },
  })

  if (scopes.length > 0) {
    await prisma.intakeConsentEvent.createMany({
      data: scopes.map((scope) => ({
        connectionId: connection.id,
        intakeCandidateId: intakeCandidate.id,
        firmId: firm.id,
        scope,
        granted: true,
        ip: ip ?? null,
      })),
    })
  }

  if (recruiter) {
    await prisma.recruiter.update({ where: { id: recruiter.id }, data: { lastIntakeAssignedAt: new Date() } })
  }

  const resume = await prisma.intakeResume.create({
    data: {
      intakeCandidateId: intakeCandidate.id,
      firmId: firm.id,
      filePath,
      fileName: file.fileName,
      fileType,
      extractedText: text,
    },
  })

  captureServerEvent(intakeCandidate.id, 'talent_intake_received', {
    firmId: firm.id,
    recruiterId: recruiter?.id ?? null,
    connectionId: connection.id,
    source,
    entryPoint,
    isNewPerson: !existing,
    consentScopeCount: scopes.length,
    possibleDuplicate: !!possibleDuplicate,
  })

  return { ok: true, connectionId: connection.id, intakeCandidateId: intakeCandidate.id, claimToken: intakeCandidate.claimToken, resumeId: resume.id }
}

// Candidate-initiated submissions get an immediate confirmation with their
// claim link (transactional: they asked for it). Forwarded resumes get no
// email until the recruiter approves a reply, which carries the claim link.
export async function sendSubmissionConfirmation(connectionId: string) {
  const connection = await prisma.intakeConnection.findUnique({
    where: { id: connectionId },
    include: { firm: true, recruiter: true, intakeCandidate: true },
  })
  if (!connection || connection.intakeCandidate.emailOptedOutAt) return
  const { intakeCandidate, firm, recruiter } = connection
  const result = await sendIntakeSubmissionConfirmation({
    to: intakeCandidate.email,
    firstName: firstNameOf(intakeCandidate.fullName),
    firmName: firm.name,
    recruiterName: recruiter?.fullName ?? null,
    recruiterEmail: recruiter?.workEmail ?? null,
    claimToken: intakeCandidate.claimToken,
    connectionId,
  })
  if (result.sent) {
    await prisma.intakeCandidate.update({
      where: { id: intakeCandidate.id },
      data: { claimInvitesSent: { increment: 1 }, lastClaimInviteAt: new Date() },
    })
  }
}

async function loadRoutingContext(firmId: string) {
  return prisma.recruiter.findMany({
    where: { recruiterFirmId: firmId, firmRole: { in: ['ADMIN', 'RECRUITER'] } },
    include: {
      intakeSpecialties: { include: { specialty: true } },
      intakeSearches: { where: { status: 'OPEN' } },
    },
  })
}

type RoutingRecruiter = Awaited<ReturnType<typeof loadRoutingContext>>[number]

function specialtiesOf(recruiter: RoutingRecruiter): PrescanSpecialty[] {
  return recruiter.intakeSpecialties.map((s) => ({ type: s.specialty.type, name: s.specialty.name, weight: s.weight }))
}

function searchesOf(recruiter: RoutingRecruiter): PrescanSearch[] {
  return recruiter.intakeSearches.map((s) => ({
    id: s.id,
    title: s.title,
    functions: s.functions,
    levels: s.levels,
    mustHaves: s.mustHaves,
    location: s.location,
  }))
}

// Parses (within the firm's daily cap), tags, routes and drafts the reply.
// Returns 'queued' when the cap is hit; the cron picks it up tomorrow.
export async function processIntakeResume(resumeId: string): Promise<'done' | 'queued' | 'skipped'> {
  const resume = await prisma.intakeResume.findUnique({
    where: { id: resumeId },
    include: { firm: true, intakeCandidate: true },
  })
  if (!resume || resume.parseStatus !== 'QUEUED') return 'skipped'

  const connection = await prisma.intakeConnection.findUnique({
    where: { firmId_intakeCandidateId: { firmId: resume.firmId, intakeCandidateId: resume.intakeCandidateId } },
  })
  if (!connection || connection.disconnectedAt) return 'skipped'

  if (!resume.extractedText || resume.extractedText.trim().length < 40) {
    await prisma.intakeResume.update({
      where: { id: resume.id },
      data: { parseStatus: 'FAILED', parseError: 'No readable text (scanned image or empty file).' },
    })
    await prisma.intakeConnection.update({
      where: { id: connection.id },
      data: { tagReasons: ['Could not read this file; open it to review by hand'] },
    })
    return 'done'
  }

  if (!(await reserveParseSlot(resume.firmId, resume.firm.intakeDailyParseCap))) {
    captureServerEvent(resume.firmId, 'talent_intake_parse_capped', { firmId: resume.firmId, resumeId })
    return 'queued'
  }

  let fields: IntakeResumeFields | null = null
  try {
    fields = await parseIntakeResumeText(resume.extractedText)
  } catch (error) {
    console.error('Talent intake parse failed:', error)
  }
  if (!fields) {
    await prisma.intakeResume.update({ where: { id: resume.id }, data: { parseStatus: 'FAILED', parseError: 'Parse failed' } })
    return 'done'
  }
  if (!fields.isResume) {
    await prisma.intakeResume.update({
      where: { id: resume.id },
      data: { parseStatus: 'NOT_A_RESUME', parsedJson: fields, parsedAt: new Date() },
    })
    await prisma.intakeConnection.update({
      where: { id: connection.id },
      data: { tagReasons: ['This file does not look like a resume; open it to review by hand'] },
    })
    return 'done'
  }

  await prisma.intakeResume.update({
    where: { id: resume.id },
    data: { parseStatus: 'PARSED', parsedJson: fields, parsedAt: new Date() },
  })
  await prisma.intakeCandidate.update({
    where: { id: resume.intakeCandidateId },
    data: {
      phone: resume.intakeCandidate.phone ?? fields.phone,
      location: resume.intakeCandidate.location ?? fields.location,
      linkedinUrl: resume.intakeCandidate.linkedinUrl ?? normalizeLinkedinUrl(fields.linkedinUrl),
      // A forward only had the file name to go on.
      ...(connection.source === 'FORWARD' && fields.fullName ? { fullName: fields.fullName } : {}),
    },
  })

  const parsed = toPrescanInput(fields)
  const recruiters = await loadRoutingContext(resume.firmId)

  // Routing (F3a): only firm-level entries without an assigned recruiter.
  let recruiterId = connection.recruiterId
  let suggestedRecruiterId: string | null = null
  if (!recruiterId) {
    const suggestion = suggestRecruiter({
      resume: parsed,
      recruiters: recruiters.map((r) => ({
        id: r.id,
        name: r.fullName,
        specialties: specialtiesOf(r),
        searches: searchesOf(r),
        lastIntakeAssignedAt: r.lastIntakeAssignedAt,
      })),
      mode: resume.firm.intakeRoutingMode,
      resumeLine: describeResume(parsed),
    })
    if (suggestion) {
      const assignNow = resume.firm.intakeRoutingMode !== 'SUGGEST'
      if (assignNow) recruiterId = suggestion.recruiterId
      else suggestedRecruiterId = suggestion.recruiterId
      await prisma.intakeRoutingDecision.create({
        data: {
          connectionId: connection.id,
          mode: resume.firm.intakeRoutingMode,
          suggestedRecruiterId: suggestion.recruiterId,
          assignedRecruiterId: assignNow ? suggestion.recruiterId : null,
          reasons: [suggestion.summary],
          decidedBy: 'system',
        },
      })
      if (assignNow) {
        await prisma.recruiter.update({ where: { id: suggestion.recruiterId }, data: { lastIntakeAssignedAt: new Date() } })
      }
    } else {
      await prisma.intakeRoutingDecision.create({
        data: {
          connectionId: connection.id,
          mode: resume.firm.intakeRoutingMode,
          reasons: ['No recruiter specialty or open search matched; left in the general hopper'],
          decidedBy: 'system',
        },
      })
    }
  }

  // Tag against the assigned recruiter's criteria, or the whole firm's
  // while it sits in the general hopper.
  const owner = recruiters.find((r) => r.id === recruiterId) ?? null
  const scope = owner ? [owner] : recruiters
  const result = prescanResume({
    resume: parsed,
    specialties: scope.flatMap(specialtiesOf),
    searches: scope.flatMap(searchesOf),
    minLevel: resume.firm.intakeMinLevel,
    notFitLink: connection.source === 'NOT_FIT_LINK',
  })

  const updated = await prisma.intakeConnection.update({
    where: { id: connection.id },
    data: {
      tag: connection.tagOverridden ? connection.tag : result.tag,
      tagReasons: connection.tagOverridden ? connection.tagReasons : result.reasons,
      searchId: connection.tagOverridden ? connection.searchId : result.searchId,
      partialSearchMatch: result.partialSearchMatch,
      summary: fields.summary.join('\n'),
      ...(recruiterId && recruiterId !== connection.recruiterId
        ? { recruiterId, assignedById: 'system', assignedAt: new Date() }
        : {}),
      ...(suggestedRecruiterId ? { suggestedRecruiterId } : {}),
    },
    include: { search: true, recruiter: true, intakeCandidate: true },
  })

  captureServerEvent(resume.intakeCandidateId, 'talent_intake_tagged', {
    firmId: resume.firmId,
    connectionId: connection.id,
    tag: updated.tag,
    partialSearchMatch: result.partialSearchMatch,
    routed: !!recruiterId && !connection.recruiterId,
    suggested: !!suggestedRecruiterId,
  })

  if (updated.tag === 'NICHE' || updated.tag === 'OUTSIDE') {
    await draftReply(updated.id)
  }
  if (updated.tag === 'FIT' && updated.recruiter && updated.search) {
    await sendIntakeFitAlert({
      to: updated.recruiter.workEmail,
      recruiterId: updated.recruiter.id,
      recruiterFirstName: firstNameOf(updated.recruiter.fullName),
      candidateName: updated.intakeCandidate.fullName,
      searchTitle: updated.search.title,
      summary: fields.summary,
      reasons: updated.tagReasons,
      connectionId: updated.id,
    })
    captureServerEvent(updated.recruiter.id, 'talent_fit_alert_sent', {
      recruiterId: updated.recruiter.id,
      connectionId: updated.id,
      searchId: updated.search.id,
    })
  }
  return 'done'
}

// One live draft per connection. Outside replies only ever go to people who
// match none of the open searches (prescan never tags a partial match
// Outside); every reply waits for a recruiter's approval.
export async function draftReply(connectionId: string) {
  const connection = await prisma.intakeConnection.findUnique({
    where: { id: connectionId },
    include: { firm: true, recruiter: true, intakeCandidate: true, replies: true },
  })
  if (!connection || (connection.tag !== 'NICHE' && connection.tag !== 'OUTSIDE')) return
  if (connection.intakeCandidate.emailOptedOutAt) return
  const kind = connection.tag
  if (connection.replies.some((r) => r.status === 'SENT' || r.status === 'APPROVED')) return

  const liveDraft = connection.replies.find((r) => r.status === 'DRAFT')
  const recruiterName = connection.recruiter?.fullName ?? `The ${connection.firm.name} team`
  const body = renderReplyTemplate(pickReplyTemplate(kind, connection.firm, connection.recruiter), {
    firstName: firstNameOf(connection.intakeCandidate.fullName),
    recruiterName,
    firmName: connection.firm.name,
  })
  const subject = defaultSubject(kind, connection.firm.name)

  if (liveDraft) {
    // Re-tagged: refresh an untouched draft to the new kind.
    if (liveDraft.kind !== kind) {
      await prisma.intakeReply.update({ where: { id: liveDraft.id }, data: { kind, subject, body } })
    }
    return
  }
  await prisma.intakeReply.create({ data: { connectionId, kind, subject, body } })
}
