import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'

// Highest-priority Daily Message override (see PageHeaderBoxes'
// dailyMessageOverride) — shown ahead of even PreConnectDailyMessage for a
// candidate who just earned the Market Reality Assessment badge and hasn't
// looked at the Badges shelf yet (see page.tsx's badgesLastSeenCount === null
// check). The badge is the first thing most candidates ever earn, so the
// report it's tied to is the single most relevant thing to point them at —
// reading it before being asked to connect Gmail/Calendar/LinkedIn.
export function ReportReadyDailyMessage({ firstName }: { firstName: string }) {
  return (
    <Card className="border-brand/30 bg-brand/5">
      <CardContent className="space-y-2">
        <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Daily Message</p>
        <p className="text-sm font-semibold text-navy">
          Nice work, {firstName} — you just earned the Market Reality Assessment badge!
        </p>
        <p className="text-sm text-foreground">
          Your report breaks down exactly how the market sees you today, and what to fix first to
          raise your grade.
        </p>
        <Link
          href="/dashboard/market-reality"
          className="inline-block text-sm font-semibold text-primary underline underline-offset-4"
        >
          Read your Market Reality Report →
        </Link>
      </CardContent>
    </Card>
  )
}
