import { PreviewShell } from '@/components/candidate/PreviewShell'
import { CareerStoryView } from '@/components/dashboard/career-story/CareerStoryView'
import { buildDoors } from '@/lib/career-story/doors'
import { deriveStory } from '@/lib/career-story/events'
import { peerView } from '@/lib/career-story/peers'
import { parseRelocation } from '@/lib/journey/relocation'
import type { CareerStory } from '@/lib/career-story/load'

const NOW = new Date('2026-10-17T12:00:00Z')
const d = (s: string) => new Date(`${s}T12:00:00Z`)

// The real career story page (built in the career story session), fed sample data. It is the same
// component the live page uses, so the preview shows exactly what will ship.
function sampleStory(): CareerStory {
  const events = deriveStory({
    work: [
      { id: 'a', roleTitle: 'Financial analyst', companyName: 'Retail Co', companyNameNormalized: 'retail co', startDate: d('2016-06-01'), endDate: d('2019-06-01'), isCurrent: false, engagementType: 'FULL_TIME', keyAchievement: null },
      { id: 'b', roleTitle: 'Senior analyst', companyName: 'Health Co', companyNameNormalized: 'health co', startDate: d('2020-09-01'), endDate: d('2022-01-01'), isCurrent: false, engagementType: 'FULL_TIME', keyAchievement: null },
      { id: 'c', roleTitle: 'Senior accountant', companyName: 'Software Co', companyNameNormalized: 'software co', startDate: d('2022-01-01'), endDate: d('2024-01-01'), isCurrent: false, engagementType: 'FULL_TIME', keyAchievement: null },
      { id: 'e', roleTitle: 'Controller', companyName: 'Software Co', companyNameNormalized: 'software co', startDate: d('2024-01-01'), endDate: null, isCurrent: true, engagementType: 'FULL_TIME', keyAchievement: 'Owns the close, audit and the finance team.' },
    ],
    education: [{ id: 'u', schoolName: 'State University', degree: 'B.S.', fieldOfStudy: 'Finance', startDate: null, graduationDate: d('2016-05-15') }],
    badges: [],
    member: [
      { id: 'm1', kind: 'PAUSE', label: 'A pause to care for family', detail: 'You came back to a bigger role in a new city.', start: '2019-06-15', end: '2020-08-15', reason: 'FAMILY', sourceRef: null, hidden: false },
      { id: 'm2', kind: 'VENTURE', label: 'Bookkeeping and advisory side practice', detail: 'Shows you can find work, price it and deliver it.', start: '2023-03-01', end: '2024-06-01', reason: null, sourceRef: null, hidden: false },
      { id: 'm3', kind: 'LEARNING', label: 'SQL course', detail: null, start: '2022-09-01', end: null, reason: null, sourceRef: null, hidden: false },
    ],
    now: NOW,
  })
  const doors = buildDoors({ from: 'Finance', keywords: [], ownedFunctions: [], seniorLevel: true, currentIndustry: null, sectorHistory: [], onRadar: [], industriesOnRadar: [], skillsToBuild: [], radar: [], career: null, relocation: parseRelocation({}, false) })
  return { now: '2026-10-17', events, main: doors.main, more: doors.more, cushionMonths: 4.2, hideYears: false, peers: peerView(0, []), hasAnyHistory: true }
}

export function CareerStoryReal() {
  return (
    <PreviewShell place="learn" entry="path" part="story" wide>
      <CareerStoryView story={sampleStory()} from="Finance" />
    </PreviewShell>
  )
}
