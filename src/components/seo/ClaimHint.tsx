import { TrackedLink } from '@/components/marketing/TrackedLink'

/**
 * A single quiet line near the top of a public organization page for the people who run that organization: it says who the
 * claim is for and what it costs, and links to the claim page. Everyone else reads past it. The full claim section stays at the
 * bottom of the page; this only makes the offer findable without scrolling to it.
 */
export function ClaimHint({ href, event, properties, who, label = 'Claim this page, it is free' }: { href: string; event: string; properties?: Record<string, unknown>; who: string; label?: string }) {
  return (
    <span className="mt-3 block text-sm text-muted-foreground">
      {who}{' '}
      <TrackedLink href={href} event={event} properties={{ ...properties, placement: 'top' }} className="font-medium text-brand underline underline-offset-4">
        {label}
      </TrackedLink>
      .
    </span>
  )
}
