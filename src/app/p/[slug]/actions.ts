'use server'

import { prisma } from '@/lib/prisma'
import { createDemoAccessLink } from '@/lib/demo/access'
import { captureServerEvent } from '@/lib/posthog/server'

// Public on purpose: a demo holds sample data only, its sample accounts use a
// reserved test domain, and createDemoAccessLink refuses anything that is not a
// demo organization. A best-effort limit keeps one visitor from hammering it.
const recent = new Map<string, number[]>()
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 20

function allowed(key: string): boolean {
  const now = Date.now()
  const hits = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  if (hits.length >= MAX_PER_WINDOW) return false
  hits.push(now)
  recent.set(key, hits)
  return true
}

export async function openDemoRoleAction(slug: string, roleKey: string): Promise<{ url?: string; error?: string }> {
  if (!allowed(slug)) return { error: 'Lots of people are opening this demo right now. Wait a minute and try again.' }
  const org = await prisma.organization.findUnique({ where: { slug }, select: { id: true, isDemo: true, demoExpiresAt: true } })
  if (!org || !org.isDemo || (org.demoExpiresAt && org.demoExpiresAt < new Date())) return { error: 'This demo is not available any more. Ask your NextChapter contact for a new one.' }
  const r = await createDemoAccessLink(org.id, roleKey)
  if (r.url) captureServerEvent('front-door-visitor', 'demo_role_opened', { organizationId: org.id, slug, roleKey, source: 'front_door' })
  return r
}
