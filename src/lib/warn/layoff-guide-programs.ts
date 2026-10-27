import catalog from '@/lib/benefits/catalog.json'
import { deriveWorkTags, isMemberProgram, matchPrograms, type MemberFacts } from '@/lib/benefits/match'
import type { BenefitProgramRow } from '@/lib/benefits/types'
import { STATE_UI } from '@/lib/data/state-ui'
import { stateName, stateSlug } from '@/lib/seo/states'

// What the layoff guide adds from data we already hold, with no database read: how to file for unemployment in each state of the
// notices (official-source facts in state-ui.ts) and the verified programs that fit the state, the county or city and the line
// of work (the bundled benefits catalog, run through the same gates as the member matcher). Programs filed under a company's own
// name are left out on purpose: in the catalog they are hiring and relocation incentives from that company, not help for its laid-off staff. Pure and tested.
// Nothing here asks who the reader is: programs written for a group (veterans, people 50 and over, a disability) are not
// listed, because a public page cannot know. The free account asks, and matches those.

const rows = (catalog as unknown as { rows: (Omit<BenefitProgramRow, 'checkedAt'> & { checkedAt: string | null })[] }).rows.map((r) => ({
  ...r,
  checkedAt: r.checkedAt ? new Date(r.checkedAt) : null,
})) as BenefitProgramRow[]

export interface FilingFact {
  state: string
  stateName: string
  agency: string | null
  fileUrl: string | null
  maxWeekly: number | null
  maxWeeks: number | null
  durationVaries: boolean
  waitingWeek: boolean | null
  /** How the state treats severance pay for benefits, in the state’s own terms; null when sources disagree. */
  severance: string | null
  page: string
}

/** The first sentence of a state’s own wording, capped, so a statute citation does not fill the card. */
function firstSentence(text: string | null): string | null {
  if (!text) return null
  const first = text.split(/(?<=\.)\s/)[0].trim()
  return first.length > 260 ? `${first.slice(0, 257)}…` : first
}

export function filingFacts(states: string[]): FilingFact[] {
  return states.flatMap((code) => {
    const ui = STATE_UI[code]
    if (!ui) return []
    return [{
      state: code,
      stateName: stateName(code),
      agency: ui.agencyName.value,
      fileUrl: ui.fileUrl.value,
      maxWeekly: ui.maxWeeklyBenefit.value,
      maxWeeks: ui.maxWeeks.value,
      durationVaries: ui.durationVaries.value === true,
      waitingWeek: ui.waitingWeek.value,
      severance: firstSentence(ui.severance.value),
      page: `/unemployment-benefits/${stateSlug(code)}`,
    }]
  })
}

export interface GuideProgram {
  id: string
  name: string
  where: string
  amount: string | null
  url: string
  help: 'support' | 'retrain'
}

const clean = (s: string) => s.replace(/\s*\(.*$/, '').trim()
// Help for someone who just lost a job, by name. The catalog also holds tax credits for students, professional dues waivers and payment
// plans for tax bills, which fit a member who has told us more but not a stranger reading about a layoff. An allowlist, not a blocklist.
const STATE_HELP = /final pay|time penalties|continuation|mini-cobra|special enrollment|severance|work share|self-employment assistance|essential plan|premium|dependents?’? allowance|dependency allowance|mortgage|utility|energy|rate assistance|gas and electric/i
const NATIONAL_HELP = /dislocated|wioa|rapid response|job search|emergency hardship|unemployment deferment|economic hardship deferment|lawhelp|211|bonding|apprenticeship/i

// Business incentives and the like that the catalog files under training.
const NOT_FOR_PEOPLE = /tax credit|reality check/i

const MAX_PER_STATE = 6
const MAX_NATIONAL = 3

function toProgram(r: BenefitProgramRow, help: GuideProgram['help']): GuideProgram {
  return {
    id: r.id,
    name: clean(r.name),
    where: r.state ? `${r.locality ? `${r.locality.replace(/\s*\(.*?\)/g, '')}, ` : ''}${r.state}` : 'Nationwide',
    amount: r.amount ? (r.amount.replace(/\s+/g, ' ').split(/;|\. /)[0].slice(0, 110)) : null,
    url: r.applyUrl ?? r.url ?? '',
    help,
  }
}

/**
 * Programs for each state of the notices, the county or city when one is given, and the line of work when the industry bucket is
 * known. Help while out of work comes first, then retraining.
 */
export function guidePrograms(opts: { states: string[]; places?: Record<string, string | null>; industryBucket?: string | null; source?: BenefitProgramRow[] }): GuideProgram[] {
  const source = opts.source ?? rows
  const tags = deriveWorkTags({ industryBucket: opts.industryBucket ?? null })
  const out: GuideProgram[] = []
  const seen = new Set<string>()
  const add = (p: GuideProgram) => { if (p.url && !seen.has(p.id)) { seen.add(p.id); out.push(p) } }

  let national = 0
  for (const state of opts.states.slice(0, 3)) {
    const facts: MemberFacts = {
      state, city: opts.places?.[state] ?? null, laidOff: true, pivoting: false, tags,
      relocation: { scope: 'LOCAL', states: [] }, workKnown: true, answered: true,
    }
    const matches = matchPrograms(source, facts).filter((m) => (m.goal === 'support' || m.goal === 'retrain') && (m.program.scope === 'NATIONAL' ? NATIONAL_HELP.test(m.program.name) : m.goal === 'retrain' ? !NOT_FOR_PEOPLE.test(m.program.name) : STATE_HELP.test(m.program.name)))
    const ordered = [...matches.filter((m) => m.goal === 'support'), ...matches.filter((m) => m.goal === 'retrain')]
    let local = 0
    for (const m of ordered) {
      if (!isMemberProgram(m.program)) continue
      if (m.program.scope === 'NATIONAL') {
        if (national < MAX_NATIONAL) { add(toProgram(m.program, m.goal as GuideProgram['help'])); national++ }
      } else if (local < MAX_PER_STATE) {
        add(toProgram(m.program, m.goal as GuideProgram['help'])); local++
      }
    }
  }
  return out
}
