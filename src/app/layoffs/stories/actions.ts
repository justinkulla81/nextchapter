'use server'

import { getClientIp } from '@/lib/http/client-ip'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'
import { getCompanies } from '@/lib/warn/layoff-pages'
import { submitStory, verifyStory, withdrawStory, type VerifyStoryResult, type WithdrawStoryResult } from '@/lib/layoff-stories/store'

export interface CompanyHit { slug: string; name: string }

/** The company picker: companies with a tracked layoff whose name contains what was typed, newest layoff first. Empty search = the most recent. */
export async function searchLayoffCompanies(q: string): Promise<CompanyHit[]> {
  const term = (q ?? '').trim().toLowerCase().slice(0, 60)
  if (!(await allowByIp('layoff-story-company-search', 300, HOUR_MS))) return []
  const all = [...(await getCompanies()).values()].sort((a, b) => b.latest.getTime() - a.latest.getTime())
  const hits = term.length < 2 ? all : all.filter((c) => c.name.toLowerCase().includes(term))
  return hits.slice(0, 8).map((c) => ({ slug: c.slug, name: c.name }))
}

export type StoryFormState = { sent?: { email: string | null; failed?: boolean }; error?: string; values?: Record<string, string | string[]> } | undefined

/** Saves the story. A website field bots fill is checked first. Answers are kept on an error so nothing has to be typed again. */
export async function submitStoryAction(_prev: StoryFormState, formData: FormData): Promise<StoryFormState> {
  const values: Record<string, string | string[]> = {}
  for (const k of new Set([...formData.keys()])) values[k] = k === 'helpWanted' ? formData.getAll(k).map(String) : String(formData.get(k) ?? '')
  if (values.website) return { sent: { email: null } }
  try {
    const r = await submitStory(values, await getClientIp())
    return r.ok ? { sent: { email: r.emailSent, failed: r.emailFailed } } : { error: r.error, values }
  } catch (e) {
    console.error('Layoff story submit failed', e)
    return { error: 'Something went wrong on our side. Try again in a few minutes.', values }
  }
}

/** The buttons on the confirm and withdraw pages: buttons, not the bare links, so an email scanner that opens links cannot use them up. */
export async function confirmStoryAction(token: string): Promise<VerifyStoryResult> {
  try { return await verifyStory(token) } catch (e) { console.error('Layoff story confirm failed', e); return 'invalid' }
}
export async function withdrawStoryAction(token: string): Promise<WithdrawStoryResult> {
  try { return await withdrawStory(token) } catch (e) { console.error('Layoff story withdraw failed', e); return 'invalid' }
}
