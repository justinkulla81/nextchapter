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
  weeklyPoints,
  weeklyPointsTarget,
}: {
  candidateId: string
  locked: boolean
  // Same live numbers already shown in Your Stats / the Weekly Search
  // Sprint card (computeWeeklyProgress, computed once per page load) —
  // passed in rather than recomputed so this can never disagree with them.
  // Victoria's own cached text below deliberately never states these
  // numbers itself (see weekly-focus.ts's prompt) — a cached LLM sentence
  // citing a point count would go stale mid-week and visibly contradict
  // the live count shown right next to it.
  weeklyPoints: number
  weeklyPointsTarget: number
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
              <p className="text-xs text-muted-foreground">
                Victoria&apos;s strategic read for this week · {weeklyPoints} of {weeklyPointsTarget} Sprint points so
                far
              </p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 px-5 pb-5">
          {FOCUS_SECTIONS.map((section) => (
            <div key={section.key}>
              <p className={`text-xs font-semibold tracking-wide uppercase ${section.color}`}>{section.label}</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-foreground">
                <li>{focus[section.key].text}</li>
                <li>{focus[section.key].recommendation}</li>
              </ul>
            </div>
          ))}
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
