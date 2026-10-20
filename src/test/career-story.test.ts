import { describe, expect, it } from 'vitest'
import { deriveStory, type MemberRow, type StoryInput } from '@/lib/career-story/events'
import { layoutStory, whenText } from '@/lib/career-story/layout'
import { summarizeStory } from '@/lib/career-story/summary'
import { PAUSE_CHOICES, pauseSummary } from '@/lib/career-story/pause'
import { buildDoors, phasesForTier } from '@/lib/career-story/doors'
import { buildTarget, mergeTarget, moveStance } from '@/lib/journey/pivot'

const now = new Date('2026-10-17T12:00:00Z')
const d = (s: string) => new Date(`${s}T12:00:00Z`)

const input: StoryInput = {
  work: [
    { id: 'w1', roleTitle: 'Financial analyst', companyName: 'Shoply', companyNameNormalized: 'shoply', startDate: d('2016-06-01'), endDate: d('2019-01-01'), isCurrent: false, engagementType: 'FULL_TIME', keyAchievement: 'Built the weekly forecast.' },
    { id: 'w2', roleTitle: 'Senior analyst', companyName: 'Medi', companyNameNormalized: 'medi', startDate: d('2020-04-01'), endDate: d('2022-07-01'), isCurrent: false, engagementType: 'FULL_TIME', keyAchievement: null },
    { id: 'w3', roleTitle: 'Senior accountant', companyName: 'Cloudly', companyNameNormalized: 'cloudly', startDate: d('2022-08-01'), endDate: d('2024-01-01'), isCurrent: false, engagementType: 'FULL_TIME', keyAchievement: null },
    { id: 'w4', roleTitle: 'Controller', companyName: 'Cloudly', companyNameNormalized: 'cloudly', startDate: d('2024-01-01'), endDate: null, isCurrent: true, engagementType: 'FULL_TIME', keyAchievement: null },
    { id: 'w5', roleTitle: 'Bookkeeping practice', companyName: 'Own practice', companyNameNormalized: 'own practice', startDate: d('2023-01-01'), endDate: d('2024-07-01'), isCurrent: false, engagementType: 'CONSULTING', keyAchievement: null },
  ],
  education: [{ id: 'e1', schoolName: 'State U', degree: 'B.S.', fieldOfStudy: 'Finance', startDate: null, graduationDate: d('2016-05-15') }],
  badges: [{ id: 'b1', title: 'Financial modeling certificate', completedAt: d('2020-08-01') }],
  member: [],
  now,
}

describe('the story is derived from what we already hold', () => {
  const story = deriveStory(input)
  const kinds = (k: string) => story.filter((e) => e.kind === k)

  it('puts work, ventures, school and learning in their own places', () => {
    expect(kinds('WORK').map((e) => e.label)).toEqual(['Financial analyst', 'Senior analyst', 'Senior accountant', 'Controller'])
    expect(kinds('VENTURE').map((e) => e.label)).toEqual(['Bookkeeping practice'])
    expect(kinds('SCHOOL')).toHaveLength(1)
    expect(kinds('LEARNING')).toHaveLength(1)
  })
  it('estimates school dates from a graduation date and says so', () => {
    const s = kinds('SCHOOL')[0]
    expect(s.start).toBe('2012-05-15')
    expect(s.approx).toBe(true)
    expect(s.label).toBe('B.S. in Finance')
  })
  it('marks a new role at the same company, without calling it a promotion', () => {
    const m = kinds('MILESTONE')
    expect(m).toHaveLength(1)
    expect(m[0].label).toBe('New role at Cloudly')
  })
  it('notices quiet stretches and calls them a pause for the member to describe', () => {
    const pauses = kinds('PAUSE')
    expect(pauses.map((p) => [p.start, p.end, p.unlabeled, p.label])).toEqual([
      ['2019-01-01', '2020-04-01', true, 'A pause'],
    ])
  })
  it('does not call a gap that a venture or school fills a pause', () => {
    const s = deriveStory({ ...input, work: input.work.filter((w) => w.id !== 'w5' && w.id !== 'w2') })
    expect(s.filter((e) => e.kind === 'PAUSE').length).toBeGreaterThan(0)
    const s2 = deriveStory({ ...input, work: [{ ...input.work[0], endDate: d('2019-01-01') }, { ...input.work[0], id: 'x', startDate: d('2019-02-01'), endDate: null, isCurrent: true }] })
    expect(s2.filter((e) => e.kind === 'PAUSE')).toHaveLength(0)
  })
  it('between roles is a pause that is still open', () => {
    const s = deriveStory({ ...input, work: [{ ...input.work[0], endDate: d('2026-01-01') }], education: [], badges: [] })
    const p = s.find((e) => e.kind === 'PAUSE')!
    expect(p.label).toBe('Between roles')
    expect(p.end).toBeNull()
  })
  it('never labels why someone left a job', () => {
    expect(JSON.stringify(story)).not.toMatch(/laid off|fired|terminated|layoff/i)
  })
})

describe('the member is in charge of their story', () => {
  const row = (r: Partial<MemberRow>): MemberRow => ({ id: 'r', kind: 'PAUSE', label: 'x', detail: null, start: '2019-01-01', end: '2020-04-01', reason: null, sourceRef: null, hidden: false, ...r })

  it('describing a pause we noticed replaces the prompt with their words', () => {
    const s = deriveStory({ ...input, member: [row({ id: 'o1', sourceRef: 'gap:2019-01-01', label: 'Caring for my dad', reason: 'FAMILY' })] })
    const p = s.find((e) => e.kind === 'PAUSE')!
    expect(p.label).toBe('Caring for my dad')
    expect(p.unlabeled).toBe(false)
    expect(p.reason).toBe('FAMILY')
  })
  it('correcting a derived event changes only what they changed', () => {
    const s = deriveStory({ ...input, member: [row({ id: 'o2', kind: 'WORK', sourceRef: 'work:w4', label: 'Controller and team lead', start: '2024-02-01', end: null })] })
    const w = s.find((e) => e.id === 'work:w4')!
    expect(w.label).toBe('Controller and team lead')
    expect(w.start).toBe('2024-02-01')
    expect(w.end).toBeNull()
    expect(w.source).toBe('WORK_HISTORY')
  })
  it('hiding a derived event removes it, and any prompt around it', () => {
    const s = deriveStory({ ...input, member: [row({ id: 'o3', sourceRef: 'work:w2', hidden: true })] })
    expect(s.find((e) => e.id === 'work:w2')).toBeUndefined()
  })
  it('what they add is kept, including a pause that covers a noticed gap', () => {
    const s = deriveStory({ ...input, member: [row({ id: 'm1', label: 'A year to rest', reason: 'REST' })] })
    expect(s.filter((e) => e.kind === 'PAUSE')).toHaveLength(1)
    expect(s.find((e) => e.kind === 'PAUSE')!.unlabeled).toBe(false)
  })
  it('ignores a kind it does not know and a reason it does not know', () => {
    const s = deriveStory({ ...input, member: [row({ id: 'm2', kind: 'NOPE' }), row({ id: 'm3', label: 'Break', reason: 'GOSSIP', start: '2025-01-01', end: '2025-03-01' })] })
    expect(s.find((e) => e.id === 'm:m2')).toBeUndefined()
    expect(s.find((e) => e.id === 'm:m3')!.reason).toBeNull()
  })
})

describe('the timeline layout', () => {
  const story = deriveStory(input)
  const layout = layoutStory(story, now)
  it('has room to the right for the next chapter and today inside it', () => {
    expect(layout.endYear).toBeGreaterThan(2029)
    expect(layout.todayPct).toBeGreaterThan(70)
    expect(layout.todayPct).toBeLessThan(95)
  })
  it('puts every bar inside the axis, and overlapping work on separate rows', () => {
    for (const lane of layout.lanes) for (const row of lane.rows) for (const b of row) {
      expect(b.leftPct).toBeGreaterThanOrEqual(0)
      expect(b.leftPct + b.widthPct).toBeLessThanOrEqual(100.01)
    }
    const overlapping = layoutStory(deriveStory({ ...input, work: [input.work[3], { ...input.work[3], id: 'w9', roleTitle: 'Advisor' }], education: [], badges: [] }), now)
    expect(overlapping.lanes.find((l) => l.id === 'work')!.rows.length).toBe(2)
  })
  it('hides years on request, keeping the shape', () => {
    const labels = layoutStory(story, now, { hideYears: true }).ticks.map((t) => t.label)
    expect(labels[0]).toBe('Start')
    expect(labels.join(' ')).not.toMatch(/20\d\d/)
    expect(whenText(story.find((e) => e.id === 'work:w4')!, now, true)).toBe('about 3 years so far')
    expect(whenText(story.find((e) => e.id === 'work:w4')!, now, false)).toBe('Jan 2024 to today')
  })
  it('does not break on an empty story', () => {
    const l = layoutStory([], now)
    expect(l.lanes.map((x) => x.id)).toEqual(['work'])
    expect(l.endYear - l.startYear).toBeGreaterThanOrEqual(10)
  })
})

describe('the story in one kind sentence', () => {
  it('names the arc, the pause, the venture and the learning', () => {
    const s = summarizeStory(deriveStory({ ...input, member: [{ id: 'p', kind: 'PAUSE', label: 'Family', detail: null, start: '2019-01-01', end: '2020-04-01', reason: 'FAMILY', sourceRef: null, hidden: false }] }), now)
    expect(s).toMatch(/Financial analyst to Controller in about 10 years/)
    expect(s).toMatch(/a pause/)
    expect(s).toMatch(/a venture of your own/)
  })
  it('does not count a pause the member has not described', () => {
    expect(summarizeStory(deriveStory(input), now)).not.toMatch(/pause/)
  })
  it('invites a first chapter when there is nothing yet', () => {
    expect(summarizeStory([], now)).toMatch(/starts here/)
  })
})

describe('what if I took a pause', () => {
  it('asks for the number before it says anything', () => {
    expect(pauseSummary(null, 6).known).toBe(false)
  })
  it('is positive when the cushion covers it and practical when it does not', () => {
    expect(pauseSummary(8, 6).headline).toMatch(/covers a 6-month pause/)
    const short = pauseSummary(4.2, 6)
    expect(short.headline).toMatch(/within reach/)
    expect(short.extraMonths).toBe(2)
    expect(short.detail).toMatch(/fractional or part-time/)
  })
  it('never uses alarming words', () => {
    for (const n of PAUSE_CHOICES) for (const c of [0, 2, 6, 24]) expect(JSON.stringify(pauseSummary(c, n))).not.toMatch(/danger|risk|run out|broke|fail|warning/i)
  })
})

describe('doors you could open', () => {
  const base = { from: 'Finance', keywords: ['Excel', 'SQL'], ownedFunctions: [], seniorLevel: false, currentIndustry: 'Software', sectorHistory: [], reason: null, onRadar: [], industriesOnRadar: [], skillsToBuild: [], radar: [], career: null, relocation: { scope: 'LOCAL' as const } }
  const { main, more } = buildDoors(base)
  it('offers at most three, with a way to grow where you are first', () => {
    expect(main.length).toBeGreaterThanOrEqual(2)
    expect(main.length).toBeLessThanOrEqual(3)
    expect(main[0].kind).toBe('GROW')
  })
  it('every door has a smallest first step, what it opens, and phases as ranges inside the scale', () => {
    for (const door of [...main, ...more]) {
      expect(door.firstStep.length, door.id).toBeGreaterThan(10)
      expect(door.opens.length, door.id).toBeGreaterThan(0)
      for (const p of door.phases) {
        expect(p.from, door.id).toBeLessThanOrEqual(p.solidTo)
        expect(p.solidTo, door.id).toBeLessThanOrEqual(p.rangeTo)
        expect(p.rangeTo, door.id).toBeLessThanOrEqual(36)
      }
    }
  })
  it('shows a range of doors, not three of the same size', () => {
    const fn = main.filter((x) => x.kind === 'FUNCTION')
    expect(fn.length).toBe(2)
    expect(fn[0].tag).not.toBe(fn[1].tag)
  })
  it('never warns, and a bigger door is called a starting point to grow from', () => {
    const text = JSON.stringify([...main, ...more])
    expect(text).not.toMatch(/danger|risk|warning|unlikely|impossible|too late|too old/i)
    expect(phasesForTier('REBUILD', [12, 36]).map((p) => p.label).join(' ')).toMatch(/first role to grow from/)
  })
  it('puts what is on their radar first, and does not offer it twice', () => {
    const t = mergeTarget(undefined, buildTarget('Finance', 'Design', {}, now), now)
    const doors = buildDoors({ ...base, radar: [t] }).main
    expect(doors.filter((x) => x.id === 'fn:Design')).toHaveLength(1)
    expect(doors.find((x) => x.id === 'fn:Design')!.onRadar).toBe(true)
  })
  it('a door they set aside is not offered', () => {
    const t = moveStance(mergeTarget(undefined, buildTarget('Finance', 'Design', {}, now), now), { stance: 'SET_ASIDE' }, now)
    expect(buildDoors({ ...base, radar: [t] }).main.some((x) => x.id === 'fn:Design' && x.onRadar)).toBe(false)
  })
  it('uses the next level they named', () => {
    expect(buildDoors({ ...base, career: { nextLevel: 'Director of finance' } }).main[0].title).toBe('Director of finance')
  })
  it('prices a natural move as little or nothing, and a bigger one as a range', () => {
    const fn = main.filter((x) => x.kind === 'FUNCTION')
    const natural = fn.find((x) => x.tag === 'A natural move')
    if (natural) expect(natural.cost).toMatch(/little or nothing/)
    expect(fn.some((x) => /Roughly (up to )?\$/.test(x.cost ?? ''))).toBe(true)
  })
})
