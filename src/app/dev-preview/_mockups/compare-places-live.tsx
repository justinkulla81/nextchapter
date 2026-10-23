import { PreviewShell } from '@/components/candidate/PreviewShell'
import { ComparePlaces } from '@/components/market/ComparePlaces'
import { compareRows, type Lens, type MetroFacts, type PlaceView } from '@/lib/workforce/metro-compare'

// The built Compare places page, fed sample numbers shaped like the real ones.
const sector = { labels: ['Professional & technical'], jobs: 41000, changePct: 3.1 }
const FACTS: Record<string, MetroFacts> = {
  louisville: { cbsa: '31140', name: 'Louisville/Jefferson County, KY-IN', states: ['KY'], unemployment: { rate: 4.4, rateYearAgo: 4.1, laborForce: 690000, period: '2026-08' }, populationChangePct: 1.2, openRoles: 410, fieldRoles: 88, rolesPer10kWorkers: 5.9, fieldRolesPer10kWorkers: 1.3, sector, rpp: { all: 93.1, goods: 96.2, housing: 78.6, utilities: 75, other: 96.8 } },
  raleigh: { cbsa: '39580', name: 'Raleigh-Cary, NC', states: ['NC'], unemployment: { rate: 3.6, rateYearAgo: 3.7, laborForce: 780000, period: '2026-08' }, populationChangePct: 8.4, openRoles: 940, fieldRoles: 260, rolesPer10kWorkers: 12.1, fieldRolesPer10kWorkers: 3.3, sector: { ...sector, changePct: 7.9 }, rpp: { all: 99.6, goods: 99.8, housing: 109, utilities: 94, other: 97.4 } },
  denver: { cbsa: '19740', name: 'Denver-Aurora-Centennial, CO', states: ['CO'], unemployment: { rate: 4.7, rateYearAgo: 4.2, laborForce: 1700000, period: '2026-08' }, populationChangePct: 2.3, openRoles: 1300, fieldRoles: 370, rolesPer10kWorkers: 7.6, fieldRolesPer10kWorkers: 2.2, sector: { ...sector, changePct: 1.4 }, rpp: { all: 108.3, goods: 104, housing: 134, utilities: 99, other: 101 } },
}
const OPTS = { salary: 100_000, fieldName: 'Product Manager' }
const METROS = [
  { cbsa: '31140', name: 'Louisville/Jefferson County, KY-IN' },
  { cbsa: '39580', name: 'Raleigh-Cary, NC' },
  { cbsa: '19740', name: 'Denver-Aurora-Centennial, CO' },
  { cbsa: '12060', name: 'Atlanta-Sandy Springs-Roswell, GA' },
]

function place(key: 'raleigh' | 'denver', incentives: PlaceView['incentives']): PlaceView {
  const rows = compareRows(FACTS[key], FACTS.louisville, OPTS)
  return { cbsa: FACTS[key].cbsa, name: FACTS[key].name.replace(/-.*?,/, ',').replace(/,.*$/, '') + ', ' + FACTS[key].states[0], rows, incentives }
}

function Page({ employed, lens, places, empty }: { employed: boolean; lens: Lens; places: PlaceView[]; empty?: boolean }) {
  return (
    <PreviewShell place="jobs" entry="market" part="local">
      <ComparePlaces
        employed={employed}
        lens={lens}
        current={empty ? null : { name: 'Louisville, KY', rows: compareRows(FACTS.louisville, null, OPTS) }}
        places={places}
        chosen={places.map((p) => p.cbsa)}
        metros={METROS}
        fieldName="Product Manager"
      />
    </PreviewShell>
  )
}

const RALEIGH = place('raleigh', { state: 'NC', count: 6, names: ['Move to Tarboro', 'Hometown Rewards NC'] })
const DENVER = place('denver', null)

export const ComparePlacesJobless = () => <Page employed={false} lens="job" places={[RALEIGH, DENVER]} />
export const ComparePlacesEmployed = () => <Page employed lens="job" places={[RALEIGH, DENVER]} />
export const ComparePlacesLife = () => <Page employed lens="life" places={[RALEIGH]} />
export const ComparePlacesEmpty = () => <Page employed={false} lens="job" places={[]} />
export const ComparePlacesNoCity = () => <Page employed={false} lens="job" places={[RALEIGH]} empty />
