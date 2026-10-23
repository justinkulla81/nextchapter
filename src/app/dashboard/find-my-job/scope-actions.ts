'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { captureServerEvent } from '@/lib/posthog/server'
import {
  addExploredOption, exploreKey, parseScope, readExploredOptions, readPivotScopeState, removeExploredOption, OPTION_KINDS,
  type OptionKind, type OptionSource,
} from '@/lib/jobs/search-scope'
import type { Prisma } from '@prisma/client'

// Everything here lives in journeyDetails (searchScope, exploredOptions, pivotScope): no new column, and it
// survives journey changes. Behavior never writes here by itself; every write is a tap.

async function load() {
  const user = await getCurrentUser()
  if (!user) return null
  return prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { id: true, journeyDetails: true } })
}

const asKind = (k: string): OptionKind | null => (OPTION_KINDS.includes(k as OptionKind) ? (k as OptionKind) : null)

async function save(id: string, details: Record<string, unknown>) {
  await prisma.candidateProfile.update({ where: { id }, data: { journeyDetails: details as Prisma.InputJsonValue } })
  revalidatePath('/dashboard', 'layout')
}

/** Saves the member's search scope; the board opens on it next time. The change event is sent from the button. */
export async function saveSearchScope(value: string): Promise<{ ok: boolean }> {
  const scope = parseScope(value)
  const p = scope ? await load() : null
  if (!scope || !p) return { ok: false }
  const details = (p.journeyDetails as Record<string, unknown> | null) ?? {}
  await save(p.id, { ...details, searchScope: scope })
  return { ok: true }
}

/** Switches an explored option on or off, saving it first if it came from the radar and has no row yet. */
export async function setExploredOption(kind: string, value: string, on: boolean, source: OptionSource = 'exploration'): Promise<{ error?: string }> {
  const k = asKind(kind)
  const p = k ? await load() : null
  if (!k || !p) return { error: 'We could not save that. Refresh and try again.' }
  const details = (p.journeyDetails as Record<string, unknown> | null) ?? {}
  const list = addExploredOption(readExploredOptions(details), { kind: k, value, source }).map((o) => (exploreKey(o) === exploreKey({ kind: k, value }) ? { ...o, on } : o))
  await save(p.id, { ...details, exploredOptions: list })
  captureServerEvent(p.id, on ? 'pivot_option_added' : 'pivot_option_removed', { kind: k, value, source })
  return {}
}

/** Takes an explored option off the list altogether. */
export async function forgetExploredOption(kind: string, value: string): Promise<{ error?: string }> {
  const k = asKind(kind)
  const p = k ? await load() : null
  if (!k || !p) return { error: 'We could not remove that. Refresh and try again.' }
  const details = (p.journeyDetails as Record<string, unknown> | null) ?? {}
  await save(p.id, { ...details, exploredOptions: removeExploredOption(readExploredOptions(details), { kind: k, value }) })
  captureServerEvent(p.id, 'pivot_option_removed', { kind: k, value, source: 'list' })
  return {}
}

/** "Are you exploring a move into X?" A yes saves an explored option that is off; a no is remembered so we do not ask again. */
export async function answerPivotQuestion(kind: string, value: string, answer: 'yes' | 'no'): Promise<{ error?: string }> {
  const k = asKind(kind)
  const p = k && (answer === 'yes' || answer === 'no') ? await load() : null
  if (!k || !p) return { error: 'We could not save that. Refresh and try again.' }
  const details = (p.journeyDetails as Record<string, unknown> | null) ?? {}
  const state = readPivotScopeState(details)
  const next = { ...details, pivotScope: { ...(details.pivotScope as object | undefined), messageShownAt: state.messageShownAt, answers: { ...state.answers, [exploreKey({ kind: k, value })]: answer } } } as Record<string, unknown>
  if (answer === 'yes') next.exploredOptions = addExploredOption(readExploredOptions(details), { kind: k, value, source: 'question' })
  await save(p.id, next)
  captureServerEvent(p.id, 'pivot_question_answered', { kind: k, value, answer })
  return {}
}

/** Records that the pivot message was shown. Only the first call counts, so the message never repeats. */
export async function markPivotMessageShown(outside: { functions: number; industries: number; places: number }): Promise<{ first: boolean }> {
  const p = await load()
  if (!p) return { first: false }
  const details = (p.journeyDetails as Record<string, unknown> | null) ?? {}
  const state = readPivotScopeState(details)
  if (state.messageShownAt) return { first: false }
  await save(p.id, { ...details, pivotScope: { ...(details.pivotScope as object | undefined), messageShownAt: new Date().toISOString(), answers: state.answers } })
  captureServerEvent(p.id, 'pivot_message_shown', { functions: outside.functions, industries: outside.industries, places: outside.places })
  return { first: true }
}
