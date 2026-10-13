'use server'

import { allowByIp, allowByTarget, DAY_MS, HOUR_MS, RATE_LIMITED_MESSAGE } from '@/lib/security/rate-limit'
import { signUpForRapidResponse } from '@/lib/higher-ed/rapid-response'
import { captureServerEvent } from '@/lib/posthog/server'

// The public sign-up on a rapid-response page. No account needed; rate
// limited by network and by email so it can't be used to flood the roster.
export async function signUpRapid(slug: string, id: string, input: { cohortId: string; firstName: string; lastName: string; email: string; note: string }): Promise<{ error?: string; ok?: boolean; already?: boolean }> {
  const email = input.email.trim().toLowerCase()
  if (!input.firstName.trim()) return { error: 'Add your first name.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Add an email we can reach you at.' }
  if (!(await allowByIp('rapid-signup', 10, HOUR_MS)) || !(await allowByTarget('rapid-signup-email', email, 5, DAY_MS))) return { error: RATE_LIMITED_MESSAGE }
  const r = await signUpForRapidResponse({ slug, id, cohortId: input.cohortId, firstName: input.firstName.trim().slice(0, 80), lastName: input.lastName.trim().slice(0, 80), email, note: input.note })
  if ('error' in r) return { error: r.error }
  captureServerEvent(`rapid:${id}`, 'he_rapid_response_signup', { slug, rapidResponseId: id, cohortId: input.cohortId, already: r.already })
  return { ok: true, already: r.already }
}
