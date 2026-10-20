import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/app/dashboard/my-career/actions', () => ({ saveStoryEvent: vi.fn(), removeStoryEvent: vi.fn(), saveCushion: vi.fn(), setStoryHideYears: vi.fn(), noteStoryAction: vi.fn() }))
vi.mock('@/app/dashboard/pivot-paths/actions', () => ({ saveExploredTarget: vi.fn() }))

import { CareerStoryView } from '@/components/dashboard/career-story/CareerStoryView'
import { ReportStory } from '@/components/dashboard/career-story/ReportStory'
import { buildDoors } from '@/lib/career-story/doors'
import { deriveStory } from '@/lib/career-story/events'
import { peerView } from '@/lib/career-story/peers'
import { parseRelocation } from '@/lib/journey/relocation'
import type { CareerStory } from '@/lib/career-story/load'

const now = new Date('2026-10-17T12:00:00Z')
const d = (s: string) => new Date(`${s}T12:00:00Z`)

function story(over: Partial<CareerStory> = {}, withHistory = true): CareerStory {
  const events = withHistory
    ? deriveStory({
        work: [
          { id: 'a', roleTitle: 'Analyst', companyName: 'Acme', companyNameNormalized: 'acme', startDate: d('2016-06-01'), endDate: d('2019-06-01'), isCurrent: false, engagementType: 'FULL_TIME', keyAchievement: null },
          { id: 'b', roleTitle: 'Controller', companyName: 'Beta', companyNameNormalized: 'beta', startDate: d('2020-03-01'), endDate: null, isCurrent: true, engagementType: 'FULL_TIME', keyAchievement: null },
        ],
        education: [{ id: 'e', schoolName: 'State U', degree: 'B.S.', fieldOfStudy: 'Finance', startDate: null, graduationDate: d('2016-05-15') }],
        badges: [],
        member: [],
        now,
      })
    : []
  const doors = buildDoors({ from: 'Finance', keywords: [], ownedFunctions: [], seniorLevel: true, currentIndustry: null, sectorHistory: [], onRadar: [], industriesOnRadar: [], skillsToBuild: [], radar: [], career: null, relocation: parseRelocation({}, false) })
  return { now: '2026-10-17', events, main: doors.main, more: doors.more, cushionMonths: null, hideYears: false, peers: peerView(0, []), hasAnyHistory: withHistory, ...over }
}

describe('Your career story page', () => {
  it('renders the timeline, list, doors, pause tool and honest peers state', () => {
    const html = renderToStaticMarkup(<CareerStoryView story={story()} from="Finance" />)
    for (const text of ['Your career story', 'Only you can see this', 'Hide years', 'Today', 'Controller', 'Doors you could open', 'What if you took a pause?', 'People like you', 'not enough members']) {
      expect(html.toLowerCase(), text).toContain(text.toLowerCase().replace('not enough', 'enough'))
    }
    expect(html).toContain('2016')
    expect(html).toContain('See it as a list')
  })
  it('hides years on request but keeps the shape', () => {
    const html = renderToStaticMarkup(<CareerStoryView story={story({ hideYears: true })} from="Finance" />)
    const ticks = html.match(/aria-hidden="true"[^>]*>(?:<span[^>]*>[^<]*<\/span>)+/)?.[0] ?? ''
    expect(ticks).not.toMatch(/20\d\d/)
    expect(html).toContain('+4 yrs')
  })
  it('has an empty state with a way forward', () => {
    const html = renderToStaticMarkup(<CareerStoryView story={story({}, false)} from={null} />)
    expect(html).toContain('Your story starts with a first chapter')
    expect(html).toContain('Add a chapter')
  })
  it('gives every button a name', () => {
    const html = renderToStaticMarkup(<CareerStoryView story={story()} from="Finance" />)
    for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
      const named = /aria-label="[^"]+"/.test(m[1]) || m[2].replace(/<[^>]+>/g, '').trim().length > 0
      expect(named, m[0].slice(0, 120)).toBe(true)
    }
  })
  it('shows peers only when the group is big enough', () => {
    const peers = peerView(200, [{ function: 'Operations', people: 23 }])
    const html = renderToStaticMarkup(<CareerStoryView story={story({ peers })} from="Finance" />)
    expect(html).toContain('About ')
    expect(html).toContain('looking at Operations')
    expect(html).toContain('not a prediction')
  })
})

describe('Market Reality report copy', () => {
  it('is read-only, private and says it is a sketch', () => {
    const html = renderToStaticMarkup(<ReportStory story={story()} />)
    expect(html).toContain('A sketch from typical paths, not a prediction')
    expect(html).not.toContain('<form')
  })
})
