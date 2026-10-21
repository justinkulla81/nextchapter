import { describe, it, expect } from 'vitest'
import { launchProgressLine, launchSteps, nextLaunchPhase, sourceCards, summarizeSignups, type LaunchPhaseInput } from '@/lib/jobs/find-independent'

const phase = (number: number, completed: boolean): LaunchPhaseInput => ({ number, title: `Phase ${number}`, description: `About ${number}`, completed, cta: null })
const six = (done: number[]) => [1, 2, 3, 4, 5, 6].map((n) => phase(n, done.includes(n)))

describe('launch plan', () => {
  it('names the steps in plain words and marks the done ones', () => {
    const steps = launchSteps(six([1, 2]))
    expect(steps.map((s) => s.label)).toEqual(['Set your rate target', 'Define your offer', 'Add a work sample', 'Update your LinkedIn', 'Tell your network', 'Reach out to platforms'])
    expect(steps.filter((s) => s.done).map((s) => s.number)).toEqual([1, 2])
  })
  it('the next step is the first one not done, even when later ones are', () => {
    expect(nextLaunchPhase(six([1, 3]))?.number).toBe(2)
    expect(nextLaunchPhase(six([]))?.label).toBe('Set your rate target')
  })
  it('has no next step once everything is done, and says so positively', () => {
    expect(nextLaunchPhase(six([1, 2, 3, 4, 5, 6]))).toBeNull()
    expect(launchProgressLine(six([1, 2, 3, 4, 5, 6]))).toMatch(/All 6 steps done/)
    expect(launchProgressLine(six([1, 2]))).toBe('2 of 6 steps done')
  })
})

describe('sourceCards', () => {
  const base = { showIndependent: true, showAdvisory: true, signups: [], marketplaceCount: 6, expertCount: 3, boardCount: 4 }
  it('shows marketplaces, expert networks and board/advisory when all are on', () => {
    expect(sourceCards(base).map((c) => c.key)).toEqual(['marketplaces', 'experts', 'advisory'])
  })
  it('states a fact for each card: joined, to explore, or not started', () => {
    const cards = sourceCards({ ...base, signups: [{ category: 'MARKETPLACE_GENERAL' }, { category: 'MARKETPLACE_TECHNICAL' }, { category: 'EXPERT_NETWORK' }], boardCount: 0 })
    expect(cards.map((c) => c.status)).toEqual(['2 joined', '1 joined', 'Not started'])
    expect(sourceCards(base).map((c) => c.status)).toEqual(['6 to explore', '3 to explore', '4 to explore'])
  })
  it('advisory-only searches keep just the board, advisory and teaching card', () => {
    expect(sourceCards({ ...base, showIndependent: false }).map((c) => c.key)).toEqual(['advisory'])
  })
  it('part-time and contract searches keep teaching and light advisory, which needs no directory', () => {
    const cards = sourceCards({ ...base, showAdvisory: false })
    expect(cards.map((c) => c.key)).toEqual(['marketplaces', 'experts', 'advisory'])
    expect(cards[2].title).toBe('Teaching and light advisory')
  })
})

describe('summarizeSignups', () => {
  it('lists each place once, across what the member ticked and what their email shows', () => {
    const s = summarizeSignups(
      [{ name: 'Third Bridge' }, { name: 'Mercor' }],
      [
        { name: 'mercor', label: 'Accepted', healthLabel: null, dismissed: false },
        { name: 'micro1', label: 'In vetting', healthLabel: 'Gone quiet', dismissed: false },
        { name: 'Labelbox', label: 'Signed up', healthLabel: null, dismissed: true },
      ]
    )
    expect(s.count).toBe(3)
    expect(s.names).toEqual(['Third Bridge', 'Mercor', 'micro1'])
    expect(s.emailNotes).toEqual(['mercor: accepted', 'micro1: in vetting (gone quiet)'])
  })
  it('is empty with no sign-ups', () => {
    expect(summarizeSignups([], [])).toEqual({ count: 0, names: [], emailNotes: [] })
  })
})
