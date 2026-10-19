import { describe, it, expect } from 'vitest'
import { analyzeExperience, levelIndexOf, type ExperienceInput } from '@/lib/reports/market-reality-brief/experience'
import { buildEffortPlan, competitivenessFor, INTERVIEWS_PER_OFFER, PLAN_WEEKS } from '@/lib/reports/market-reality-brief/effort-plan'
import { buildPriorities, MAX_PRIORITIES, type PrioritySignals } from '@/lib/reports/market-reality-brief/priorities'

const asOf = new Date('2026-10-17T12:00:00Z')
const d = (y: number, m: number) => new Date(Date.UTC(y, m - 1, 1))

type Role = ExperienceInput['workHistory'][number]
const role = (title: string, start: Date, end: Date | null, extra: Partial<Role> = {}): Role => ({
  companyName: `Co ${title} ${start.getUTCFullYear()}`,
  roleTitle: title,
  startDate: start,
  endDate: end,
  isCurrent: end === null,
  departureReason: null,
  engagementType: 'FULL_TIME',
  teamSize: null,
  ...extra,
})
const run = (workHistory: Role[], over: Partial<ExperienceInput> = {}) =>
  analyzeExperience({ workHistory, education: [], targetRole: null, highestLevelReached: null, asOf, ...over })
const finding = (a: ReturnType<typeof run>, key: string) => a.findings.find((f) => f.key === key)

describe('analyzeExperience', () => {
  it('does not assess a history with fewer than two roles', () => {
    const a = run([role('Director of Finance', d(2020, 1), null)])
    expect(a.assessable).toBe(false)
    expect(a.findings).toEqual([])
  })

  it('reads a long, steady history as a strength on tenure and gaps', () => {
    const a = run([
      role('Analyst', d(2010, 1), d(2014, 1)),
      role('Manager of Finance', d(2014, 2), d(2019, 6)),
      role('Director of Finance', d(2019, 7), null),
    ])
    expect(finding(a, 'tenure')?.assessment).toBe('strength')
    expect(finding(a, 'gaps')?.assessment).toBe('strength')
    expect(finding(a, 'progression')?.assessment).toBe('strength')
    expect(a.developmentCount).toBe(0)
  })

  it('flags a pattern of short unexplained stints', () => {
    const a = run([
      role('Director of Sales', d(2019, 1), d(2019, 8)),
      role('Director of Sales', d(2019, 9), d(2020, 5)),
      role('Director of Sales', d(2020, 6), d(2021, 2)),
      role('Director of Sales', d(2021, 3), null),
    ])
    expect(finding(a, 'tenure')?.assessment).toBe('development')
    expect(a.openQuestions).toBeGreaterThan(0)
  })

  it('does not count a short stint that ended in a layoff as unexplained', () => {
    const a = run([
      role('Director of Sales', d(2015, 1), d(2020, 1)),
      role('Director of Sales', d(2020, 2), d(2020, 9), { departureReason: 'COMPANY_WIDE_LAYOFF' }),
      role('Director of Sales', d(2020, 10), null),
    ])
    expect(finding(a, 'tenure')?.assessment).not.toBe('development')
    expect(finding(a, 'tenure')?.measure).toMatch(/reason on file/)
  })

  it('does not count interim or fractional work as a short stint, and lets it cover a gap', () => {
    const a = run([
      role('CFO', d(2015, 1), d(2022, 1)),
      role('Interim CFO', d(2022, 2), d(2022, 8), { engagementType: 'INTERIM' }),
      role('CFO', d(2022, 9), null),
    ])
    expect(finding(a, 'tenure')?.assessment).toBe('strength')
    expect(finding(a, 'gaps')?.assessment).toBe('strength')
  })

  it('flags an unexplained gap of six months or more', () => {
    const a = run([role('Manager', d(2016, 1), d(2022, 1)), role('Director', d(2022, 10), null)])
    const gaps = finding(a, 'gaps')
    expect(gaps?.assessment).toBe('development')
    expect(gaps?.measure).toMatch(/9 months/)
  })

  it('treats a gap covered by a leave on file as explained', () => {
    const a = run([
      role('Manager', d(2016, 1), d(2022, 1), { departureReason: 'CAREGIVER_LEAVE' }),
      role('Director', d(2022, 10), null),
    ])
    expect(finding(a, 'gaps')?.assessment).toBe('adequate')
  })

  it('does not invent a gap where roles overlap', () => {
    const a = run([
      role('Director', d(2016, 1), d(2024, 1)),
      role('Advisor', d(2018, 1), d(2019, 1)),
      role('Director', d(2024, 2), null),
    ])
    expect(finding(a, 'gaps')?.assessment).toBe('strength')
  })

  it('flags being out of work for six months or more now', () => {
    const a = run([role('Manager', d(2015, 1), d(2020, 1)), role('Director', d(2020, 2), d(2026, 1))])
    const gaps = finding(a, 'gaps')
    expect(gaps?.assessment).toBe('development')
    expect(gaps?.measure).toMatch(/not currently in a role/)
  })

  it('asks for scope numbers when titles climb fast and nothing backs them', () => {
    const a = run([role('Analyst', d(2019, 1), d(2020, 6)), role('Director of Finance', d(2020, 7), null)])
    const p = finding(a, 'progression')
    expect(p?.assessment).toBe('development')
    expect(p?.action).toMatch(/team size|budget/)
  })

  it('reads fast progression as adequate when the scope is on the page', () => {
    const a = run([role('Analyst', d(2019, 1), d(2020, 6), { teamSize: 1 }), role('Director of Finance', d(2020, 7), null, { teamSize: 25 })])
    expect(finding(a, 'progression')?.assessment).toBe('adequate')
  })

  it('flags a step down inside five years', () => {
    const a = run([role('VP of Sales', d(2014, 1), d(2023, 1)), role('Manager of Sales', d(2023, 2), null)])
    expect(finding(a, 'progression')?.measure).toMatch(/down in level/)
  })

  it('flags a decade at one level when the target is higher', () => {
    const a = run(
      [role('Manager of Ops', d(2008, 1), d(2014, 1)), role('Senior Manager of Ops', d(2014, 2), d(2019, 1)), role('Manager of Ops', d(2019, 2), null)],
      { targetRole: 'Director of Operations' }
    )
    expect(finding(a, 'plateau')?.assessment).toBe('development')
  })

  it('compares the target level with the highest level held', () => {
    const history = [role('Manager of Ops', d(2012, 1), d(2018, 1)), role('Manager of Ops', d(2018, 2), null)]
    expect(finding(run(history, { targetRole: 'VP of Operations' }), 'level_fit')?.assessment).toBe('development')
    expect(finding(run(history, { targetRole: 'Manager of Operations' }), 'level_fit')?.assessment).toBe('strength')
    expect(finding(run(history, { targetRole: 'Analyst' }), 'level_fit')?.assessment).toBe('adequate')
  })

  it('reads industry breadth only when most roles carry an industry', () => {
    const roles = [
      role('Director', d(2018, 1), d(2020, 1), { companyIndustry: 'Healthcare' }),
      role('Director', d(2020, 2), d(2022, 1), { companyIndustry: 'Banking' }),
      role('Director', d(2022, 2), d(2024, 1), { companyIndustry: 'Retail' }),
      role('Director', d(2024, 2), null, { companyIndustry: 'Energy' }),
    ]
    expect(finding(run(roles), 'industry')?.assessment).toBe('development')
    expect(finding(run(roles), 'industry')?.measure).toMatch(/4 industries/)
    expect(finding(run(roles.map((r) => ({ ...r, companyIndustry: null }))), 'industry')).toBeUndefined()
  })

  it('leaves internships out of every count', () => {
    const a = run([role('Marketing Intern', d(2010, 1), d(2010, 6)), role('Director', d(2012, 1), null), role('Manager', d(2008, 1), d(2011, 12))])
    expect(a.roleCount).toBe(2)
  })

  it('lists the most recent roles first', () => {
    const a = run([role('Analyst', d(2010, 1), d(2014, 1)), role('Director', d(2014, 2), null)])
    expect(a.timeline[0].title).toBe('Director')
    expect(a.timeline[0].period).toMatch(/Present$/)
  })
})

describe('levelIndexOf', () => {
  it('reads level words and titles', () => {
    expect(levelIndexOf('Director')).toBe(2)
    expect(levelIndexOf('VP of Sales')).toBe(3)
    expect(levelIndexOf(null)).toBe(-1)
  })
})

describe('buildEffortPlan', () => {
  const plan = buildEffortPlan({ perAttemptProbability: 0.02, networkingWeight: 4, applicationsPerWeek: 4, conversationsPerWeek: 1 })

  it('turns the per-attempt estimate into applications and conversations per interview', () => {
    expect(plan.applicationsPerInterview).toBe(50)
    expect(plan.conversationsPerInterview).toBe(13)
  })

  it('sizes each route to the interviews needed over the plan window', () => {
    const apps = plan.routes.find((r) => r.key === 'applications')!
    expect(apps.applications).toBe(INTERVIEWS_PER_OFFER * 50)
    expect(apps.applicationsPerWeek).toBe(Math.ceil((INTERVIEWS_PER_OFFER * 50) / PLAN_WEEKS))
    const net = plan.routes.find((r) => r.key === 'networking')!
    expect(net.applications).toBe(0)
    expect(net.conversations).toBe(INTERVIEWS_PER_OFFER * 13)
    const mixed = plan.routes.find((r) => r.key === 'balanced')!
    expect(mixed.applications).toBe(Math.ceil(2.5 * 50))
    expect(mixed.conversations).toBe(Math.ceil(2.5 * 13))
  })

  it('projects interviews at the current pace, weighting conversations', () => {
    // 12 weeks x (4 x 0.02 + 1 x 0.02 x 4) = 1.92
    expect(plan.pace.expectedInterviews).toBe(1.9)
    expect(plan.pace.coverage).toBeCloseTo(1.92 / INTERVIEWS_PER_OFFER, 5)
    expect(plan.pace.activityObserved).toBe(true)
  })

  it('reports no activity when nothing was done', () => {
    const idle = buildEffortPlan({ perAttemptProbability: 0.05, networkingWeight: 4, applicationsPerWeek: 0, conversationsPerWeek: 0 })
    expect(idle.pace.activityObserved).toBe(false)
    expect(idle.pace.coverage).toBe(0)
  })

  it('never asks for fewer than one application per interview', () => {
    expect(buildEffortPlan({ perAttemptProbability: 1, networkingWeight: 4, applicationsPerWeek: 0, conversationsPerWeek: 0 }).conversationsPerInterview).toBe(1)
  })
})

describe('competitivenessFor', () => {
  it('bands applications per interview', () => {
    expect(competitivenessFor(8).key).toBe('favorable')
    expect(competitivenessFor(20).key).toBe('moderate')
    expect(competitivenessFor(60).key).toBe('competitive')
    expect(competitivenessFor(300).key).toBe('highly_competitive')
  })
})

describe('buildPriorities', () => {
  const quiet: PrioritySignals = {
    resume: null,
    experience: null,
    unansweredReviewerQuestions: 0,
    effort: null,
    market: null,
    skills: null,
    unconfirmedProfileItems: 0,
    searchStrategyIncomplete: false,
    pivotsRecommended: false,
  }

  it('returns nothing when nothing is flagged', () => {
    expect(buildPriorities(quiet)).toEqual([])
  })

  it('puts a search that has not started first', () => {
    const out = buildPriorities({
      ...quiet,
      resume: { topFix: { dimension: 'Quantification', fix: 'Add numbers.', gain: 10 }, fixCount: 3 },
      effort: { coverage: 0, activityObserved: false, conversationsPerWeek: 0, balancedConversationsPerWeek: 3, balancedApplicationsPerWeek: 8 },
    })
    expect(out[0].key).toBe('start_activity')
    expect(out[0].title).toMatch(/3 conversations and 8 applications/)
    expect(out.map((p) => p.key)).toContain('fix_resume')
  })

  it('recommends widening a thin market and narrowing a crowded one', () => {
    const thin = buildPriorities({ ...quiet, market: { prompt: 'too_few', openRoles: 12, widest: { label: 'Finance, any industry', openRoles: 400 } } })
    expect(thin[0].key).toBe('widen_market')
    expect(thin[0].title).toMatch(/400/)
    const wide = buildPriorities({ ...quiet, market: { prompt: 'too_many', openRoles: 2000, widest: null } })
    expect(wide[0].key).toBe('narrow_market')
    expect(buildPriorities({ ...quiet, market: { prompt: 'healthy', openRoles: 200, widest: null } })).toEqual([])
  })

  it('keeps pivots out unless recommended', () => {
    expect(buildPriorities({ ...quiet, pivotsRecommended: false }).some((p) => p.key === 'consider_pivots')).toBe(false)
    expect(buildPriorities({ ...quiet, pivotsRecommended: true }).some((p) => p.key === 'consider_pivots')).toBe(true)
  })

  it('caps the list and orders it by weight', () => {
    const out = buildPriorities({
      resume: { topFix: { dimension: 'Narrative & Positioning', fix: 'Add a target line.', gain: 20 }, fixCount: 5 },
      experience: { openQuestions: 2 },
      unansweredReviewerQuestions: 2,
      effort: { coverage: 0.2, activityObserved: true, conversationsPerWeek: 0, balancedConversationsPerWeek: 3, balancedApplicationsPerWeek: 8 },
      market: { prompt: 'shrinking', openRoles: 90, widest: null },
      skills: { topAiGap: { term: 'Prompt design', employers: 8, of: 12 } },
      unconfirmedProfileItems: 3,
      searchStrategyIncomplete: true,
      pivotsRecommended: true,
    })
    expect(out[0].key).toBe('complete_search_strategy')
    expect(out.length).toBe(MAX_PRIORITIES)
    expect(out.map((p) => p.weight)).toEqual([...out.map((p) => p.weight)].sort((a, b) => b - a))
  })
})

// ── Evaluator views, objections, launchpad ─────────────────────────────────

import { buildEvaluatorViews, buildObjections, type EvaluatorInput } from '@/lib/reports/market-reality-brief/evaluators'
import { buildLaunchpad, firstStep, type LaunchpadInput } from '@/lib/reports/market-reality-brief/launchpad'

const cleanHistory = () =>
  run([role('Analyst', d(2010, 1), d(2014, 1)), role('Manager of Finance', d(2014, 2), d(2019, 6)), role('Director of Finance', d(2019, 7), null)])
const shaky = () =>
  run(
    [
      role('Director of Sales', d(2019, 1), d(2019, 8)),
      role('Director of Sales', d(2019, 9), d(2020, 5)),
      role('Director of Sales', d(2020, 6), d(2021, 2)),
      role('Director of Sales', d(2021, 3), null),
    ],
    { targetRole: 'VP of Sales' }
  )
const evalInput = (over: Partial<EvaluatorInput> = {}): EvaluatorInput => ({
  targetRole: 'Director of Finance',
  experience: cleanHistory(),
  firstGlance: 'PASS',
  firstGlanceTopFix: null,
  dims: { quantification: 80, scopeLevel: 80, relevanceRecency: 80, skillCurrency: 80, narrativePositioning: 80 },
  ai: null,
  conversationsPerWeek: 3,
  marketPrompt: 'healthy',
  payFloor: null,
  ...over,
})
const view = (v: ReturnType<typeof buildEvaluatorViews>, key: string) => v.find((x) => x.key === key)!

describe('buildEvaluatorViews', () => {
  it('returns the three readers', () => {
    expect(buildEvaluatorViews(evalInput()).map((v) => v.key)).toEqual(['recruiter', 'hiring_manager', 'executive_recruiter'])
  })

  it('advances a clean, quantified record', () => {
    for (const v of buildEvaluatorViews(evalInput())) expect(v.stance).toBe('advance')
  })

  it('pauses the recruiter on a skip-level first glance with unexplained short stints', () => {
    const v = view(buildEvaluatorViews(evalInput({ experience: shaky(), firstGlance: 'LIKELY_SKIP' })), 'recruiter')
    expect(v.stance).toBe('pause')
    expect(v.thinking.join(' ')).toMatch(/short stints/)
  })

  it('has the hiring manager discount results with no numbers', () => {
    const v = view(buildEvaluatorViews(evalInput({ dims: { quantification: 30, scopeLevel: 40, relevanceRecency: 50, skillCurrency: 50 } })), 'hiring_manager')
    expect(v.stance).toBe('pause')
    expect(v.thinking.join(' ')).toMatch(/size what this person ran/)
    expect(v.changesMind.join(' ')).toMatch(/number/)
  })

  it('caps the hiring manager at reservations when the target level has not been held', () => {
    const v = view(buildEvaluatorViews(evalInput({ experience: shaky() })), 'hiring_manager')
    expect(v.stance).not.toBe('advance')
  })

  it('has the executive recruiter weigh stability, story and network', () => {
    const v = view(buildEvaluatorViews(evalInput({ experience: shaky(), conversationsPerWeek: 0, marketPrompt: 'too_few' })), 'executive_recruiter')
    expect(v.stance).toBe('pause')
    expect(v.thinking.join(' ')).toMatch(/no visible network/)
    expect(v.thinking.join(' ')).toMatch(/filled by introduction/)
  })

  it('asks about the AI gap only when employers ask and the profile shows none', () => {
    const gap = view(buildEvaluatorViews(evalInput({ ai: { employersAsking: 5, of: 8, haveAny: false } })), 'hiring_manager')
    expect(gap.questions.join(' ')).toMatch(/AI/)
    const fine = view(buildEvaluatorViews(evalInput({ ai: { employersAsking: 5, of: 8, haveAny: true } })), 'hiring_manager')
    expect(fine.questions.join(' ')).not.toMatch(/AI/)
  })

  it('quotes the pay floor in the questions only when one is set', () => {
    expect(view(buildEvaluatorViews(evalInput({ payFloor: 250000 })), 'recruiter').questions.join(' ')).toMatch(/\$250,000/)
    expect(view(buildEvaluatorViews(evalInput()), 'recruiter').questions.join(' ')).not.toMatch(/\$/)
  })
})

describe('buildObjections', () => {
  it('lists nothing for a clean record', () => {
    expect(buildObjections(evalInput())).toEqual([])
  })

  it('turns findings into questions with an answer structure, heaviest first', () => {
    const o = buildObjections(evalInput({ experience: shaky(), dims: { quantification: 30, narrativePositioning: 30 }, ai: { employersAsking: 4, of: 6, haveAny: false } }))
    const keys = o.map((x) => x.key)
    expect(keys).toEqual(expect.arrayContaining(['tenure', 'quantification', 'positioning', 'ai']))
    expect(o.every((x) => x.question && x.answer)).toBe(true)
    expect(o.map((x) => x.severity)).toEqual([...o.map((x) => x.severity)].sort((a, b) => b - a))
    expect(o.find((x) => x.key === 'ai')?.source).toBe('Skills')
  })
})

const launch = (over: Partial<LaunchpadInput> = {}): LaunchpadInput => ({
  mode: 'ACTIVE',
  strategyComplete: false,
  unconfirmedProfileItems: 2,
  hasResume: true,
  resumeFixCount: 3,
  unansweredReviewerQuestions: 1,
  skillsAssessmentDone: false,
  gmailConnected: false,
  completedReferences: 0,
  weekly: { applications: 11, conversations: 3 },
  activityObserved: false,
  topAiGap: 'Prompt design',
  market: { prompt: 'too_few', widest: 'CFO, any industry' },
  pivotsShown: true,
  ...over,
})

describe('buildLaunchpad', () => {
  it('starts a new member with the inputs every estimate reads', () => {
    const steps = buildLaunchpad(launch())
    expect(steps[0].key).toBe('strategy')
    expect(steps[0].phase).toBe('today')
    expect(firstStep(steps)?.key).toBe('strategy')
  })

  it('links every step to a real in-app path and names the tool', () => {
    for (const s of buildLaunchpad(launch())) {
      expect(s.href).toMatch(/^(\/dashboard|#)/)
      expect(s.tool.length).toBeGreaterThan(0)
    }
  })

  it('orders steps by phase', () => {
    const order = ['today', 'this_week', 'weeks_2_4', 'weeks_5_12']
    const idx = buildLaunchpad(launch()).map((s) => order.indexOf(s.phase))
    expect(idx).toEqual([...idx].sort((a, b) => a - b))
  })

  it('skips what is already done and shows progress for what the member has done', () => {
    const steps = buildLaunchpad(launch({ strategyComplete: true, unconfirmedProfileItems: 0, unansweredReviewerQuestions: 0, skillsAssessmentDone: true, gmailConnected: true, completedReferences: 3 }))
    expect(steps.some((s) => s.key === 'strategy' || s.key === 'confirm' || s.key === 'assessment' || s.key === 'gmail')).toBe(false)
    expect(steps.find((s) => s.key === 'references')?.done).toBe(true)
  })

  it('does not offer the job board while the situation keeps it locked, and says what turns it on', () => {
    const apply = buildLaunchpad(launch({ mode: 'EXPLORING' })).find((s) => s.key === 'apply')!
    expect(apply.lockedNote).toMatch(/ready to apply/)
    const open = buildLaunchpad(launch({ mode: 'ACTIVE' })).find((s) => s.key === 'apply')!
    expect(open.lockedNote).toBeNull()
    const steps = buildLaunchpad(launch({ mode: 'EXPLORING', strategyComplete: true, unconfirmedProfileItems: 0, unansweredReviewerQuestions: 0, resumeFixCount: 0, skillsAssessmentDone: true, gmailConnected: true, completedReferences: 3, topAiGap: null, weekly: { applications: 11, conversations: 3 } }))
    expect(firstStep(steps)?.key).not.toBe('apply')
  })

  it('asks for a resume first when none is on file', () => {
    const steps = buildLaunchpad(launch({ hasResume: false, resumeFixCount: 0, strategyComplete: true, unconfirmedProfileItems: 0 }))
    expect(steps[0].key).toBe('resume_upload')
  })

  it('only suggests widening and pivots when the report does', () => {
    const none = buildLaunchpad(launch({ market: { prompt: 'healthy', widest: null }, pivotsShown: false }))
    expect(none.some((s) => s.key === 'widen' || s.key === 'pivot')).toBe(false)
    expect(buildLaunchpad(launch()).some((s) => s.key === 'widen')).toBe(true)
  })
})

// ── Case for you, competency profile, sections ─────────────────────────────

import { buildCaseForYou, type CaseInput } from '@/lib/reports/market-reality-brief/case'
import { buildProfile, ratingFor } from '@/lib/reports/market-reality-brief/profile'
import { APPENDIX_SECTIONS, BODY_SECTIONS, SECTIONS, sectionNumber } from '@/lib/reports/market-reality-brief/sections'

const caseInput = (over: Partial<CaseInput> = {}): CaseInput => ({
  experience: run([role('Manager', d(2008, 1), d(2016, 1), { teamSize: 40 }), role('Director', d(2016, 2), null)], { targetRole: 'Director' }),
  dims: { quantification: 80, narrativePositioning: 80 },
  ai: { employersAsking: 5, of: 8, haveAny: true },
  conversationsPerWeek: 4,
  documentStrengths: [],
  targetRole: 'Director of Finance',
  function: 'Finance',
  yearsExperience: 18,
  ...over,
})

describe('buildCaseForYou', () => {
  it('cites evidence for each item and caps the list at five', () => {
    const c = buildCaseForYou(caseInput({ documentStrengths: [{ title: 'Turnaround', detail: 'Cut close time from 12 days to 6.' }, { title: 'Board', detail: 'Presented to the board quarterly.' }] }))
    expect(c.items.length).toBeLessThanOrEqual(5)
    expect(c.items.every((x) => x.evidence.length > 0 && x.leadWith.length > 0)).toBe(true)
    expect(c.items.map((x) => x.weight)).toEqual([...c.items.map((x) => x.weight)].sort((a, b) => b - a))
  })

  it('reads stability, scale, numbers and network from the record', () => {
    // Six qualify; the list keeps the five heaviest.
    const keys = buildCaseForYou(caseInput()).items.map((x) => x.key)
    expect(keys).toEqual(['numbers', 'scale', 'level', 'network', 'stability'])
  })

  it('never invents a strength: a thin record gives an empty list and no positioning line', () => {
    const c = buildCaseForYou(caseInput({ experience: run([role('Analyst', d(2024, 1), d(2024, 6)), role('Analyst', d(2024, 8), null)]), dims: { quantification: 30, narrativePositioning: 30 }, ai: null, conversationsPerWeek: 0 }))
    expect(c.items).toEqual([])
    expect(c.positioningLine).toBeNull()
  })

  it('drafts a positioning line only from facts on file', () => {
    const c = buildCaseForYou(caseInput())
    expect(c.positioningLine).toMatch(/Director of Finance with 18\+ years in Finance/)
    expect(buildCaseForYou(caseInput({ targetRole: null })).positioningLine).toBeNull()
  })
})

describe('buildProfile', () => {
  it('rates by score and keeps the analysis’s own top finding', () => {
    expect(ratingFor(80)).toBe('strength')
    expect(ratingFor(60)).toBe('adequate')
    expect(ratingFor(20)).toBe('development')
    const groups = buildProfile(
      { quantification: 40, narrativePositioning: 90, scopeLevel: 70 },
      { quantification: [{ candidateFacingCopy: 'Few results carry numbers.', estimatedPointGain: 9 }, { candidateFacingCopy: 'Minor.', estimatedPointGain: 2 }] }
    )
    const rows = groups.flatMap((g) => g.rows)
    expect(rows.find((r) => r.key === 'quantification')).toMatchObject({ assessment: 'development', observation: 'Few results carry numbers.' })
    expect(rows.find((r) => r.key === 'narrativePositioning')?.observation).toBeNull()
  })

  it('returns nothing without scores', () => {
    expect(buildProfile(null, null)).toEqual([])
  })
})

describe('sections', () => {
  it('numbers the body 01.. and lettures the appendix A.. , each once', () => {
    expect(BODY_SECTIONS.map((s) => sectionNumber(s.id))).toEqual(BODY_SECTIONS.map((_, i) => String(i + 1).padStart(2, '0')))
    expect(APPENDIX_SECTIONS.map((s) => sectionNumber(s.id))).toEqual(APPENDIX_SECTIONS.map((_, i) => String.fromCharCode(65 + i)))
    expect(new Set(SECTIONS.map((s) => s.id)).size).toBe(SECTIONS.length)
  })
})

import { buildHiringCase, hiringCaseCounts, type HiringCaseInput } from '@/lib/reports/market-reality-brief/hiring-case'

const hire = (over: Partial<HiringCaseInput> = {}): HiringCaseInput => ({
  experience: run([role('Analyst', d(2010, 1), d(2014, 1)), role('Manager of Finance', d(2014, 2), d(2019, 6)), role('Director of Finance', d(2019, 7), null)], { targetRole: 'Director of Finance', highestLevelReached: 'Director' }),
  dims: { quantification: 80, relevanceRecency: 80, skillCurrency: 80, narrativePositioning: 80, atsLegibility: 80, contactability: 90 },
  hasResume: true,
  targetRole: 'Director of Finance',
  ai: { employersAsking: 5, of: 8, haveAny: true },
  completedReferences: 3,
  skillsAssessmentDone: true,
  linkedInConfirmed: true,
  dossier: { met: 8, total: 10 },
  conversationsPerWeek: 4,
  payFloor: 200000,
  ...over,
})
const reason = (rows: ReturnType<typeof buildHiringCase>, key: string) => rows.find((r) => r.key === key)!

describe('buildHiringCase', () => {
  it('puts every reason in place for a complete member', () => {
    const rows = buildHiringCase(hire())
    expect(rows.length).toBe(13)
    expect(hiringCaseCounts(rows)).toEqual({ in_place: 13, issue: 0, missing: 0, unknown: 0 })
  })

  it('tells a brand-new member what we do not know, not what they lack', () => {
    const rows = buildHiringCase(hire({ hasResume: false, dims: null, targetRole: null, ai: null, completedReferences: 0, skillsAssessmentDone: false, linkedInConfirmed: false, dossier: null, conversationsPerWeek: null, payFloor: null, experience: run([]) }))
    // Nothing is judged without input. The one thing that plainly does not exist yet is references.
    expect(rows.filter((r) => r.status !== 'unknown').map((r) => r.key)).toEqual(['references'])
    expect(reason(rows, 'references').status).toBe('missing')
  })

  it('separates not yet built from needs fixing', () => {
    const rows = buildHiringCase(hire({ completedReferences: 0, conversationsPerWeek: 0, ai: { employersAsking: 5, of: 8, haveAny: false }, dossier: { met: 0, total: 10 } }))
    for (const k of ['references', 'access', 'ai', 'proof']) expect(reason(rows, k).status).toBe('missing')
    const some = buildHiringCase(hire({ completedReferences: 1, conversationsPerWeek: 1, dims: { quantification: 30, relevanceRecency: 80, skillCurrency: 80, narrativePositioning: 30, atsLegibility: 80, contactability: 90 } }))
    for (const k of ['references', 'access', 'results', 'positioning']) expect(reason(some, k).status).toBe('issue')
  })

  it('flags stability when a reviewer would ask', () => {
    expect(reason(buildHiringCase(hire({ experience: shaky() })), 'stability').status).toBe('issue')
  })

  it('sorts gaps first, then what is unknown, then what is in place', () => {
    const rows = buildHiringCase(hire({ completedReferences: 0, payFloor: null, dims: { quantification: 30, relevanceRecency: 80, skillCurrency: 80, narrativePositioning: 80, atsLegibility: 80, contactability: 90 } }))
    const order = { missing: 0, issue: 1, unknown: 2, in_place: 3 }
    const idx = rows.map((r) => order[r.status])
    expect(idx).toEqual([...idx].sort((a, b) => a - b))
  })

  it('links every row to the NextChapter tool that adds, fixes or answers it', () => {
    for (const r of buildHiringCase(hire({ completedReferences: 0, payFloor: null }))) {
      expect(r.tool.length).toBeGreaterThan(0)
      expect(r.href).toMatch(/^(\/dashboard|#)/)
      expect(r.next.length).toBeGreaterThan(0)
    }
  })
})

// ── Overall read, timeline chart data ──────────────────────────────────────

import { buildOverallRead, type NarrativeInput } from '@/lib/reports/market-reality-brief/narrative'

const narr = (over: Partial<NarrativeInput> = {}): NarrativeInput => ({
  experience: cleanHistory(),
  strengths: [{ key: 'a', headline: 'Scale of leadership', evidence: 'Led a team of up to 52.', leadWith: '', weight: 80 }, { key: 'b', headline: 'A steady climb', evidence: 'IC to Director.', leadWith: '', weight: 60 }],
  hiringCase: buildHiringCase(hire({ completedReferences: 0, conversationsPerWeek: 0 })),
  market: { prompt: 'too_few', openRoles: 24, trend: null },
  effort: { applicationsPerInterview: 83, conversationsPerInterview: 21, competitiveness: 'Competitive' },
  topPriority: { title: 'Finish your Search Strategy goals' },
  firstStep: { title: 'Finish your Search Strategy goals' },
  targetRole: 'CFO',
  ...over,
})

describe('buildOverallRead', () => {
  it('reads who you are, what holds it back, the market and what to do first', () => {
    const p = buildOverallRead(narr())
    expect(p).toHaveLength(4)
    expect(p[0]).toMatch(/scale of leadership/i)
    expect(p[1]).toMatch(/references/)
    expect(p[2]).toMatch(/24 open roles/)
    expect(p[3]).toMatch(/finish your search strategy goals/i)
  })

  it('changes with the data rather than repeating a template', () => {
    const strong = buildOverallRead(narr({ hiringCase: buildHiringCase(hire()), market: { prompt: 'healthy', openRoles: 400, trend: null }, effort: { applicationsPerInterview: 12, conversationsPerInterview: 3, competitiveness: 'Favorable' } }))
    expect(strong[1]).toMatch(/All 13 things employers hire for are in place/)
    expect(strong[2]).toMatch(/workable/)
    const thin = buildOverallRead(narr({ strengths: [] }))
    expect(thin[0]).toMatch(/does not yet carry a strength/)
  })

  it('says unknowns are not counted against the member', () => {
    const p = buildOverallRead(narr({ hiringCase: buildHiringCase(hire({ skillsAssessmentDone: false, completedReferences: 0 })) }))
    expect(p[1]).toMatch(/not counted against you/)
  })

  it('skips the market paragraph when the market is not sized', () => {
    expect(buildOverallRead(narr({ market: null, effort: null }))).toHaveLength(3)
  })
})

describe('timeline chart data', () => {
  it('exposes each role and each gap as a span', () => {
    const a = run([role('Manager', d(2016, 1), d(2022, 1)), role('Director', d(2022, 10), null)])
    expect(a.chart.bars).toHaveLength(2)
    expect(a.chart.gaps).toHaveLength(1)
    expect(a.chart.gaps[0].months).toBe(9)
    expect(a.chart.from).toBe(d(2016, 1).getTime())
  })
})
