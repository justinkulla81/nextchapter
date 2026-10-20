// One-time backfill (2026-10-16): prefill profiles from résumés already on file,
// with the same never-overwrite rule as a new upload (src/lib/resume/resume-prefill.ts).
// No LLM calls: it reads the stored résumé text (home city from the contact header,
// clearance, work authorization and licenses only when stated outright) and the
// résumé-derived work history already saved (latest title, years since the first job).
// Idempotent: fills only blank fields, or ones still marked as an unconfirmed résumé value.
//
// Dry run:  npx tsx --env-file=.env.local scripts/backfill-resume-prefill.ts
// Write:    npx tsx --env-file=.env.local scripts/backfill-resume-prefill.ts --apply

import { PrismaClient, type Prisma } from '@prisma/client'
import { PostHog } from 'posthog-node'
import {
  planResumePrefill,
  detectClearance,
  detectHomeLocation,
  detectLicenses,
  detectWorkAuthorization,
  type PrefillField,
} from '../src/lib/resume/resume-prefill'
import { computeYearsExperienceFromResume } from '../src/lib/resume/work-history-facts'
import { normalizeMetroArea } from '../src/lib/constants/metro-areas'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')
const posthog = process.env.NEXT_PUBLIC_POSTHOG_KEY
  ? new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, { host: process.env.NEXT_PUBLIC_POSTHOG_HOST, flushAt: 1, flushInterval: 0 })
  : null

async function main() {
  const resumes = await prisma.resume.findMany({
    where: { extractedText: { not: null } },
    orderBy: { uploadedAt: 'desc' },
    select: { id: true, candidateId: true, extractedText: true },
  })
  const latest = new Map<string, (typeof resumes)[number]>()
  for (const r of resumes) if (!latest.has(r.candidateId)) latest.set(r.candidateId, r)

  const counts: Partial<Record<PrefillField, number>> = {}
  let members = 0
  for (const [candidateId, resume] of latest) {
    const profile = await prisma.candidateProfile.findUnique({
      where: { id: candidateId },
      select: {
        currentCity: true, currentState: true, yearsExperience: true, resumeLatestJobTitle: true, primaryFunction: true,
        industryContext: true, highestEducationLevel: true, resumeKeywords: true, licensesHeld: true, licensesAnsweredAt: true,
        clearanceLevel: true, workAuthorization: true, resumePrefilledFields: true, certifications: true,
        workHistory: { orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }], select: { roleTitle: true, startDate: true } },
      },
    })
    if (!profile) continue
    const text = resume.extractedText
    const home = detectHomeLocation(text)
    const starts = profile.workHistory.map((w) => w.startDate).filter((d): d is Date => !!d)
    const firstStart = starts.length > 0 ? new Date(Math.min(...starts.map((d) => d.getTime()))) : null

    const plan = planResumePrefill(profile, {
      currentCity: home?.city ?? null,
      currentState: home?.state ?? null,
      yearsExperience: computeYearsExperienceFromResume(null, firstStart),
      resumeLatestJobTitle: profile.workHistory[0]?.roleTitle ?? null,
      licensesHeld: detectLicenses(profile.certifications, text),
      clearanceLevel: detectClearance(text),
      workAuthorization: detectWorkAuthorization(text),
    })
    if (plan.filled.length === 0) continue
    members++
    for (const f of plan.filled) counts[f] = (counts[f] ?? 0) + 1
    console.log(`${candidateId}: ${plan.filled.map((f) => `${f}=${JSON.stringify(plan.data[f])}`).join(', ')}`)
    if (!apply) continue

    const d = plan.data
    await prisma.candidateProfile.update({
      where: { id: candidateId },
      data: {
        ...(d.currentCity !== undefined && { currentCity: d.currentCity, metroArea: normalizeMetroArea(d.currentCity) }),
        ...(d.currentState !== undefined && { currentState: d.currentState }),
        ...(d.yearsExperience !== undefined && { yearsExperience: d.yearsExperience }),
        ...(d.resumeLatestJobTitle !== undefined && { resumeLatestJobTitle: d.resumeLatestJobTitle }),
        ...(d.licensesHeld !== undefined && { licensesHeld: d.licensesHeld ?? [] }),
        ...(d.clearanceLevel !== undefined && { clearanceLevel: d.clearanceLevel }),
        ...(d.workAuthorization !== undefined && { workAuthorization: d.workAuthorization }),
        resumePrefilledFields: plan.resumePrefilledFields,
      },
    })
    const properties = { fields: plan.filled, resumeId: resume.id, source: 'backfill' }
    posthog?.capture({ distinctId: candidateId, event: 'profile_prefilled_from_resume', properties })
    await prisma.analyticsEvent
      .create({ data: { distinctId: candidateId, event: 'profile_prefilled_from_resume', properties: properties as Prisma.InputJsonValue } })
      .catch(() => {})
  }

  console.log(`\n${apply ? 'Prefilled' : 'Would prefill'} ${members} of ${latest.size} members with a stored résumé.`)
  console.log('By field:', counts)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await posthog?.shutdown()
    await prisma.$disconnect()
  })
