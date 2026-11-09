import { describe, expect, it } from 'vitest'
import { ACTION_PLAN_PROMPT_SECTION, MAX_PLAN_ITEMS, finalizeActionPlan, packIntoDays, requiredPlanItems, type PlanDay, type PlanFacts, type PlanItem } from '@/lib/reports/action-plan-items'

const nothingDone: PlanFacts = {
  hasResume: false,
  linkedInConfirmed: false,
  linkedInUrlOnFile: false,
  gmailConnected: false,
  targetRoleClear: false,
  profileConfirmed: false,
  industryConfirmed: false,
  functionConfirmed: false,
  salaryAndAuthorizationConfirmed: false,
}
// Everything is done, so the only step left is the standing one: a member with a resume is always asked to apply its fixes (the report's rule is
// "upload a resume, or apply its fixes, never both and never neither").
const allDone: PlanFacts = {
  hasResume: true,
  linkedInConfirmed: true,
  linkedInUrlOnFile: true,
  gmailConnected: true,
  targetRoleClear: true,
  profileConfirmed: true,
  industryConfirmed: true,
  functionConfirmed: true,
  salaryAndAuthorizationConfirmed: true,
}
const days = (...items: PlanItem[]): PlanDay[] => items.map((item, i) => ({ day: i + 1, items: [item] }))
const flat = (plan: PlanDay[]) => plan.flatMap((d) => d.items)
const types = (plan: PlanDay[]) => flat(plan).map((i) => i.actionType)

describe('setup steps the code writes', () => {
  it('lists every step a member who has done nothing needs, in the order they belong', () => {
    expect(requiredPlanItems(nothingDone).map((i) => i.actionType)).toEqual([
      'LINKEDIN_SETUP',
      'GMAIL_CONNECTED',
      'SEARCH_STRATEGY_CHECKLIST',
      'RESUME_UPDATE',
      'PROFILE_CONFIRM',
      'INDUSTRY_CONFIRM',
      'FUNCTION_CONFIRM',
      'SALARY_CONFIRM',
      'WORK_AUTHORIZATION',
    ])
  })

  it('writes each step as a short action name, a dash and a reason, so the UI can link the name', () => {
    for (const item of requiredPlanItems(nothingDone)) {
      const [name, why] = item.text.split(' — ')
      expect(why?.length).toBeGreaterThan(10)
      const words = name.trim().split(/\s+/).length
      expect(words).toBeGreaterThanOrEqual(3)
      expect(words).toBeLessThanOrEqual(6)
    }
  })

  it('asks only for the standing resume step from a member who has done everything else', () => {
    const items = requiredPlanItems(allDone)
    expect(items.map((i) => i.actionType)).toEqual(['RESUME_UPDATE'])
    expect(items[0].text).toMatch(/^Apply your resume fixes/)
  })

  it('asks for a LinkedIn profile, not a confirmation, once the status is confirmed but there is no URL', () => {
    const items = requiredPlanItems({ ...allDone, linkedInUrlOnFile: false })
    expect(items.map((i) => i.actionType)).toEqual(['LINKEDIN_SETUP', 'RESUME_UPDATE'])
    expect(items[0].text).toMatch(/^Create your LinkedIn profile/)
  })

  it('asks to upload a resume when there is none, and to apply the fixes when there is one, never both', () => {
    expect(requiredPlanItems({ ...allDone, hasResume: false })[0].text).toMatch(/^Upload your resume/)
    const withResume = requiredPlanItems({ ...allDone, targetRoleClear: false })
    expect(withResume.map((i) => i.actionType)).toEqual(['SEARCH_STRATEGY_CHECKLIST', 'RESUME_UPDATE'])
    expect(requiredPlanItems({ ...allDone }).some((i) => /^Upload/.test(i.text))).toBe(false)
  })
})

describe('finishing the model plan', () => {
  it('adds the Search Strategy step for a vague target role, near the front (the step both models missed on 2026-11-07)', () => {
    const model = days({ text: 'Add AI evidence to your resume — it is the skill employers ask for.', actionType: 'RESUME_UPDATE' }, { text: 'Prep your step-down answer — a recruiter will ask.', actionType: 'INTERVIEW_PREP' })
    const { days: plan, stats } = finalizeActionPlan(model, { ...allDone, targetRoleClear: false })
    expect(types(plan)[0]).toBe('SEARCH_STRATEGY_CHECKLIST')
    expect(stats.added).toBe(1)
  })

  it('removes a tag from an item about something else instead of linking the member to the wrong page', () => {
    const model = days({ text: 'Add a job posting for fit feedback — one real listing shows the gap.', actionType: 'SEARCH_STRATEGY_CHECKLIST' })
    const { days: plan, stats } = finalizeActionPlan(model, { ...allDone, targetRoleClear: false })
    const fit = flat(plan).find((i) => /job posting/.test(i.text))
    expect(fit).toEqual({ text: 'Add a job posting for fit feedback — one real listing shows the gap.' })
    expect(flat(plan).filter((i) => i.actionType === 'SEARCH_STRATEGY_CHECKLIST')).toHaveLength(1)
    expect(stats.untagged).toBe(1)
  })

  it('drops networking, outreach, posting and Search Sprint items, by tag or by wording', () => {
    const model = days(
      { text: 'Build your 25-person networking list — warm intros surface roles.', actionType: 'NETWORKING_LIST' },
      { text: 'Ask one person for help — one real outreach beats a long list.', actionType: 'OUTREACH_MESSAGE' },
      { text: 'Post once on LinkedIn — visibility compounds.', actionType: 'LINKEDIN_POST_IDEA' },
      { text: 'Commit to your first Search Sprint — it sets your weekly goal.' },
      { text: 'Rewrite your summary line — it should name your level.', actionType: 'RESUME_UPDATE' }
    )
    const { days: plan, stats } = finalizeActionPlan(model, allDone)
    expect(flat(plan).map((i) => i.text)).toEqual(['Rewrite your summary line — it should name your level.'])
    expect(stats.droppedOutOfScope).toBe(4)
  })

  it('drops a setup step the member has already done', () => {
    const model = days({ text: 'Connect your Gmail — it tracks invites for you.', actionType: 'GMAIL_CONNECTED' }, { text: 'Rewrite your summary line — it should name your level.', actionType: 'RESUME_UPDATE' })
    const { days: plan, stats } = finalizeActionPlan(model, allDone)
    expect(types(plan)).not.toContain('GMAIL_CONNECTED')
    expect(stats.droppedRedundant).toBe(1)
  })

  it('uses the model\'s own wording for a setup step it did write, and moves it into place', () => {
    const model = days({ text: 'Add AI evidence to your resume — employers ask for it.', actionType: 'RESUME_UPDATE' }, { text: 'Connect your Gmail account — invites and rejections track themselves.', actionType: 'GMAIL_CONNECTED' })
    const { days: plan, stats } = finalizeActionPlan(model, { ...allDone, gmailConnected: false })
    expect(flat(plan)[0]).toEqual({ text: 'Connect your Gmail account — invites and rejections track themselves.', actionType: 'GMAIL_CONNECTED' })
    // Gmail, and the resume step the model's own "Add AI evidence" item satisfies.
    expect(stats).toMatchObject({ required: 2, writtenByModel: 2, added: 0 })
  })

  it('puts the foundation (LinkedIn, Gmail, Search Strategy, resume) ahead of everything else, then the confirmations, then the model\'s items', () => {
    const model = days({ text: 'Add a job posting for fit feedback — it shows the gap.' }, { text: 'Prep your step-down answer — a recruiter will ask.', actionType: 'INTERVIEW_PREP' })
    const { days: plan } = finalizeActionPlan(model, nothingDone)
    expect(types(plan).slice(0, 9)).toEqual(['LINKEDIN_SETUP', 'GMAIL_CONNECTED', 'SEARCH_STRATEGY_CHECKLIST', 'RESUME_UPDATE', 'PROFILE_CONFIRM', 'INDUSTRY_CONFIRM', 'FUNCTION_CONFIRM', 'SALARY_CONFIRM', 'WORK_AUTHORIZATION'])
    expect(flat(plan).slice(9).map((i) => i.text)).toEqual(['Add a job posting for fit feedback — it shows the gap.', 'Prep your step-down answer — a recruiter will ask.'])
  })

  it('counts any specific resume change the model wrote as the resume step, and keeps its other resume items after the setup', () => {
    const model = days({ text: 'Add AI evidence to your resume — employers ask for it.', actionType: 'RESUME_UPDATE' }, { text: 'Rewrite your summary line — it should name your level.', actionType: 'RESUME_UPDATE' })
    const { days: plan, stats } = finalizeActionPlan(model, { ...allDone, targetRoleClear: false })
    expect(flat(plan).map((i) => i.text)).toEqual([
      expect.stringMatching(/^Fill in your Search Strategy/),
      'Add AI evidence to your resume — employers ask for it.',
      'Rewrite your summary line — it should name your level.',
    ])
    expect(stats.added).toBe(1)
  })

  it('keeps the setup steps and cuts the model\'s last items when the plan would be too long', () => {
    const model = days(...Array.from({ length: 10 }, (_, i) => ({ text: `Do thing ${i} — it helps.` })))
    const { days: plan, stats } = finalizeActionPlan(model, nothingDone)
    expect(flat(plan)).toHaveLength(MAX_PLAN_ITEMS)
    expect(types(plan).filter(Boolean)).toHaveLength(9)
    expect(stats.cut).toBe(5)
    expect(flat(plan).at(-1)?.text).toBe('Do thing 4 — it helps.')
  })

  it('still returns the setup steps when the model wrote nothing usable, and nothing when there is nothing to do', () => {
    expect(finalizeActionPlan([], nothingDone).days.flatMap((d) => d.items)).toHaveLength(9)
    expect(flat(finalizeActionPlan([], allDone).days).map((i) => i.actionType)).toEqual(['RESUME_UPDATE'])
  })

  it('ignores repeated items', () => {
    const model = days({ text: 'Rewrite your summary line — it should name your level.' }, { text: 'Rewrite your summary line — it should name your level.' })
    expect(flat(finalizeActionPlan(model, allDone).days).filter((i) => !i.actionType)).toHaveLength(1)
  })
})

describe('laying the plan out over the days', () => {
  it('spreads items evenly in order, the earlier days taking the extra', () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ text: `Item ${i}` }))
    expect(packIntoDays(items).map((d) => d.items.length)).toEqual([2, 2, 1, 1, 1, 1, 1])
    expect(packIntoDays(items.concat(items.slice(0, 5))).map((d) => d.items.length)).toEqual([2, 2, 2, 2, 2, 2, 2])
  })

  it('numbers the days from 1 and never leaves one empty', () => {
    const out = packIntoDays(Array.from({ length: 5 }, (_, i) => ({ text: `Item ${i}` })))
    expect(out.map((d) => d.day)).toEqual([1, 2, 3, 4, 5])
    expect(out.every((d) => d.items.length === 1)).toBe(true)
    expect(packIntoDays([])).toEqual([])
  })
})

describe('the model\'s instructions agree with the code', () => {
  it('tells the model every setup step is not its to write', () => {
    for (const type of ['LINKEDIN_SETUP', 'GMAIL_CONNECTED', 'SEARCH_STRATEGY_CHECKLIST', 'PROFILE_CONFIRM', 'INDUSTRY_CONFIRM', 'FUNCTION_CONFIRM', 'SALARY_CONFIRM', 'WORK_AUTHORIZATION']) {
      expect(ACTION_PLAN_PROMPT_SECTION).toContain(type)
    }
    expect(ACTION_PLAN_PROMPT_SECTION).toMatch(/NOT yours to write/)
  })

  it('no longer asks for networking, or contradicts itself about it', () => {
    expect(ACTION_PLAN_PROMPT_SECTION).not.toMatch(/actionType "(NETWORKING_LIST|OUTREACH_MESSAGE)"/)
    expect(ACTION_PLAN_PROMPT_SECTION).toMatch(/Never write networking/)
    expect(ACTION_PLAN_PROMPT_SECTION).toMatch(/Dossier/)
    expect(ACTION_PLAN_PROMPT_SECTION).not.toMatch(/exactly 7 days/)
  })
})
