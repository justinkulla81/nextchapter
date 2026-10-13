import { Card, CardContent } from '@/components/ui/card'
import { SEGMENT_GUIDANCE, type OutcomeSegment } from '@/lib/outcomes/segments'

// Practical guidance for the situations a candidate is in. Informational only:
// it never changes how a candidate is ranked, matched or scored.
export function SegmentGuidanceCard({ segments }: { segments: OutcomeSegment[] }) {
  if (segments.length === 0) return null
  return (
    <div className="space-y-3">
      {segments.map((s) => (
        <Card key={s}>
          <CardContent className="space-y-2 pt-6">
            <p className="text-base font-semibold text-foreground">{SEGMENT_GUIDANCE[s].title}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {SEGMENT_GUIDANCE[s].points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
