import { STATE_UI } from '@/lib/data/state-ui'
import { ogPoster, POSTER_SIZE } from '@/lib/seo/og-poster'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'

export const alt = 'Unemployment benefits by state'
export const size = POSTER_SIZE
export const contentType = 'image/png'
export const revalidate = 86400

/** The share card for a state's benefits page: the maximum weekly benefit and the weeks, large, with a palette and layout picked from the state. */
export default async function Image({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const code = ALL_STATE_CODES.find((c) => stateSlug(c) === state)
  const ui = code ? STATE_UI[code] : undefined
  const max = ui?.maxWeeklyBenefit.value ?? null
  const weeks = ui?.maxWeeks.value ?? null
  const name = code ? stateName(code) : 'Unemployment benefits'
  if (max !== null) {
    return ogPoster({
      seed: state, kicker: 'Unemployment benefits', big: `$${max.toLocaleString('en-US')}`,
      unit: weeks !== null ? `a week, up to ${weeks} weeks` : 'a week at most', title: name, detail: 'Maximum weekly benefit set by the state',
    })
  }
  return ogPoster({ seed: state, kicker: 'Unemployment benefits', big: '50', unit: 'states compared', title: name })
}
