import Link from 'next/link'
import { cn } from '@/lib/utils'

interface FilterToggleProps {
  label: string
  paramKey: 'city' | 'function' | 'industry'
  currentValue: string
  ownValue: string | null
  otherParams: Record<string, string>
}

function FilterToggle({ label, paramKey, currentValue, ownValue, otherParams }: FilterToggleProps) {
  if (!ownValue) return null

  const isFilteredToOwn = currentValue === ownValue
  const buildHref = (value: string) => {
    const params = new URLSearchParams({ ...otherParams, [paramKey]: value })
    return `/dashboard/community?${params.toString()}`
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <Link
        href={buildHref(ownValue)}
        className={cn(
          'rounded-md px-2 py-1',
          isFilteredToOwn ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
        )}
      >
        {ownValue}
      </Link>
      <Link
        href={buildHref('')}
        className={cn(
          'rounded-md px-2 py-1',
          !currentValue ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
        )}
      >
        All
      </Link>
    </div>
  )
}

export function CommunityFilterBar({
  cityFilter,
  functionFilter,
  industryFilter,
  ownCity,
  ownFunction,
  ownIndustry,
}: {
  cityFilter: string
  functionFilter: string
  industryFilter: string
  ownCity: string | null
  ownFunction: string | null
  ownIndustry: string | null
}) {
  return (
    <div className="flex flex-wrap gap-4 rounded-lg border border-border p-3">
      <FilterToggle
        label="City"
        paramKey="city"
        currentValue={cityFilter}
        ownValue={ownCity}
        otherParams={{ function: functionFilter, industry: industryFilter }}
      />
      <FilterToggle
        label="Function"
        paramKey="function"
        currentValue={functionFilter}
        ownValue={ownFunction}
        otherParams={{ city: cityFilter, industry: industryFilter }}
      />
      <FilterToggle
        label="Industry"
        paramKey="industry"
        currentValue={industryFilter}
        ownValue={ownIndustry}
        otherParams={{ city: cityFilter, function: functionFilter }}
      />
    </div>
  )
}
