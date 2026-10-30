'use server'

import { searchOccupationTitles } from '@/lib/careers/candidate-occupation'
import { allowByIp, HOUR_MS, RATE_LIMITED_MESSAGE } from '@/lib/security/rate-limit'
import { loadExposureMap } from '@/lib/skills/ai-exposure-server'
import { soc6Of } from '@/lib/skills/ai-exposure'
import { checkPath } from './slug'

export interface FindState {
  /** Matches, best first. Only occupations with a measured exposure are listed. */
  matches?: { title: string; path: string; exact: boolean }[]
  error?: string
  /** The title that was searched, so the form can keep what the visitor typed. */
  title?: string
}

// Title search for the AI job check. Free text in, a short list of occupations out. No AI call: it is the same O*NET title
// matcher the member dashboard uses. Rate limited by address.
export async function findOccupations(_prev: FindState, formData: FormData): Promise<FindState> {
  const title = String(formData.get('title') ?? '').trim().slice(0, 80)
  if (title.length < 2) return { title, error: 'Type your job title, like “marketing manager” or “accountant”.' }
  if (!(await allowByIp('ai-check-find', 120, HOUR_MS))) return { title, error: RATE_LIMITED_MESSAGE }
  try {
    const [found, exposure] = await Promise.all([searchOccupationTitles(title), loadExposureMap()])
    const matches = found
      .filter((c) => exposure.has(soc6Of(c.socCode)))
      .map((c) => ({ title: c.title, path: checkPath(c.title, soc6Of(c.socCode)), exact: c.score === 1 }))
    if (matches.length === 0) return { title, error: 'We could not match that title. Try the plain name of the job, like “nurse manager” instead of a company-specific title.' }
    return { title, matches }
  } catch (error) {
    console.error('AI job check search failed:', error)
    return { title, error: 'The search is not working right now. Try again in a minute.' }
  }
}
