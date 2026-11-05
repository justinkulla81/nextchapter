import { TrackedLink } from '@/components/marketing/TrackedLink'
import { Chips, LINK } from '@/components/topics/blocks'

/**
 * Under a page's state list: a link to each state's unemployment page (its rule on severance, the weekly amount and how to file) and
 * one to the hub for every state. `states` is the list the page already shows, so each slug has an unemployment page. `kind` and
 * `hubEvent` name the page's analytics events so each page family keeps its own.
 */
export function StateUnemploymentLinks({
  states,
  kind,
  hubEvent,
  properties,
}: {
  states: { name: string; slug: string }[]
  kind: string
  hubEvent: string
  properties: Record<string, unknown>
}) {
  if (states.length === 0) return null
  return (
    <>
      <p className="mt-6 text-sm text-muted-foreground">
        Between jobs? Unemployment benefits and severance rules in these states, or{' '}
        <TrackedLink href="/unemployment-benefits" event={hubEvent} properties={properties} className={LINK}>
          in every state
        </TrackedLink>
        .
      </p>
      <div className="mt-2">
        <Chips kind={kind} event="topic_link_clicked" items={states.map((s) => ({ href: `/unemployment-benefits/${s.slug}`, label: `${s.name} unemployment` }))} />
      </div>
    </>
  )
}
