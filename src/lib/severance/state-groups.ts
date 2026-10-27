// How each state treats severance for unemployment, read from the sourced state data (src/lib/data/state-ui.ts). Used by the unemployment
// pages, the severance explainer and the calculator. Pure over that data, so it is unit-tested (src/test/severance-calc.test.ts).

import { STATE_UI } from '@/lib/data/state-ui'
import { TREATMENT_ORDER, type StateTreatment } from '@/lib/severance/calc'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'

export interface StateSeverance {
  code: string
  name: string
  slug: string
  /** Null when official sources disagreed or the rule could not be confirmed. */
  treatment: StateTreatment
  /** The state's own rule, from the sourced data. */
  text: string | null
  source: string | null
  asOf: string | null
}

export function severanceByState(): StateSeverance[] {
  return ALL_STATE_CODES.map((code) => {
    const s = STATE_UI[code].severance
    return {
      code,
      name: stateName(code),
      slug: stateSlug(code),
      treatment: s.value ? (s.treatment ?? null) : null,
      text: s.value,
      source: s.source,
      asOf: s.asOf,
    }
  })
}

export interface TreatmentGroup {
  /** One of the four treatments, or null for the states whose rule could not be confirmed. */
  treatment: Exclude<StateTreatment, null> | null
  states: StateSeverance[]
}

/** The 51 grouped by treatment, best news first, with the unconfirmed states last. */
export function groupByTreatment(rows: StateSeverance[] = severanceByState()): TreatmentGroup[] {
  const groups: TreatmentGroup[] = TREATMENT_ORDER.map((t) => ({ treatment: t, states: rows.filter((r) => r.treatment === t) }))
  groups.push({ treatment: null, states: rows.filter((r) => r.treatment === null) })
  return groups.filter((g) => g.states.length > 0)
}
