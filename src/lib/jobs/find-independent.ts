// Independent work in the redesign (docs/candidate-redesign.md): one launch step that is next, three places work
// comes from, and where the member has signed up. Pure and client-safe; the data comes from loadIndependentWork
// (lib/interim-work/independent-work-data.ts) and is only reshaped here. Tests: src/test/find-independent.test.ts.

export interface LaunchPhaseInput {
  number: number
  title: string
  description: string
  completed: boolean
  cta: { label: string; href: string } | null
}

/** Short, plain names for the six launch phases (the long titles stay in the full plan behind "Show more"). */
export const LAUNCH_LABEL: Record<number, string> = {
  1: 'Set your rate target',
  2: 'Define your offer',
  3: 'Add a work sample',
  4: 'Update your LinkedIn',
  5: 'Tell your network',
  6: 'Reach out to platforms',
}

export interface LaunchStep {
  number: number
  label: string
  done: boolean
}

export function launchSteps(phases: LaunchPhaseInput[]): LaunchStep[] {
  return phases.map((p) => ({ number: p.number, label: LAUNCH_LABEL[p.number] ?? p.title, done: p.completed }))
}

/** The first phase not done: it is the one primary action on the page. Null once all are done. */
export function nextLaunchPhase(phases: LaunchPhaseInput[]): (LaunchPhaseInput & { label: string }) | null {
  const next = phases.find((p) => !p.completed)
  return next ? { ...next, label: LAUNCH_LABEL[next.number] ?? next.title } : null
}

export function launchProgressLine(phases: LaunchPhaseInput[]): string {
  const done = phases.filter((p) => p.completed).length
  if (phases.length > 0 && done === phases.length) return `All ${phases.length} steps done. Your offer is ready to take to your network.`
  return `${done} of ${phases.length} steps done`
}

export type SourceKey = 'marketplaces' | 'experts' | 'advisory'

export interface SourceCard {
  key: SourceKey
  title: string
  blurb: string
  /** A fact about the member or the list: "2 joined", "6 to explore". */
  status: string
}

const MARKETPLACE_CATEGORIES = ['MARKETPLACE_TECHNICAL', 'MARKETPLACE_GENERAL', 'MARKETPLACE_MARKETING', 'MARKETPLACE_STARTUP', 'MARKETPLACE_ANY_FUNCTION']
const BOARD_CATEGORIES = ['BOARD_ADVISORY', 'NONPROFIT_BOARD']

function status(joined: number, listed: number): string {
  if (joined > 0) return `${joined} joined`
  if (listed > 0) return `${listed} to explore`
  return 'Not started'
}

/**
 * The places independent work comes from. Marketplaces and expert networks serve part-time and contract work;
 * teaching and advisory (with board directories when advisory is on) is always there.
 */
export function sourceCards(input: {
  showIndependent: boolean
  showAdvisory: boolean
  signups: { category: string }[]
  marketplaceCount: number
  expertCount: number
  boardCount: number
}): SourceCard[] {
  const joined = (cats: string[]) => input.signups.filter((s) => cats.includes(s.category)).length
  const cards: SourceCard[] = []
  if (input.showIndependent) {
    cards.push({
      key: 'marketplaces',
      title: 'Fractional and talent marketplaces',
      blurb: 'Platforms that match experienced people to projects, chosen for your background.',
      status: status(joined(MARKETPLACE_CATEGORIES), input.marketplaceCount),
    })
    cards.push({
      key: 'experts',
      title: 'Expert networks',
      blurb: 'Paid calls with investors and consultants who want your experience.',
      status: status(joined(['EXPERT_NETWORK']), input.expertCount),
    })
  }
  cards.push(
    input.showAdvisory
      ? {
          key: 'advisory',
          title: 'Board, advisory and teaching',
          blurb: 'Board and advisory directories, plus guest lecturing that keeps you visible.',
          status: status(joined(BOARD_CATEGORIES), input.boardCount),
        }
      : {
          key: 'advisory',
          title: 'Teaching and light advisory',
          blurb: 'Guest lecturing and informal advising keep you visible to people who hire.',
          status: 'Start with your network',
        }
  )
  return cards
}

export interface SignupSummary {
  count: number
  names: string[]
  /** From the member's connected email: "Business Talent Group: accepted". */
  emailNotes: string[]
}

/** Platforms the member says they joined, plus the ones their email shows (each name once). */
export function summarizeSignups(
  selfReported: { name: string }[],
  fromEmail: { name: string; label: string; healthLabel: string | null; dismissed: boolean }[]
): SignupSummary {
  const names: string[] = []
  const seen = new Set<string>()
  const add = (n: string) => {
    const k = n.trim().toLowerCase()
    if (!k || seen.has(k)) return
    seen.add(k)
    names.push(n.trim())
  }
  selfReported.forEach((s) => add(s.name))
  const live = fromEmail.filter((r) => !r.dismissed)
  live.forEach((r) => add(r.name))
  const emailNotes = live.map((r) => `${r.name}: ${r.label.toLowerCase()}${r.healthLabel ? ` (${r.healthLabel.toLowerCase()})` : ''}`)
  return { count: names.length, names, emailNotes }
}
