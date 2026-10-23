import { PreviewShell } from '@/components/candidate/PreviewShell'
import { JourneyCard } from '@/components/candidate/JourneyCard'
import { JourneyPaths } from '@/components/candidate/JourneyPaths'
import { focusOptions, homePathsRow } from '@/lib/journey/paths'

// Home's journey card with parallel paths, built from the real helpers (sample data).
function Card({ hours }: { hours?: number }) {
  const signals = {
    main: 'LAID_OFF' as const,
    journeyDetails: { hoursAvailable: hours, buy: { stage: 'prepare' }, paths: { side: { level: 'doing', hours: 6, goal: 'cover' } } },
    kinds: ['PART_TIME'],
  }
  const row = homePathsRow(signals)
  return (
    <PreviewShell place="home" entry="today">
      <JourneyCard
        journey="Laid off, looking"
        since="Week 3 of your search"
        facts={[{ label: 'Saved jobs', value: '14' }, { label: 'Applications', value: '9' }, { label: 'Interviews', value: '1' }]}
        changes={['Your plan and weekly target follow your journey and where you are in it']}
        paths={row ? <JourneyPaths row={row} options={focusOptions(signals)} main="LAID_OFF" /> : undefined}
      />
    </PreviewShell>
  )
}

export const HomePathsOpen = () => <Card hours={10} />
export const HomePathsWaiting = () => <Card hours={3} />
export const HomePathsNone = () => (
  <PreviewShell place="home" entry="today">
    <JourneyCard journey="Laid off, looking" since="Week 3 of your search" facts={[]} changes={['Your plan and weekly target follow your journey and where you are in it']} />
  </PreviewShell>
)
