import {
  BENEFITS_NETWORK_FUNCTIONS,
  BENEFITS_NETWORK_LEVELS,
  BENEFITS_NETWORK_FORMATS,
  BENEFITS_NETWORK_COST_TYPES,
  BENEFITS_NETWORK_TIME_COMMITMENTS,
  BENEFITS_NETWORK_CREDENTIAL_TYPES,
} from '@/lib/constants/benefits-network'
import { ChoiceField } from '@/components/candidate/ChoiceField'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'

// Plain GET form -- no client JS needed, matches the "5+ options -> dropdown"
// design principle and lets the URL itself be the shareable/bookmarkable
// filter state.
export function BenefitsNetworkFilterBar({ current }: { current: Record<string, string | undefined> }) {
  // The redesign: one "Filter offers" control (saying how many filters are on) that opens the same six filters. Three or four
  // choices are buttons, more are dropdowns. Still a plain GET form, so the address holds the filters.
  const on = ['function', 'level', 'format', 'costType', 'timeCommitment', 'credentialType'].filter((k) => current[k]).length
  const opts = (list: readonly string[]) => [{ value: '', label: 'Any' }, ...list.map((o) => ({ value: o, label: o }))]
  return (
    <details className="group" open={on > 0 || undefined}>
      <summary className="inline-flex h-10 cursor-pointer list-none items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted [&::-webkit-details-marker]:hidden">
        {on > 0 ? `Filter offers (${on} on)` : 'Filter offers'}
      </summary>
      <form action="/dashboard/benefits-network" method="get" className="mt-4 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <ChoiceField name="function" label="Function" options={opts(BENEFITS_NETWORK_FUNCTIONS)} defaultValue={current.function ?? ''} />
          <ChoiceField name="level" label="Level" options={opts(BENEFITS_NETWORK_LEVELS)} defaultValue={current.level ?? ''} />
          <ChoiceField name="format" label="Format" options={opts(BENEFITS_NETWORK_FORMATS)} defaultValue={current.format ?? ''} />
          <ChoiceField name="costType" label="Cost" options={opts(BENEFITS_NETWORK_COST_TYPES)} defaultValue={current.costType ?? ''} />
          <ChoiceField name="timeCommitment" label="Time commitment" options={opts(BENEFITS_NETWORK_TIME_COMMITMENTS)} defaultValue={current.timeCommitment ?? ''} />
          <ChoiceField name="credentialType" label="Credential" options={opts(BENEFITS_NETWORK_CREDENTIAL_TYPES)} defaultValue={current.credentialType ?? ''} />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <ActionSubmit variant="secondary" pendingLabel="Filtering…" event="benefits_network_filtered" props={{ filtersOn: on }}>
            Apply filters
          </ActionSubmit>
          <a href="/dashboard/benefits-network" className="text-sm font-medium text-brand underline underline-offset-4">
            Clear filters
          </a>
        </div>
      </form>
    </details>
  )
}
