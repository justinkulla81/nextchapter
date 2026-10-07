import 'server-only'
import type { PlatformHealth, PlatformStage } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { getAllCourseTitles } from '@/lib/learning/courses'
import { applyLearningClosesBarrierRewrite } from '@/lib/scoring/rewrite-actions'
import { markInterimMarketplaceSignupCore } from '@/lib/interim-work/mark-signup'
import { persistMilestoneBadgesAndNotify } from '@/lib/badges/badge-notifications'
import { estimateActionEffort } from '@/lib/weekly/action-effort'
import { logCatalogAction } from '@/lib/weekly/sprint'
import { platformsForSenderDomain, type PlatformEntry } from './directory'
import { readPlatformEmail, looksAutomated, extractCompletedTitle, stageRank, type PlatformStageKey } from './stages'
import { milestonesForStage, platformBadgeKey, platformBadgeLabel, type PlatformMilestone } from './badges'

export interface PlatformEmail {
  messageId: string
  senderDomain: string
  from: string
  subject: string
  body: string
  hasListUnsubscribe: boolean
  emailDate: Date
}

export interface TrackOptions {
  // Weekly Search points — only for recent mail after registration (the
  // same rule the rest of the Gmail sync uses).
  awardPoints: boolean
  // Popup + "you earned a badge" email. Off for a history backfill, so a
  // first sync never congratulates someone for something from March.
  notify: boolean
  interimListingDomainMap?: Map<string, { id: string; name: string }>
  // The connected mailbox's own domain — a candidate who works at Coursera
  // gets Coursera's internal mail, which is not a course.
  ownDomain?: string | null
}

// A milestone email older than this still earns the badge, silently.
const CONGRATULATE_WITHIN_MS = 14 * 24 * 60 * 60 * 1000

const POINTS_ACTION: Record<PlatformMilestone, string | null> = {
  FIRST_STEP: null, // per kind, below
  ACCEPTED: 'PLATFORM_ACCEPTED',
  FIRST_PROJECT: 'PLATFORM_FIRST_PROJECT',
  FIRST_PAYOUT: 'PLATFORM_FIRST_PAYOUT',
  COMPLETED: 'LEARNING_CERTIFICATE',
}

function matchPlatform(email: PlatformEmail): { platform: PlatformEntry; automated: boolean } | null {
  const automated = looksAutomated(email.from, email.hasListUnsubscribe)
  for (const platform of platformsForSenderDomain(email.senderDomain)) {
    if (!platform.gate) return { platform, automated }
    if (automated && platform.gate.test(`${email.from} ${email.subject}`)) return { platform, automated }
  }
  return null
}

const later = (a: Date | null | undefined, b: Date) => (!a || b > a ? b : a)

/**
 * Reads one inbound email against the platform directory. Returns null
 * when it isn't from a tracked platform or says nothing about the
 * candidate's progress there. Idempotent per message id.
 */
export async function trackPlatformEmail(
  candidateId: string,
  email: PlatformEmail,
  options: TrackOptions,
): Promise<{ platformKey: string; stage: PlatformStageKey | null } | null> {
  if (options.ownDomain && email.senderDomain.endsWith(options.ownDomain)) return null
  const match = matchPlatform(email)
  if (!match) return null
  const { platform, automated } = match

  const reading = readPlatformEmail(platform.kind, email.subject, email.body)
  // Automated mail from a work platform with no stage phrase (a talent
  // newsletter, a survey invitation) still means they're in its network —
  // shown as signed up, but it earns no badge or points on its own.
  // Learning providers market to everyone (a university to its alumni, a
  // newsletter to subscribers), so there it means nothing. Neither does a
  // personal note with no stage phrase.
  const weakSignup = !reading.stage && !reading.signal && automated && platform.kind === 'WORK'
  if (!reading.stage && !reading.signal && !weakSignup) return null
  const stage: PlatformStageKey | null = reading.stage ?? (weakSignup ? 'SIGNED_UP' : null)
  const progress = !!reading.stage

  const subject = email.subject.slice(0, 300)
  const inserted = await prisma.candidatePlatformEvent.createMany({
    data: [{
      candidateId,
      platformKey: platform.key,
      stage: stage as PlatformStage | null,
      signal: reading.signal as PlatformHealth | null,
      emailAt: email.emailDate,
      subject,
      externalMessageId: email.messageId,
    }],
    skipDuplicates: true,
  })
  if (inserted.count === 0) return { platformKey: platform.key, stage }

  const existing = await prisma.candidatePlatformActivity.findUnique({
    where: { candidateId_platformKey: { candidateId, platformKey: platform.key } },
  })
  const baseStage = (existing?.stage as PlatformStageKey | undefined) ?? stage ?? 'SIGNED_UP'
  const advanced = !!stage && stageRank(platform.kind, stage) > stageRank(platform.kind, baseStage)
  const newStage = advanced ? stage! : baseStage

  // Health follows the newest email that says something about it.
  let health = existing?.health ?? 'ACTIVE'
  let healthAt = existing?.healthAt ?? null
  const isNewer = !healthAt || email.emailDate >= healthAt
  if (isNewer) {
    if (reading.signal === 'NOT_ACCEPTED' && stageRank(platform.kind, newStage) < stageRank('WORK', 'ACCEPTED')) {
      health = 'NOT_ACCEPTED'; healthAt = email.emailDate
    } else if (reading.signal === 'NUDGE') {
      health = 'GONE_QUIET'; healthAt = email.emailDate
    } else if (reading.signal === 'FALLING_BEHIND') {
      health = 'FALLING_BEHIND'; healthAt = email.emailDate
    } else if (progress) {
      health = 'ACTIVE'; healthAt = email.emailDate
    }
  }

  const completedTitle = newStage === 'COMPLETED' && reading.stage === 'COMPLETED'
    ? (await findCatalogTitleInText(`${email.subject} ${email.body}`)) ?? extractCompletedTitle(email.subject)
    : null

  const lastEmailAt = later(existing?.lastEmailAt, email.emailDate)
  const activity = await prisma.candidatePlatformActivity.upsert({
    where: { candidateId_platformKey: { candidateId, platformKey: platform.key } },
    create: {
      candidateId,
      platformKey: platform.key,
      kind: platform.kind,
      stage: newStage as PlatformStage,
      stageAt: email.emailDate,
      health,
      healthAt,
      firstSeenAt: email.emailDate,
      lastEmailAt: email.emailDate,
      lastProgressAt: progress ? email.emailDate : null,
      emailCount: 1,
      lastSubject: subject,
      courseTitle: completedTitle,
    },
    update: {
      stage: newStage as PlatformStage,
      ...(advanced ? { stageAt: email.emailDate } : {}),
      health,
      healthAt,
      firstSeenAt: existing && email.emailDate < existing.firstSeenAt ? email.emailDate : undefined,
      lastEmailAt,
      ...(progress ? { lastProgressAt: later(existing?.lastProgressAt, email.emailDate) } : {}),
      emailCount: { increment: 1 },
      ...(lastEmailAt === email.emailDate ? { lastSubject: subject } : {}),
      ...(completedTitle ? { courseTitle: completedTitle } : {}),
    },
  })

  captureServerEvent(candidateId, 'platform_stage_detected', {
    platform: platform.key,
    kind: platform.kind,
    category: platform.category,
    stage,
    signal: reading.signal,
    advanced,
    isNew: !existing,
    notify: options.notify,
  })

  // A detection the candidate already said was wrong keeps updating its
  // row (so it can be restored accurately) but earns nothing.
  if (activity.dismissedAt) return { platformKey: platform.key, stage }

  // Listed marketplaces keep their "I created a profile" checkbox in sync.
  if (platform.kind === 'WORK' && options.interimListingDomainMap) {
    const listing = platform.domains.map((d) => options.interimListingDomainMap!.get(d)).find(Boolean)
    if (listing) await markInterimMarketplaceSignupCore(candidateId, listing.id, 'GMAIL_DETECTED', { awardPoints: options.awardPoints })
  }

  if (platform.kind === 'LEARNING') {
    await syncCourseCatalogActivity(candidateId, platform, email, reading.stage, completedTitle)
  }

  // A weak sign-up (marketing mail only) never earns a badge by itself;
  // the platform's first explicit email does, with the date of that email.
  const explicitlyProven = progress || existing?.lastProgressAt
  if (explicitlyProven) await awardMilestones(candidateId, platform, newStage, email.emailDate, options)
  return { platformKey: platform.key, stage }
}

async function awardMilestones(
  candidateId: string,
  platform: PlatformEntry,
  stage: PlatformStageKey,
  emailDate: Date,
  options: TrackOptions,
): Promise<void> {
  const reached = milestonesForStage(platform.kind, stage)
  const keys = reached.map((m) => platformBadgeKey(platform.key, m))
  const have = new Set(
    (await prisma.milestoneBadge.findMany({ where: { candidateId, badgeKey: { in: keys } }, select: { badgeKey: true } }))
      .map((b) => b.badgeKey),
  )
  const fresh = reached.filter((m) => !have.has(platformBadgeKey(platform.key, m)))
  if (fresh.length === 0) return

  const congratulate = options.notify && Date.now() - emailDate.getTime() < CONGRATULATE_WITHIN_MS
  if (congratulate) {
    await persistMilestoneBadgesAndNotify(
      candidateId,
      fresh.map((m) => ({ badgeKey: platformBadgeKey(platform.key, m), label: platformBadgeLabel(platformBadgeKey(platform.key, m))! })),
    )
  } else {
    await prisma.milestoneBadge.createMany({
      data: fresh.map((m) => ({ candidateId, badgeKey: platformBadgeKey(platform.key, m), earnedAt: emailDate, notifiedAt: new Date() })),
      skipDuplicates: true,
    })
  }
  captureServerEvent(candidateId, 'platform_milestone_earned', {
    platform: platform.key,
    kind: platform.kind,
    milestones: fresh,
    congratulated: congratulate,
  })

  if (!options.awardPoints) return
  for (const m of fresh) {
    let actionType = POINTS_ACTION[m]
    let text = platformBadgeLabel(platformBadgeKey(platform.key, m))!
    if (m === 'FIRST_STEP') {
      // Listed marketplaces already earned this through
      // markInterimMarketplaceSignupCore above.
      if (platform.kind === 'WORK') {
        const listed = platform.domains.some((d) => options.interimListingDomainMap?.has(d))
        if (listed) continue
        actionType = 'INTERIM_PROFILE_CREATED'
        text = `Created a profile on ${platform.name}`
      } else {
        actionType = 'COURSE_ENROLLED'
      }
    }
    if (!actionType) continue
    const effort = estimateActionEffort({ actionType })
    await logCatalogAction(candidateId, { text, actionType, points: effort.points, estimatedMinutes: effort.minutes, recurring: false })
      .catch((error) => console.error('Failed to log platform milestone action:', error))
  }
}

// ── Course catalog (the Learning page's per-course status pills) ─────────

// Course titles are admin-editable (the Course table), so re-read per
// call — this only runs for a learning platform's enrollment/completion
// email, which is rare.
async function findCatalogTitleInText(text: string): Promise<string | null> {
  const catalogTitles = await getAllCourseTitles()
  const lower = text.toLowerCase()
  return catalogTitles.find((title) => lower.includes(title.toLowerCase())) ?? null
}

async function syncCourseCatalogActivity(
  candidateId: string,
  platform: PlatformEntry,
  email: PlatformEmail,
  stage: PlatformStageKey | null,
  completedTitle: string | null,
): Promise<void> {
  if (stage === 'COMPLETED' && completedTitle) {
    await markCourseCompleted(candidateId, completedTitle, platform, email.emailDate)
  } else if (stage === 'ENROLLED') {
    const title = await findCatalogTitleInText(`${email.subject} ${email.body}`)
    if (title) {
      await prisma.candidateCourseActivity.upsert({
        where: { candidateId_courseTitle: { candidateId, courseTitle: title } },
        create: { candidateId, courseTitle: title, provider: platform.name, status: 'ENROLLED' },
        update: {},
      })
      captureServerEvent(candidateId, 'learning_course_enrolled', { title, provider: platform.name, source: 'email' })
    }
  }
}

// LearningBadge is what the Executive Dossier and the Learning page's
// "What you've completed" list read.
async function markCourseCompleted(candidateId: string, title: string, platform: PlatformEntry, completedAt: Date): Promise<void> {
  await prisma.candidateCourseActivity.upsert({
    where: { candidateId_courseTitle: { candidateId, courseTitle: title } },
    create: { candidateId, courseTitle: title, provider: platform.name, status: 'COMPLETED' },
    update: { status: 'COMPLETED', provider: platform.name, detectedAt: new Date() },
  })

  const existing = await prisma.learningBadge.findFirst({ where: { candidateId, title } })
  if (existing) return
  const badgeType = platform.category === 'PRO_CERT' || platform.category === 'CREDENTIAL_SERVICE' ? 'certification' : 'course_completed'
  await prisma.learningBadge.create({
    data: { candidateId, title, provider: platform.name, badgeType, completedAt },
  })
  captureServerEvent(candidateId, 'learning_recommendation_completed', { title, provider: platform.name, source: 'email' })
  try {
    await applyLearningClosesBarrierRewrite(candidateId)
  } catch (error) {
    console.error('Failed to apply learning-closes-barrier baseline rewrite:', error)
  }
}
