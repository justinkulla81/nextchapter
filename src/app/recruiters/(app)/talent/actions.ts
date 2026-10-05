'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { IntakeRoutingMode, IntakeSpecialtyType, IntakeTag, RecruiterFirmRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendRecruiterFirmInvite } from '@/lib/email/send-intake'
import { canAssign, canManageFirm, findVisibleConnection, getTalentContext, visibleConnectionsWhere } from '@/lib/recruiter/intake/access'
import { INTAKE_LEVELS } from '@/lib/recruiter/intake/constants'
import { slugify, validateSlug } from '@/lib/recruiter/intake/slug'
import { draftReply } from '@/lib/recruiter/intake/pipeline'
import { sendApprovedReply } from '@/lib/recruiter/intake/replies'

export type TalentFormState = { error?: string; success?: string } | undefined

const str = (formData: FormData, key: string) => ((formData.get(key) as string | null) ?? '').trim()
const list = (value: string) =>
  value
    .split(/[,\n]/)
    .map((v) => v.trim())
    .filter(Boolean)

// ── Firm setup ──────────────────────────────────────────────────────────────

// An independent recruiter or a firm's first admin creates the firm. It
// starts PENDING; Inbound pages go live once NextChapter verifies it.
export async function createTalentFirm(_prev: TalentFormState, formData: FormData): Promise<TalentFormState> {
  const ctx = await getTalentContext()
  if (ctx.firm) return { error: 'You already belong to a firm.' }

  const name = str(formData, 'name')
  const slug = slugify(str(formData, 'slug') || name)
  if (!name) return { error: 'Enter your firm name.' }
  const slugError = validateSlug(slug, { firm: true })
  if (slugError) return { error: `Page address: ${slugError}` }
  if (await prisma.recruiterFirm.findUnique({ where: { slug } })) {
    return { error: 'That page address is taken. Try another.' }
  }

  // An admin may already have created this firm by name (Phase 3 admin
  // tooling). Joining it as admin would hand over someone else's firm, so
  // only claim it when it has no members yet.
  const byName = await prisma.recruiterFirm.findUnique({ where: { name }, include: { recruiters: { select: { id: true } } } })
  if (byName && byName.recruiters.length > 0) {
    return { error: 'A firm with that name is already on NextChapter. Ask its admin to invite you.' }
  }

  const firm = byName
    ? await prisma.recruiterFirm.update({ where: { id: byName.id }, data: { slug } })
    : await prisma.recruiterFirm.create({ data: { name, slug } })

  const recruiterSlug = slugify(ctx.recruiter.fullName) || 'me'
  await prisma.recruiter.update({
    where: { id: ctx.recruiter.id },
    data: { recruiterFirmId: firm.id, firmRole: 'ADMIN', firmName: name, intakeSlug: recruiterSlug },
  })

  captureServerEvent(ctx.recruiter.id, 'talent_firm_created', { recruiterId: ctx.recruiter.id, firmId: firm.id, claimedExisting: !!byName })
  revalidatePath('/recruiters/talent')
  redirect('/recruiters/talent/setup')
}

export async function updateFirmSettings(_prev: TalentFormState, formData: FormData): Promise<TalentFormState> {
  const ctx = await getTalentContext()
  if (!canManageFirm(ctx) || !ctx.firm) return { error: 'Only a firm admin can change firm settings.' }

  const slug = slugify(str(formData, 'slug'))
  const slugError = validateSlug(slug, { firm: true })
  if (slugError) return { error: `Page address: ${slugError}` }
  if (slug !== ctx.firm.slug && (await prisma.recruiterFirm.findUnique({ where: { slug } }))) {
    return { error: 'That page address is taken. Try another.' }
  }

  const mode = str(formData, 'routingMode') as IntakeRoutingMode
  if (!['AUTO', 'SUGGEST', 'ROUND_ROBIN'].includes(mode)) return { error: 'Pick a routing mode.' }
  const minLevel = str(formData, 'minLevel')
  if (minLevel && !(INTAKE_LEVELS as readonly string[]).includes(minLevel)) return { error: 'Pick a level.' }
  const accent = str(formData, 'accentColor')
  if (accent && !/^#[0-9a-f]{6}$/i.test(accent)) return { error: 'Accent color must look like #1d4e89.' }

  await prisma.recruiterFirm.update({
    where: { id: ctx.firm.id },
    data: {
      slug,
      accentColor: accent || null,
      intakeRoutingMode: mode,
      intakeMinLevel: minLevel || null,
      intakeAdminSeesAll: formData.get('adminSeesAll') === 'on',
      intakeRecruitersCanEditTemplates: formData.get('recruitersCanEditTemplates') === 'on',
      intakeNicheReplyTemplate: str(formData, 'nicheTemplate') || null,
      intakeOutsideReplyTemplate: str(formData, 'outsideTemplate') || null,
    },
  })
  captureServerEvent(ctx.recruiter.id, 'talent_firm_settings_saved', { firmId: ctx.firm.id, routingMode: mode, minLevel: minLevel || null })
  revalidatePath('/recruiters/talent/setup')
  return { success: 'Firm settings saved.' }
}

export async function addFirmSpecialty(_prev: TalentFormState, formData: FormData): Promise<TalentFormState> {
  const ctx = await getTalentContext()
  if (!canManageFirm(ctx) || !ctx.firm) return { error: 'Only a firm admin can edit the specialty list.' }
  const type = str(formData, 'type') as IntakeSpecialtyType
  if (!['FUNCTION', 'INDUSTRY', 'LEVEL', 'GEO', 'TAG'].includes(type)) return { error: 'Pick a type.' }
  const names = list(str(formData, 'names'))
  if (names.length === 0) return { error: 'Enter at least one name.' }
  await prisma.intakeSpecialty.createMany({
    data: names.map((name) => ({ firmId: ctx.firm!.id, type, name })),
    skipDuplicates: true,
  })
  captureServerEvent(ctx.recruiter.id, 'talent_specialties_added', { firmId: ctx.firm.id, type, count: names.length })
  revalidatePath('/recruiters/talent/setup')
  return { success: `Added ${names.length}.` }
}

export async function removeFirmSpecialty(specialtyId: string) {
  const ctx = await getTalentContext()
  if (!canManageFirm(ctx) || !ctx.firm) return
  await prisma.intakeSpecialty.deleteMany({ where: { id: specialtyId, firmId: ctx.firm.id } })
  captureServerEvent(ctx.recruiter.id, 'talent_specialty_removed', { firmId: ctx.firm.id, specialtyId })
  revalidatePath('/recruiters/talent/setup')
}

export async function inviteRecruiterToFirm(_prev: TalentFormState, formData: FormData): Promise<TalentFormState> {
  const ctx = await getTalentContext()
  if (!canManageFirm(ctx) || !ctx.firm) return { error: 'Only a firm admin can invite people.' }
  const email = str(formData, 'email').toLowerCase()
  const role = str(formData, 'role') as RecruiterFirmRole
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email.' }
  if (!['ADMIN', 'RECRUITER', 'COORDINATOR'].includes(role)) return { error: 'Pick a role.' }

  const existingRecruiter = await prisma.recruiter.findUnique({ where: { workEmail: email } })
  if (existingRecruiter?.recruiterFirmId && existingRecruiter.firmRole) {
    return { error: existingRecruiter.recruiterFirmId === ctx.firm.id ? 'They are already on your team.' : 'They already belong to another firm on NextChapter.' }
  }

  const invite = await prisma.recruiterFirmInvite.upsert({
    where: { firmId_email: { firmId: ctx.firm.id, email } },
    create: { firmId: ctx.firm.id, email, role, invitedById: ctx.recruiter.id },
    update: { role, acceptedAt: null },
  })

  // Already has a recruiter login: join them now; the email just tells them.
  if (existingRecruiter) {
    await prisma.recruiter.update({
      where: { id: existingRecruiter.id },
      data: {
        recruiterFirmId: ctx.firm.id,
        firmRole: role,
        firmName: ctx.firm.name,
        intakeSlug: existingRecruiter.intakeSlug ?? (slugify(existingRecruiter.fullName) || null),
      },
    })
    await prisma.recruiterFirmInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } })
  }

  const sent = await sendRecruiterFirmInvite({ to: email, firmName: ctx.firm.name, inviterName: ctx.recruiter.fullName, token: invite.token })
  captureServerEvent(ctx.recruiter.id, 'talent_recruiter_invited', { firmId: ctx.firm.id, role, joinedImmediately: !!existingRecruiter, emailSent: sent.sent })
  revalidatePath('/recruiters/talent/setup')
  return { success: existingRecruiter ? `${email} joined your team.` : `Invite sent to ${email}.` }
}

export async function changeMemberRole(recruiterId: string, role: RecruiterFirmRole) {
  const ctx = await getTalentContext()
  if (!canManageFirm(ctx) || !ctx.firm) return
  if (recruiterId === ctx.recruiter.id) return // never demote yourself out of admin
  await prisma.recruiter.updateMany({ where: { id: recruiterId, recruiterFirmId: ctx.firm.id }, data: { firmRole: role } })
  captureServerEvent(ctx.recruiter.id, 'talent_member_role_changed', { firmId: ctx.firm.id, recruiterId, role })
  revalidatePath('/recruiters/talent/setup')
}

// ── Recruiter's own setup ───────────────────────────────────────────────────

export async function updateMyTalentProfile(_prev: TalentFormState, formData: FormData): Promise<TalentFormState> {
  const ctx = await getTalentContext()
  if (!ctx.firm) return { error: 'Set up your firm first.' }

  const slug = slugify(str(formData, 'intakeSlug'))
  const slugError = validateSlug(slug, { firm: false })
  if (slugError) return { error: `Personal page address: ${slugError}` }
  const clash = await prisma.recruiter.findFirst({
    where: { recruiterFirmId: ctx.firm.id, intakeSlug: slug, id: { not: ctx.recruiter.id } },
  })
  if (clash) return { error: 'Someone at your firm already uses that address.' }

  const specialtyIds = formData.getAll('specialty').map(String)
  const firmSpecialties = await prisma.intakeSpecialty.findMany({ where: { firmId: ctx.firm.id, id: { in: specialtyIds } } })

  await prisma.$transaction([
    prisma.recruiter.update({
      where: { id: ctx.recruiter.id },
      data: {
        intakeSlug: slug,
        intakeBio: str(formData, 'bio') || null,
        ...(ctx.firm.intakeRecruitersCanEditTemplates
          ? {
              intakeNicheReplyTemplate: str(formData, 'nicheTemplate') || null,
              intakeOutsideReplyTemplate: str(formData, 'outsideTemplate') || null,
            }
          : {}),
      },
    }),
    prisma.recruiterIntakeSpecialty.deleteMany({ where: { recruiterId: ctx.recruiter.id } }),
    prisma.recruiterIntakeSpecialty.createMany({
      data: firmSpecialties.map((s) => ({
        recruiterId: ctx.recruiter.id,
        specialtyId: s.id,
        weight: formData.get(`weight-${s.id}`) === 'SECONDARY' ? 'SECONDARY' : 'PRIMARY',
      })),
    }),
  ])
  captureServerEvent(ctx.recruiter.id, 'talent_profile_saved', { recruiterId: ctx.recruiter.id, firmId: ctx.firm.id, specialtyCount: firmSpecialties.length })
  revalidatePath('/recruiters/talent/setup')
  return { success: 'Your Talent profile is saved.' }
}

// ── Open searches ───────────────────────────────────────────────────────────

export async function saveSearch(_prev: TalentFormState, formData: FormData): Promise<TalentFormState> {
  const ctx = await getTalentContext()
  if (!ctx.firm) return { error: 'Set up your firm first.' }
  const title = str(formData, 'title')
  if (!title) return { error: 'Give the search a title.' }
  const functions = formData.getAll('functions').map(String)
  const levels = formData.getAll('levels').map(String)
  const mustHaves = list(str(formData, 'mustHaves')).slice(0, 8)
  if (functions.length === 0 && levels.length === 0 && mustHaves.length === 0) {
    return { error: 'Add at least one function, level or must-have so pre-scan has something to match.' }
  }
  const data = {
    title,
    clientName: str(formData, 'clientName') || null,
    clientHidden: formData.get('clientHidden') !== 'off',
    location: str(formData, 'location') || null,
    functions,
    levels,
    mustHaves,
  }
  const id = str(formData, 'id')
  if (id) {
    await prisma.intakeSearch.updateMany({ where: { id, recruiterId: ctx.recruiter.id }, data })
  } else {
    await prisma.intakeSearch.create({ data: { ...data, firmId: ctx.firm.id, recruiterId: ctx.recruiter.id } })
  }
  captureServerEvent(ctx.recruiter.id, id ? 'talent_search_updated' : 'talent_search_created', {
    recruiterId: ctx.recruiter.id,
    firmId: ctx.firm.id,
    criteriaCount: functions.length + levels.length + mustHaves.length,
  })
  revalidatePath('/recruiters/talent/searches')
  return { success: id ? 'Search updated.' : 'Search added.' }
}

export async function setSearchStatus(searchId: string, status: 'OPEN' | 'CLOSED') {
  const ctx = await getTalentContext()
  await prisma.intakeSearch.updateMany({
    where: { id: searchId, recruiterId: ctx.recruiter.id },
    data: { status, closedAt: status === 'CLOSED' ? new Date() : null },
  })
  captureServerEvent(ctx.recruiter.id, 'talent_search_status_changed', { searchId, status })
  revalidatePath('/recruiters/talent/searches')
}

// ── Hopper actions ──────────────────────────────────────────────────────────

export async function overrideTag(connectionId: string, tag: IntakeTag) {
  const ctx = await getTalentContext()
  const connection = await findVisibleConnection(ctx, connectionId, { replies: true })
  if (!connection || connection.tag === tag) return
  await prisma.intakeConnection.update({
    where: { id: connection.id },
    data: {
      tag,
      tagOverridden: true,
      tagReasons: [`Set by ${ctx.recruiter.fullName}`, ...connection.tagReasons.filter((r) => !r.startsWith('Set by '))],
    },
  })
  // Fit never gets a reply; a changed tag re-drafts an untouched draft.
  if (tag === 'FIT') {
    await prisma.intakeReply.updateMany({
      where: { connectionId: connection.id, status: 'DRAFT' },
      data: { status: 'CANCELLED', cancelledById: ctx.recruiter.id, cancelledAt: new Date() },
    })
  } else {
    await draftReply(connection.id)
  }
  captureServerEvent(ctx.recruiter.id, 'talent_tag_overridden', { connectionId, from: connection.tag, to: tag })
  revalidatePath(`/recruiters/talent/${connectionId}`)
  revalidatePath('/recruiters/talent')
}

export async function assignConnection(connectionId: string, recruiterId: string | null) {
  const ctx = await getTalentContext()
  const connection = await findVisibleConnection(ctx, connectionId, {})
  if (!connection || !ctx.firm) return

  // Recruiters can only hand their own candidate back to the general hopper;
  // coordinators and admins can assign anyone.
  const selfDecline = recruiterId === null && connection.recruiterId === ctx.recruiter.id
  const selfAccept = recruiterId === ctx.recruiter.id && connection.suggestedRecruiterId === ctx.recruiter.id
  if (!canAssign(ctx) && !selfDecline && !selfAccept) return

  if (recruiterId) {
    const target = await prisma.recruiter.findFirst({ where: { id: recruiterId, recruiterFirmId: ctx.firm.id, firmRole: { not: null } } })
    if (!target) return
    await prisma.recruiter.update({ where: { id: target.id }, data: { lastIntakeAssignedAt: new Date() } })
  }

  await prisma.intakeConnection.update({
    where: { id: connection.id },
    data: {
      recruiterId,
      suggestedRecruiterId: null,
      assignedById: ctx.recruiter.id,
      assignedAt: new Date(),
    },
  })
  await prisma.intakeRoutingDecision.create({
    data: {
      connectionId: connection.id,
      mode: ctx.firm.intakeRoutingMode,
      suggestedRecruiterId: connection.suggestedRecruiterId,
      assignedRecruiterId: recruiterId,
      reassignedFromId: connection.recruiterId,
      reasons: [recruiterId ? (connection.suggestedRecruiterId === recruiterId ? 'Suggestion confirmed' : 'Assigned by hand') : 'Returned to the general hopper'],
      decidedBy: ctx.recruiter.id,
    },
  })
  captureServerEvent(ctx.recruiter.id, 'talent_connection_assigned', {
    connectionId,
    firmId: ctx.firm.id,
    toRecruiterId: recruiterId,
    fromRecruiterId: connection.recruiterId,
    confirmedSuggestion: !!recruiterId && connection.suggestedRecruiterId === recruiterId,
  })
  revalidatePath(`/recruiters/talent/${connectionId}`)
  revalidatePath('/recruiters/talent')
}

export async function getIntakeResumeUrl(resumeId: string): Promise<string | null> {
  const ctx = await getTalentContext()
  const resume = await prisma.intakeResume.findUnique({ where: { id: resumeId } })
  if (!resume) return null
  const visible = await prisma.intakeConnection.findFirst({
    where: { AND: [visibleConnectionsWhere(ctx), { firmId: resume.firmId, intakeCandidateId: resume.intakeCandidateId }] },
    select: { id: true },
  })
  if (!visible) return null
  const { data } = await createAdminClient().storage.from('resumes').createSignedUrl(resume.filePath, 60 * 5)
  captureServerEvent(ctx.recruiter.id, 'talent_resume_opened', { resumeId, connectionId: visible.id })
  return data?.signedUrl ?? null
}

// ── Replies (held for approval) ─────────────────────────────────────────────

async function visibleDraft(replyId: string) {
  const ctx = await getTalentContext()
  const reply = await prisma.intakeReply.findFirst({
    where: { id: replyId, status: 'DRAFT', connection: visibleConnectionsWhere(ctx) },
  })
  return { ctx, reply }
}

export async function editReply(_prev: TalentFormState, formData: FormData): Promise<TalentFormState> {
  const { ctx, reply } = await visibleDraft(str(formData, 'replyId'))
  if (!reply) return { error: 'This reply was already approved or cancelled.' }
  const subject = str(formData, 'subject')
  const body = str(formData, 'body')
  if (!subject || !body) return { error: 'The reply needs a subject and a message.' }
  await prisma.intakeReply.update({ where: { id: reply.id }, data: { subject, body } })
  captureServerEvent(ctx.recruiter.id, 'talent_reply_edited', { replyId: reply.id })
  revalidatePath('/recruiters/talent/replies')
  return { success: 'Saved.' }
}

export async function approveReplies(replyIds: string[]) {
  const ctx = await getTalentContext()
  const replies = await prisma.intakeReply.findMany({
    where: { id: { in: replyIds }, status: 'DRAFT', connection: visibleConnectionsWhere(ctx) },
    select: { id: true },
  })
  if (replies.length === 0) return { approved: 0, sent: 0 }
  await prisma.intakeReply.updateMany({
    where: { id: { in: replies.map((r) => r.id) } },
    data: { status: 'APPROVED', approvedById: ctx.recruiter.id, approvedAt: new Date() },
  })
  let sent = 0
  for (const reply of replies) {
    if ((await sendApprovedReply(reply.id)) === 'sent') sent++
  }
  captureServerEvent(ctx.recruiter.id, 'talent_replies_approved', { recruiterId: ctx.recruiter.id, count: replies.length, sent, bulk: replyIds.length > 1 })
  revalidatePath('/recruiters/talent/replies')
  revalidatePath('/recruiters/talent')
  return { approved: replies.length, sent }
}

export async function cancelReply(replyId: string) {
  const { ctx, reply } = await visibleDraft(replyId)
  if (!reply) return
  await prisma.intakeReply.update({
    where: { id: reply.id },
    data: { status: 'CANCELLED', cancelledById: ctx.recruiter.id, cancelledAt: new Date() },
  })
  captureServerEvent(ctx.recruiter.id, 'talent_reply_cancelled', { replyId })
  revalidatePath('/recruiters/talent/replies')
}
