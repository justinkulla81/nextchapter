import {
  BENEFITS_NETWORK_FUNCTIONS,
  BENEFITS_NETWORK_LEVELS,
  BENEFITS_NETWORK_FORMATS,
  BENEFITS_NETWORK_COST_TYPES,
  BENEFITS_NETWORK_TIME_COMMITMENTS,
  BENEFITS_NETWORK_CREDENTIAL_TYPES,
} from '@/lib/constants/benefits-network'
import { Button } from '@/components/ui/button'

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
export function BenefitsNetworkFilterBar({ current }: { current: Record<string, string | undefined> }) {
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
