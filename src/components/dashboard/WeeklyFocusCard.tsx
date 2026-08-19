import { Lock } from 'lucide-react'
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
export async function WeeklyFocusCard({
  candidateId,
  locked,
}: {
  candidateId: string
  locked: boolean
}) {
  // Skip the (self-cached but still real) LLM draft entirely while locked —
  // there's nothing to show, and no reason to spend the call before the
  // candidate has connected the accounts this advice is grounded in.
  if (locked) {
    return (
      <Card className="border-orange/20 bg-orange/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <VictoriaAvatar size={36} />
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Victoria&apos;s Advice for Your Weekly Search Strategy
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Unlocks once you connect Gmail/Calendar and LinkedIn above
              </p>
            </div>
            <Lock className="size-4 shrink-0 text-orange" aria-hidden />
          </div>
        </CardHeader>
      </Card>
    )
  }

  const focus = await getOrDraftWeeklyFocus(candidateId)
  if (!focus) return null

  return (
    <Accordion defaultValue={['weekly-focus']}>
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
          <ul className="space-y-2.5">
            {FOCUS_SECTIONS.map((section) => (
              <li key={section.key} className="flex flex-wrap gap-x-1.5 text-sm">
                <span className={`shrink-0 font-semibold ${section.color}`}>{section.label}:</span>
                <span className="text-foreground">
                  {focus[section.key].text} {focus[section.key].recommendation}
                </span>
              </li>
            ))}
          </ul>
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
