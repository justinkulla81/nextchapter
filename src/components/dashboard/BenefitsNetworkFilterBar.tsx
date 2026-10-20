import {
  BENEFITS_NETWORK_FUNCTIONS,
  BENEFITS_NETWORK_LEVELS,
  BENEFITS_NETWORK_FORMATS,
  BENEFITS_NETWORK_COST_TYPES,
  BENEFITS_NETWORK_TIME_COMMITMENTS,
  BENEFITS_NETWORK_CREDENTIAL_TYPES,
} from '@/lib/constants/benefits-network'
import { Button } from '@/components/ui/button'
import { ChoiceField } from '@/components/candidate/ChoiceField'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'

function FilterSelect({ label, name, options, defaultValue }: { label: string; name: string; options: readonly string[]; defaultValue?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-xs text-muted-foreground">
        {label}
      </label>
      <select id={name} name={name} defaultValue={defaultValue ?? ''} className="w-full rounded-md border border-input px-2 py-1.5 text-sm">
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

// Plain GET form -- no client JS needed, matches the "5+ options -> dropdown"
// design principle and lets the URL itself be the shareable/bookmarkable
// filter state.
export function BenefitsNetworkFilterBar({ current, redesign = false }: { current: Record<string, string | undefined>; redesign?: boolean }) {
  // The redesign: one "Filter offers" control (saying how many filters are on) that opens the same six filters. Three or four
  // choices are buttons, more are dropdowns. Still a plain GET form, so the address holds the filters.
  if (redesign) {
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
  return (
    <form action="/dashboard/benefits-network" method="get" className="grid grid-cols-2 gap-3 rounded-lg border border-border p-4 sm:grid-cols-3 lg:grid-cols-6">
      <FilterSelect label="Function" name="function" options={BENEFITS_NETWORK_FUNCTIONS} defaultValue={current.function} />
      <FilterSelect label="Level" name="level" options={BENEFITS_NETWORK_LEVELS} defaultValue={current.level} />
      <FilterSelect label="Format" name="format" options={BENEFITS_NETWORK_FORMATS} defaultValue={current.format} />
      <FilterSelect label="Cost" name="costType" options={BENEFITS_NETWORK_COST_TYPES} defaultValue={current.costType} />
      <FilterSelect label="Time commitment" name="timeCommitment" options={BENEFITS_NETWORK_TIME_COMMITMENTS} defaultValue={current.timeCommitment} />
      <FilterSelect label="Credential" name="credentialType" options={BENEFITS_NETWORK_CREDENTIAL_TYPES} defaultValue={current.credentialType} />
      <div className="col-span-2 flex items-end gap-2 sm:col-span-3 lg:col-span-6">
        <Button type="submit" size="sm">
          Apply filters
        </Button>
        <a href="/dashboard/benefits-network" className="text-xs text-muted-foreground underline underline-offset-4">
          Clear
        </a>
      </div>
    </form>
  )
}
