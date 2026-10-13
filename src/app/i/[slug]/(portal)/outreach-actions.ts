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
