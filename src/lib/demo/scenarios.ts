// How much sample data a demo gets. "Realistic" is the default for a sales demo:
// enough that every screen has a story, small enough to create in under a minute.

export type DemoScenario = 'Light' | 'Realistic' | 'Large'

export const DEMO_SCENARIOS: DemoScenario[] = ['Light', 'Realistic', 'Large']

export interface DemoSizes {
  /** Alumni on the higher-ed roster. */
  alumni: number
  /** Outplacement seats on the contract. */
  seats: number
  /** Sample people shared by the other portals (clients, candidates). */
  people: number
  /** Coaching clients. */
  clients: number
  /** Open roles for a hiring team. */
  roles: number
  /** Introductions and submissions for a recruiter firm. */
  introductions: number
}

const SIZES: Record<DemoScenario, DemoSizes> = {
  Light: { alumni: 80, seats: 24, people: 24, clients: 6, roles: 3, introductions: 8 },
  Realistic: { alumni: 200, seats: 120, people: 60, clients: 12, roles: 6, introductions: 20 },
  Large: { alumni: 600, seats: 400, people: 120, clients: 24, roles: 10, introductions: 40 },
}

export function isScenario(v: unknown): v is DemoScenario {
  return v === 'Light' || v === 'Realistic' || v === 'Large'
}

export function sizesFor(scenario: string | null | undefined): DemoSizes {
  return SIZES[isScenario(scenario) ? scenario : 'Realistic']
}

/** Seat statuses for an outplacement demo: most active, some waiting, a few ended. */
export function seatMix(total: number): { active: number; invited: number; ended: number } {
  const ended = Math.round(total * 0.1)
  const invited = Math.round(total * 0.3)
  return { active: total - ended - invited, invited, ended }
}
