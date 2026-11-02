'use client'

import { useRouter } from 'next/navigation'
import { ALL_STATE_CODES, stateName, stateSlug } from '@/lib/seo/states'
import { posthog } from '@/lib/posthog/client'

/** Fifty-one choices, so a dropdown. Picking a state opens that state's unemployment page. */
export function StatePicker({ page, variant }: { page: string; variant: string }) {
  const router = useRouter()
  return (
    <div className="max-w-sm">
      <label htmlFor="landing-state" className="block text-sm font-semibold text-ink">
        Your state
      </label>
      <select
        id="landing-state"
        defaultValue=""
        onChange={(e) => {
          const code = ALL_STATE_CODES.find((c) => stateSlug(c) === e.target.value)
          if (!code) return
          posthog.capture('landing_state_selected', { page, variant, state: code })
          router.push(`/unemployment-benefits/${e.target.value}`)
        }}
        className="mt-2 h-12 w-full rounded-xl border border-border bg-white px-4 text-base text-ink"
      >
        <option value="" disabled>
          Choose your state
        </option>
        {ALL_STATE_CODES.map((code) => (
          <option key={code} value={stateSlug(code)}>
            {stateName(code)}
          </option>
        ))}
      </select>
    </div>
  )
}
