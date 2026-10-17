import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getEngagementLead } from '@/lib/journey/engagement-data'
import { EngagementLink } from '@/components/dashboard/EngagementLink'

// "Get more from NextChapter": what the member hasn't connected or done yet and
// what each step unlocks, plus, in a stalled search, what to try next. Members
// who connect, prove their work and keep going get the most, so this sits near
// the top until there is nothing left to say. One primary action.
export async function EngagementCard({ candidateId }: { candidateId: string }) {
  const lead = await getEngagementLead(candidateId)
  if (!lead) return null
  const primary = lead.gate
    ? { key: 'gate', label: lead.gate.cta, href: lead.gate.href }
    : lead.steps[0]
      ? { key: lead.steps[0].key, label: lead.steps[0].label, href: lead.steps[0].href }
      : null

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">{lead.gate ? lead.gate.headline : 'Get more from NextChapter'}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{lead.gate ? lead.gate.body : lead.line}</p>
          {lead.gate && lead.steps.length > 0 && <p className="mt-2 text-sm text-muted-foreground">{lead.line}</p>}
        </div>
        {lead.steps.length > 0 && (
          <ul className="space-y-3">
            {lead.steps.map((step) => (
              <li key={step.key} className="text-sm">
                <EngagementLink href={step.href} stepKey={step.key} kind="unlock_step" level={lead.level} className="font-medium text-foreground underline-offset-4 hover:underline">
                  {step.label}
                </EngagementLink>
                <p className="text-muted-foreground">{step.why}</p>
                <p className="text-xs text-muted-foreground">Unlocks: {step.unlocks}</p>
              </li>
            ))}
          </ul>
        )}
        {primary && (
          <Button
            nativeButton={false}
            render={<EngagementLink href={primary.href} stepKey={primary.key} kind={lead.gate ? 'gate_move' : 'unlock_step'} level={lead.level} />}
          >
            {primary.label}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
