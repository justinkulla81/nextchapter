'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { ensureUser } from '@/lib/auth/ensure-user'
import { getOrCreateCandidateProfile } from '@/lib/profile'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { allowByIp, HOUR_MS, RATE_LIMITED_MESSAGE } from '@/lib/security/rate-limit'
import { readSkillLevels } from '@/lib/profile/skill-matrix'
import { loadSkillsMarket } from '@/lib/skills/market-server'
import { findSkill } from '@/lib/skills/market'
import { applyClaim, claimOf, removeClaim, CLAIM_KINDS, type ClaimKind } from '@/lib/skills/claim'

// "I have this skill" / "I want to build this" on a skill page or a job listing. The claim goes on the member's profile; a
// visitor with no account gets one started, as the résumé upload does, and after their first claim goes on into onboarding.
// Only skills on the skills market can be claimed, so a name cannot be made up.

export type ClaimResult = { ok: true; claim: ClaimKind | null; next: string | null } | { ok: false; error: string }

const SELECT = { id: true, registrationCompletedAt: true, confirmedSkillsHave: true, skillsToBuild: true, skillLevels: true } as const

export async function setSkillClaim(slug: string, kind: ClaimKind, on: boolean, source: string): Promise<ClaimResult> {
  if (!CLAIM_KINDS.includes(kind)) return { ok: false, error: 'Something went wrong. Please try again.' }
  if (!(await allowByIp('claim-skill', 120, HOUR_MS))) return { ok: false, error: RATE_LIMITED_MESSAGE }
  const market = await loadSkillsMarket()
  const skill = market ? findSkill(market, slug) : null
  if (!skill) return { ok: false, error: 'That skill is not on the list right now. Reload the page and try again.' }

  let user
  try {
    user = await ensureUser(await createClient())
  } catch {
    return { ok: false, error: 'We could not start your session. Please try again.' }
  }
  const profile = await getOrCreateCandidateProfile(user.id)
  const current = await prisma.candidateProfile.findUniqueOrThrow({ where: { id: profile.id }, select: SELECT })
  const before = { have: current.confirmedSkillsHave, build: current.skillsToBuild, levels: readSkillLevels(current.skillLevels) }
  const after = on ? applyClaim(before, skill.name, kind) : removeClaim(before, skill.name, kind)
  await prisma.candidateProfile.update({
    where: { id: profile.id },
    data: { confirmedSkillsHave: after.have, skillsToBuild: after.build, skillLevels: after.levels },
  })

  const firstClaim = before.have.length + before.build.length === 0
  const registered = !!current.registrationCompletedAt
  captureServerEvent(profile.id, on ? 'skill_claimed' : 'skill_unclaimed', { skillSlug: skill.slug, skillName: skill.name, kind, source, registered, firstClaim, postings: skill.n })
  revalidatePath('/dashboard', 'layout')
  // A new visitor's first claim goes on into onboarding; later claims, and members, stay where they are.
  return { ok: true, claim: claimOf(after, skill.name), next: on && firstClaim && !registered ? '/onboarding' : null }
}

/** What the current visitor or member has said about each skill. Empty for anyone with no session, so public pages stay cached. */
export async function getSkillClaims(slugs: string[]): Promise<Record<string, ClaimKind>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return {}
    const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: SELECT })
    if (!profile) return {}
    const market = await loadSkillsMarket()
    if (!market) return {}
    const out: Record<string, ClaimKind> = {}
    for (const slug of slugs.slice(0, 20)) {
      const skill = findSkill(market, slug)
      const c = skill ? claimOf({ have: profile.confirmedSkillsHave, build: profile.skillsToBuild }, skill.name) : null
      if (c) out[slug] = c
    }
    return out
  } catch {
    return {}
  }
}
