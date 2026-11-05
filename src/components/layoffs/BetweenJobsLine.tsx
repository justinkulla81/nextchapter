import { TrackedLink } from '@/components/marketing/TrackedLink'

const LINK = 'text-brand underline underline-offset-4'

/**
 * One line for a layoff listing page that has no path of its own to the state unemployment pages: the hub, where each state's rule on
 * severance, weekly amount and how to file is. `page` names the page family in the analytics event.
 */
export function BetweenJobsLine({ page, className = 'mt-10' }: { page: string; className?: string }) {
  return (
    <p className={`${className} text-sm text-muted-foreground`}>
      Laid off or between jobs?{' '}
      <TrackedLink href="/unemployment-benefits" event="layoffs_unemployment_link_clicked" properties={{ page }} className={LINK}>
        Unemployment benefits and severance rules by state
      </TrackedLink>
      .
    </p>
  )
}
