import { getOrDraftWeeklyFocus, type WeeklyFocus } from '@/lib/reports/weekly-focus'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Spinner } from '@/components/ui/spinner'
import { VictoriaAvatar } from '@/components/VictoriaAvatar'

const FOCUS_SECTIONS: { key: keyof WeeklyFocus; label: string; color: string }[] = [
  { key: 'increase', label: 'Do more of', color: 'text-success' },
  { key: 'adjust', label: 'Adjust', color: 'text-warning' },
  { key: 'maintain', label: 'Keep doing', color: 'text-brand' },
  { key: 'startNew', label: 'Start new', color: 'text-orange' },
]

// This Week's Focus — Victoria's strategic read sitting above the Weekly
// Search Sprint card: what to increase/adjust/maintain/start new, connecting
// Search Strategy + this week's Sprint progress + real outcomes into
// direction, which the Sprint card then turns into concrete tasks. Reads the
// same self-cached getOrDraftWeeklyFocus result the Market Reality Report's
// closing section also uses — never a second Anthropic call for the same
// week. Renders nothing (not a fallback message) when there's no sprint yet
// to reflect on, since that's the honest "nothing to say yet" state.
export async function WeeklyFocusCard({ candidateId, isMonday }: { candidateId: string; isMonday: boolean }) {
  const focus = await getOrDraftWeeklyFocus(candidateId)
  if (!focus) return null

  return (
    <Accordion defaultValue={isMonday ? ['weekly-focus'] : []}>
      <AccordionItem value="weekly-focus" className="border-brand/20 bg-brand/5">
        <AccordionTrigger className="px-5 py-4 hover:text-foreground">
          <div className="flex items-center gap-3">
            <VictoriaAvatar size={36} />
            <div>
              <CardTitle className="text-sm font-medium text-foreground">
                Victoria&apos;s Advice for Your Weekly Search Strategy
              </CardTitle>
              <p className="text-xs text-muted-foreground">Victoria&apos;s strategic read for this week</p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-5 pb-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {FOCUS_SECTIONS.map((section) => (
              <div key={section.key} className="rounded-lg border border-border bg-white p-4">
                <p className={`text-xs font-semibold tracking-wide uppercase ${section.color}`}>{section.label}</p>
                <p className="mt-1 text-sm text-foreground">{focus[section.key].text}</p>
                <p className="mt-3 text-sm text-foreground">
                  <span className="font-semibold">Recommendation:</span> {focus[section.key].recommendation}
                </p>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

export function WeeklyFocusSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <VictoriaAvatar size={36} />
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Victoria&apos;s Advice for Your Weekly Search Strategy
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size={16} />
          Putting together your focus for the week…
        </div>
      </CardContent>
    </Card>
  )
}
