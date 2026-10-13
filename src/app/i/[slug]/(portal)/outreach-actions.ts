'use server'

// Release 2 staff actions: approve layoff outreach and check-ins from
// "Waiting for you". Every send is a staff click; nothing goes out on its own.

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { requireWorkspace } from '@/lib/higher-ed/access'
import type { AccessToken } from '@/lib/higher-ed/workspaces'
import { sendLayoffOutreach } from '@/lib/higher-ed/layoffs'
import { sendDueCheckIns } from '@/lib/higher-ed/checkins'
import { isAudience, saveDraft, sendNextBatch, sendTestToSelf, unknownFields } from '@/lib/higher-ed/composer'

type Result = { error?: string; message?: string }

const has = (tokens: ReadonlySet<AccessToken>, ...roles: AccessToken[]) => roles.some((r) => tokens.has(r))

function sentMessage(r: { sent: number; skipped: number; demo: boolean }, what: string): string {
  const where = r.demo ? 'recorded in the demo outbox (no email sent)' : 'sent'
  return `${r.sent} ${what} ${where}.${r.skipped ? ` ${r.skipped} skipped (do not contact or opted out).` : ''}`
}

// Alumni Relations: the layoff email to the chosen matches, or every new one.
export async function approveLayoffOutreach(slug: string, matchIds?: string[]): Promise<Result> {
  const ctx = await requireWorkspace(slug, 'alumni', { write: true })
  if (!has(ctx.tokens, 'ALUMNI_RELATIONS', 'INSTITUTION_ADMIN')) return { error: 'Only Alumni Relations or a college admin can send outreach.' }
  const r = await sendLayoffOutreach({ institutionId: ctx.institution.id, matchIds, createdBy: ctx.email ?? ctx.userId })
  captureServerEvent(ctx.userId, 'he_layoff_outreach_sent', { institutionId: ctx.institution.id, sent: r.sent, skipped: r.skipped, demo: r.demo, selected: matchIds?.length ?? null })
  revalidatePath(`/i/${slug}`, 'layout')
  return { message: sentMessage(r, 'layoff emails') }
}

// Not every match needs an email (a known contractor, someone already in
// touch): skipping keeps it off the inbox.
export async function skipLayoffMatches(slug: string, matchIds: string[]): Promise<Result> {
  const ctx = await requireWorkspace(slug, 'alumni', { write: true })
  if (!has(ctx.tokens, 'ALUMNI_RELATIONS', 'INSTITUTION_ADMIN')) return { error: 'Only Alumni Relations or a college admin can change outreach.' }
  const r = await prisma.layoffMatch.updateMany({
    where: { id: { in: matchIds }, institutionId: ctx.institution.id, outreachStatus: 'NEW' },
    data: { outreachStatus: 'SKIPPED' },
  })
  captureServerEvent(ctx.userId, 'he_layoff_matches_skipped', { institutionId: ctx.institution.id, count: r.count })
  revalidatePath(`/i/${slug}`, 'layout')
  return { message: `${r.count} skipped.` }
}

// The annual check-in belongs to Alumni Relations, the early-career ones to
// Career Services: each office approves its own.
export async function approveCheckIns(slug: string, workspace: 'alumni' | 'career'): Promise<Result> {
  const ctx = await requireWorkspace(slug, workspace, { write: true })
  const allowed = workspace === 'alumni' ? has(ctx.tokens, 'ALUMNI_RELATIONS', 'INSTITUTION_ADMIN') : has(ctx.tokens, 'CAREER_SERVICES', 'INSTITUTION_ADMIN')
  if (!allowed) return { error: 'Your role can’t send check-ins from here.' }
  const kinds = workspace === 'alumni' ? (['CUSTOM'] as const) : (['M6', 'M18', 'M24'] as const)
  const r = await sendDueCheckIns({ institutionId: ctx.institution.id, createdBy: ctx.email ?? ctx.userId, kinds: [...kinds] })
  captureServerEvent(ctx.userId, 'he_checkins_sent', { institutionId: ctx.institution.id, workspace, sent: r.sent, skipped: r.skipped, demo: r.demo })
  revalidatePath(`/i/${slug}`, 'layout')
  return { message: sentMessage(r, 'check-ins') }
}

// ── Composer (Alumni Relations › Outreach) ─────────────────────────────────

async function composerGate(slug: string) {
  const ctx = await requireWorkspace(slug, 'alumni', { write: true })
  return has(ctx.tokens, 'ALUMNI_RELATIONS', 'INSTITUTION_ADMIN') ? ctx : null
}

export async function saveOutreachDraft(slug: string, input: { id: string | null; subject: string; body: string; audience: string }): Promise<{ error?: string; id?: string }> {
  const ctx = await composerGate(slug)
  if (!ctx) return { error: 'Only Alumni Relations or a college admin can write outreach.' }
  const subject = input.subject.trim()
  const body = input.body.trim()
  if (!subject) return { error: 'Add a subject line.' }
  if (!body) return { error: 'Write the email.' }
  if (!isAudience(input.audience)) return { error: 'Pick who it goes to.' }
  const bad = unknownFields(`${subject} ${body}`)
  if (bad.length) return { error: `These merge fields don’t exist: ${bad.map((b) => `{{${b}}}`).join(', ')}. Use the buttons to insert one.` }
  const r = await saveDraft({ institutionId: ctx.institution.id, id: input.id, subject, body, audience: input.audience, createdBy: ctx.email ?? ctx.userId })
  if ('error' in r) return { error: r.error }
  captureServerEvent(ctx.userId, 'he_outreach_draft_saved', { institutionId: ctx.institution.id, campaignId: r.id, audience: input.audience, isNew: !input.id })
  revalidatePath(`/i/${slug}/alumni/outreach`)
  return { id: r.id }
}

export async function sendOutreachTest(slug: string, campaignId: string): Promise<{ error?: string; message?: string; preview?: { subject: string; text: string } }> {
  const ctx = await composerGate(slug)
  if (!ctx) return { error: 'Only Alumni Relations or a college admin can send tests.' }
  if (!ctx.email) return { error: 'Your account has no email address to send a test to.' }
  const r = await sendTestToSelf({ institutionId: ctx.institution.id, campaignId, to: ctx.email })
  if ('error' in r) return { error: r.error }
  captureServerEvent(ctx.userId, 'he_outreach_test_sent', { institutionId: ctx.institution.id, campaignId, demo: r.demo })
  return { message: r.demo ? 'Demo college: here’s exactly what it would send.' : `Sent to ${ctx.email}.`, preview: { subject: r.subject, text: r.text } }
}

export async function sendOutreachBatch(slug: string, campaignId: string): Promise<Result> {
  const ctx = await composerGate(slug)
  if (!ctx) return { error: 'Only Alumni Relations or a college admin can send outreach.' }
  const r = await sendNextBatch({ institutionId: ctx.institution.id, campaignId, createdBy: ctx.email ?? ctx.userId })
  if ('error' in r) return { error: r.error }
  captureServerEvent(ctx.userId, 'he_outreach_batch_sent', { institutionId: ctx.institution.id, campaignId, sent: r.sent, skipped: r.skipped, demo: r.demo })
  revalidatePath(`/i/${slug}`, 'layout')
  return { message: sentMessage(r, 'emails') }
}
