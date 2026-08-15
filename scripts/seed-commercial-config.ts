// Seeds the Phase 3 commercial-management defaults: CoachRateCard default
// rates (§A2.5) and PlanCatalogEntry rows for every published plan (§A2.2,
// §A2.3, §A2.4). Safe to re-run — skips any (sessionType, coachId: null) or
// (planKey) combo that already has at least one row, so it never inserts a
// second "first version" once an admin has started editing history.
//
// Run: npm run seed:commercial-config

import { PrismaClient } from '@prisma/client'
import type { CoachSessionType, PlanCatalogCategory, PlanBillingPeriod } from '@prisma/client'

const prisma = new PrismaClient()

const SEED_ACTOR = 'system:seed-commercial-config'
const EFFECTIVE_DATE = new Date('2026-01-01T00:00:00Z')

// Partners Master Build Script §A2.5.
const RATE_CARD_DEFAULTS: { sessionType: CoachSessionType; rateCents: number }[] = [
  { sessionType: 'STANDARD', rateCents: 11000 },
  { sessionType: 'EXECUTIVE_BAND', rateCents: 15000 },
  { sessionType: 'MOCK_INTERVIEW_90', rateCents: 17500 },
  { sessionType: 'RESUME_REVIEW', rateCents: 8500 },
  { sessionType: 'INTAKE', rateCents: 13000 },
]

interface SeedPlan {
  planKey: string
  name: string
  category: PlanCatalogCategory
  priceCents: number
  billingPeriod: PlanBillingPeriod
  termMonths: number | null
  features: string[]
}

// §A2.2 outplacement, §A2.3 direct-to-consumer, §A2.4 membership.
const PLAN_DEFAULTS: SeedPlan[] = [
  {
    planKey: 'outplacement_core',
    name: 'Outplacement — Core',
    category: 'OUTPLACEMENT',
    priceCents: 89500,
    billingPeriod: 'ONE_TIME',
    termMonths: 6,
    features: ['Resume Studio + ATS matrix', 'Full Dossier', 'Standard recruiter intros', 'Basic Market Intelligence', 'Interim & fractional boards + playbook'],
  },
  {
    planKey: 'outplacement_plus',
    name: 'Outplacement — Plus',
    category: 'OUTPLACEMENT',
    priceCents: 245000,
    billingPeriod: 'ONE_TIME',
    termMonths: 6,
    features: ['6 coaching sessions', '1 human resume review', 'Full Dossier', 'Standard recruiter intros', 'Standard Market Intelligence', 'Curated interim & fractional openings'],
  },
  {
    planKey: 'outplacement_premium',
    name: 'Outplacement — Premium',
    category: 'OUTPLACEMENT',
    priceCents: 745000,
    billingPeriod: 'ONE_TIME',
    termMonths: 12,
    features: [
      '12 coaching sessions + named coach, 48h response',
      'Unlimited resume reviews, all versions',
      'Full Dossier',
      'Dedicated recruiter relationship',
      'Full Market Intelligence',
      'Direct interim & fractional introductions',
      'Private cohort workspace + coworking stipend',
      'Board search, fractional CRO/CFO track, advisory placement',
    ],
  },
  {
    planKey: 'dtc_free',
    name: 'Direct-to-consumer — Free',
    category: 'DIRECT_TO_CONSUMER',
    priceCents: 0,
    billingPeriod: 'NONE',
    termMonths: null,
    features: ['Market Reality Report', 'Resume Studio', 'Job matching', 'Community', 'Company pages'],
  },
  {
    planKey: 'dtc_resume',
    name: 'Direct-to-consumer — Resume',
    category: 'DIRECT_TO_CONSUMER',
    priceCents: 9900,
    billingPeriod: 'ONE_TIME',
    termMonths: null,
    features: ['Everything in Free', 'One human resume review', 'Unlimited versions', 'Per-job tailoring', 'Full ATS matrix'],
  },
  {
    planKey: 'dtc_coaching_plus',
    name: 'Direct-to-consumer — Coaching Plus',
    category: 'DIRECT_TO_CONSUMER',
    priceCents: 29900,
    billingPeriod: 'MONTHLY',
    termMonths: null,
    features: ['2 sessions/month', 'Resume review included', 'Priority support'],
  },
  {
    planKey: 'dtc_coaching_premium',
    name: 'Direct-to-consumer — Coaching Premium',
    category: 'DIRECT_TO_CONSUMER',
    priceCents: 59900,
    billingPeriod: 'MONTHLY',
    termMonths: null,
    features: ['4 sessions/month', 'Mock interviews with recorded feedback', 'Negotiation support at offer stage', 'Named coach'],
  },
  {
    planKey: 'membership_alumni',
    name: 'Membership — Alumni (free)',
    category: 'MEMBERSHIP',
    priceCents: 0,
    billingPeriod: 'NONE',
    termMonths: null,
    features: ['Dossier stays live', 'Remain an insider', 'Give references', 'Refer others', 'Quarterly market pulse'],
  },
  {
    planKey: 'membership_monthly',
    name: 'Membership — monthly',
    category: 'MEMBERSHIP',
    priceCents: 1900,
    billingPeriod: 'MONTHLY',
    termMonths: null,
    features: ['Annual Dossier refresh', 'Quarterly market check with comp benchmarking', 'Network maintenance nudges', 'Benefits Network', 'Board and advisory listings', 'Priority coach booking', 'Break-glass reactivation'],
  },
  {
    planKey: 'membership_annual',
    name: 'Membership — annual',
    category: 'MEMBERSHIP',
    priceCents: 18000,
    billingPeriod: 'ANNUAL',
    termMonths: null,
    features: ['Annual Dossier refresh', 'Quarterly market check with comp benchmarking', 'Network maintenance nudges', 'Benefits Network', 'Board and advisory listings', 'Priority coach booking', 'Break-glass reactivation'],
  },
]

async function main() {
  let ratesCreated = 0
  for (const { sessionType, rateCents } of RATE_CARD_DEFAULTS) {
    const existing = await prisma.coachRateCard.findFirst({ where: { sessionType, coachId: null } })
    if (existing) continue
    await prisma.coachRateCard.create({
      data: { sessionType, rateCents, effectiveDate: EFFECTIVE_DATE, coachId: null, createdBy: SEED_ACTOR },
    })
    ratesCreated++
  }
  console.log(`Rate card: ${ratesCreated} default row(s) created (${RATE_CARD_DEFAULTS.length - ratesCreated} already existed).`)

  let plansCreated = 0
  for (const plan of PLAN_DEFAULTS) {
    const existing = await prisma.planCatalogEntry.findFirst({ where: { planKey: plan.planKey } })
    if (existing) continue
    await prisma.planCatalogEntry.create({
      data: {
        planKey: plan.planKey,
        name: plan.name,
        category: plan.category,
        priceCents: plan.priceCents,
        billingPeriod: plan.billingPeriod,
        termMonths: plan.termMonths,
        features: plan.features,
        effectiveDate: EFFECTIVE_DATE,
        active: true,
        createdBy: SEED_ACTOR,
      },
    })
    plansCreated++
  }
  console.log(`Plan catalog: ${plansCreated} plan(s) created (${PLAN_DEFAULTS.length - plansCreated} already existed).`)

  const coachingSettings = await prisma.coachingSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  })
  console.log(`Coaching settings singleton: ${coachingSettings.id}`)

  const recruiterSettings = await prisma.recruiterSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  })
  console.log(`Recruiter settings singleton: ${recruiterSettings.id}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
