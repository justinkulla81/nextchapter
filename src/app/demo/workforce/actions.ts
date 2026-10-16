'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { InstitutionOrgType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getOrgUser } from '@/lib/supabase/get-current-user'
import { isNcAdmin } from '@/lib/higher-ed/resolve'
import { DEMO_GUEST_COOKIE, DEMO_GUEST_DAYS, guestCookieValue, guestSlugs } from '@/lib/higher-ed/demo-guest'
import { generateWorkforceDemo } from '@/lib/workforce/demo'
import { allowByIp, allowByTarget, DAY_MS, RATE_LIMITED_MESSAGE } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'

export type DemoFormState = { error?: string; values?: Record<string, string> } | undefined

const TYPES: Exclude<InstitutionOrgType, 'COLLEGE'>[] = ['WORKFORCE_BOARD', 'ECONOMIC_DEVELOPMENT', 'CHAMBER', 'COMMUNITY_ORG']
const PUBLIC_PER_DAY = 60

// Generate a workforce demo and open it. Anyone can (rate limited); a
// NextChapter admin's demos don't expire.
export async function createWorkforceDemo(_prev: DemoFormState, f: FormData): Promise<DemoFormState> {
  const values = Object.fromEntries(['name', 'orgType', 'anchorCity', 'anchorState', 'radiusMiles', 'email'].map((k) => [k, String(f.get(k) ?? '').trim()]))
  const orgType = values.orgType as (typeof TYPES)[number]
  if (!TYPES.includes(orgType)) return { error: 'Pick what kind of organization you are.', values }
  const email = values.email.toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Add your work email so we know who the demo is for.', values }

  const user = await getOrgUser()
  const admin = user ? await isNcAdmin(user.id, user.email ?? null) : false
  if (!admin) {
    if (!(await allowByIp('workforce-demo', 3, DAY_MS)) || !(await allowByTarget('workforce-demo-email', email, 3, DAY_MS))) return { error: RATE_LIMITED_MESSAGE, values }
    const today = await prisma.institution.count({ where: { isDemo: true, orgType: { not: 'COLLEGE' }, createdAt: { gte: new Date(Date.now() - DAY_MS) } } })
    if (today >= PUBLIC_PER_DAY) return { error: 'We’ve made a lot of demos today. Try again tomorrow, or email support@launchyournextchapter.com and we’ll set one up.', values }
  }

  let r
  try {
    r = await generateWorkforceDemo({
      name: values.name,
      orgType,
      anchorCity: values.anchorCity,
      anchorState: values.anchorState,
      radiusMiles: Number(values.radiusMiles) || 40,
      source: admin ? 'admin' : 'public',
      requestedBy: email,
    })
  } catch (e) {
    console.error('Workforce demo failed:', e)
    return { error: 'Something went wrong building your demo. Try again in a minute.', values }
  }
  if ('error' in r) return { error: r.error, values }

  captureServerEvent(`demo:${r.slug}`, 'workforce_demo_generated', { slug: r.slug, orgType, state: values.anchorState.toUpperCase(), source: admin ? 'admin' : 'public', emailDomain: email.split('@')[1] })
  if (!admin) {
    const store = await cookies()
    const mine = guestSlugs(store.get(DEMO_GUEST_COOKIE)?.value)
    store.set(DEMO_GUEST_COOKIE, guestCookieValue([...mine, r.slug]), { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: DEMO_GUEST_DAYS * 86_400 })
  }
  redirect(`/workforce/${r.slug}/hub`)
}
