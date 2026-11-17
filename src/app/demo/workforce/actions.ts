'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { InstitutionOrgType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getOrgUser, getSessionAal } from '@/lib/supabase/get-current-user'
import { isNcAdmin } from '@/lib/higher-ed/resolve'
import { DEMO_GUEST_COOKIE, DEMO_GUEST_DAYS, guestCookieValue, guestSlugs } from '@/lib/higher-ed/demo-guest'
import { generateWorkforceDemo } from '@/lib/workforce/demo'
import { orgAppPath } from '@/lib/org-hosts'
import { allowByIp, allowByTarget, DAY_MS, RATE_LIMITED_MESSAGE } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { demoOrgById, demoOrgColor, existingDemosFor, searchDemoOrgs, sourceKey, type DemoOrg, type DemoOrgKind, type ExistingDemo } from '@/lib/workforce/demo-orgs'

export type DemoFormState = { error?: string; values?: Record<string, string>; manual?: boolean } | undefined

const TYPES: Exclude<InstitutionOrgType, 'COLLEGE'>[] = ['WORKFORCE_BOARD', 'ECONOMIC_DEVELOPMENT', 'CHAMBER', 'COMMUNITY_ORG']
const PUBLIC_PER_DAY = 60
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function currentAdmin(): Promise<{ admin: boolean; email: string | null }> {
  const user = await getOrgUser()
  const admin = user ? await isNcAdmin(user.id, user.email ?? null, undefined, await getSessionAal('org')) : false
  return { admin, email: user?.email ?? null }
}

type BuildInput = { name: string; orgType: (typeof TYPES)[number]; anchorCity: string; anchorState: string; radiusMiles: number; preparedFor: string; accentColor: string; email: string; from: string; sourceOrg: string | null }

// Build the demo and open it. Anyone can (rate limited); a NextChapter admin's demos don't expire.
async function buildAndOpen(input: BuildInput, who: { admin: boolean }, values: Record<string, string>, manual: boolean): Promise<DemoFormState> {
  if (!who.admin) {
    if (!(await allowByIp('workforce-demo', 3, DAY_MS)) || !(await allowByTarget('workforce-demo-email', input.email, 3, DAY_MS))) return { error: RATE_LIMITED_MESSAGE, values, manual }
    const today = await prisma.institution.count({ where: { isDemo: true, orgType: { not: 'COLLEGE' }, createdAt: { gte: new Date(Date.now() - DAY_MS) } } })
    if (today >= PUBLIC_PER_DAY) return { error: 'We’ve made a lot of demos today. Try again tomorrow, or email support@launchyournextchapter.com and we’ll set one up.', values, manual }
  }

  let r
  try {
    r = await generateWorkforceDemo({
      name: input.name,
      orgType: input.orgType,
      anchorCity: input.anchorCity,
      anchorState: input.anchorState,
      radiusMiles: input.radiusMiles || 40,
      preparedFor: input.preparedFor,
      accentColor: input.accentColor,
      source: who.admin ? 'admin' : 'public',
      requestedBy: input.email,
      sourceOrg: input.sourceOrg,
    })
  } catch (e) {
    console.error('Workforce demo failed:', e)
    return { error: 'Something went wrong building your demo. Try again in a minute.', values, manual }
  }
  if ('error' in r) return { error: r.error, values, manual }

  const from = input.from.slice(0, 40)
  captureServerEvent(`demo:${r.slug}`, 'workforce_demo_generated', {
    slug: r.slug,
    orgType: input.orgType,
    state: input.anchorState.toUpperCase(),
    source: who.admin ? 'admin' : 'public',
    emailDomain: input.email.split('@')[1] ?? null,
    from: /^[a-z0-9-]+$/.test(from) ? from : null,
    sourceOrg: input.sourceOrg,
    picked: !!input.sourceOrg,
  })
  if (!who.admin) {
    const store = await cookies()
    const mine = guestSlugs(store.get(DEMO_GUEST_COOKIE)?.value)
    store.set(DEMO_GUEST_COOKIE, guestCookieValue([...mine, r.slug]), { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: DEMO_GUEST_DAYS * 86_400 })
  }
  redirect(orgAppPath(r.slug, 'workforce', '/hub'))
}

// The fallback: the organization typed in by hand.
export async function createWorkforceDemo(_prev: DemoFormState, f: FormData): Promise<DemoFormState> {
  const values = Object.fromEntries(['name', 'orgType', 'anchorCity', 'anchorState', 'radiusMiles', 'email', 'preparedFor', 'accentColor'].map((k) => [k, String(f.get(k) ?? '').trim()]))
  const orgType = values.orgType as (typeof TYPES)[number]
  if (!TYPES.includes(orgType)) return { error: 'Pick what kind of organization you are.', values, manual: true }
  const who = await currentAdmin()
  const email = (values.email || (who.admin ? (who.email ?? '') : '')).toLowerCase()
  if (!EMAIL.test(email)) return { error: 'Add your work email so we know who the demo is for.', values, manual: true }
  return buildAndOpen(
    { name: values.name, orgType, anchorCity: values.anchorCity, anchorState: values.anchorState, radiusMiles: Number(values.radiusMiles) || 40, preparedFor: values.preparedFor, accentColor: values.accentColor, email, from: String(f.get('from') ?? '').trim(), sourceOrg: null },
    who,
    values,
    true,
  )
}

export type DemoOrgResult = DemoOrg & { existing: ExistingDemo[] }

// Find the organization on file. Public: the directory is the same data the public board and economic development pages show.
// Demos already built are listed only for NextChapter admins.
export async function findDemoOrgs(q: string, state?: string): Promise<DemoOrgResult[]> {
  const orgs = await searchDemoOrgs(String(q ?? ''), state ? String(state).toUpperCase() : null)
  if (orgs.length === 0) return []
  const who = await currentAdmin()
  const existing = who.admin ? await existingDemosFor(orgs) : {}
  return orgs.map((o) => ({ ...o, existing: existing[sourceKey(o.kind, o.id)] ?? [] }))
}

// Build the demo from the organization picked in the search. The browser sends only which record; everything else is re-read here.
export async function createDemoFromOrg(_prev: DemoFormState, f: FormData): Promise<DemoFormState> {
  const kind = String(f.get('kind') ?? '') as DemoOrgKind
  const id = String(f.get('orgId') ?? '').slice(0, 80)
  const values = Object.fromEntries(['email', 'preparedFor'].map((k) => [k, String(f.get(k) ?? '').trim()]))
  if ((kind !== 'WORKFORCE_BOARD' && kind !== 'ECON_DEV') || !id) return { error: 'Pick your organization from the list, or enter it yourself.', values }
  const org = await demoOrgById(kind, id)
  if (!org) return { error: 'That organization is no longer on file. Enter it yourself below.', values: { ...values }, manual: true }
  const manualValues = { ...values, name: org.name, orgType: org.orgType, anchorState: org.state, anchorCity: org.city ?? '' }
  if (!org.city) return { error: `We don’t have ${org.name}’s main city on file. Add it below and build the demo.`, values: manualValues, manual: true }

  const who = await currentAdmin()
  const email = (values.email || (who.admin ? (who.email ?? '') : '')).toLowerCase()
  if (!EMAIL.test(email)) return { error: 'Add your work email so we know who the demo is for.', values }
  const accentColor = (await demoOrgColor(kind, id)) ?? ''
  return buildAndOpen(
    { name: org.name, orgType: org.orgType, anchorCity: org.city, anchorState: org.state, radiusMiles: 40, preparedFor: values.preparedFor, accentColor, email, from: String(f.get('from') ?? '').trim(), sourceOrg: sourceKey(kind, id) },
    who,
    values,
    false,
  )
}
