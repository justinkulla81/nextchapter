import type { NurtureFunnelData } from '@/lib/admin/nurture-funnel'

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '–')

// The follow-up sequence block of the admin funnel page (data: src/lib/admin/nurture-funnel.ts).
export function NurtureFunnel({ data }: { data: NurtureFunnelData }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">5 · Follow-up emails to people who gave an email</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.on
            ? 'Three short emails over two weeks (day 3, 7 and 14 after the capture’s own email), then we stop. Anyone registered, unsubscribed or bounced is skipped.'
            : 'Sending is off (NURTURE_EMAILS is not 1). The daily run reports what it would send in its response; nothing goes out and this table stays at zero.'}
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="pb-1 font-normal">Step</th>
            <th className="pb-1 text-right font-normal">Sent</th>
            <th className="pb-1 text-right font-normal">Opened</th>
            <th className="pb-1 text-right font-normal">Clicked</th>
          </tr>
        </thead>
        <tbody>
          {data.steps.map((s) => (
            <tr key={s.step} className="border-t">
              <td className="py-1.5">{s.label}</td>
              <td className="py-1.5 text-right tabular-nums">{s.sent.toLocaleString('en-US')}</td>
              <td className="py-1.5 text-right tabular-nums">
                {s.opened.toLocaleString('en-US')} <span className="text-xs text-muted-foreground">{pct(s.opened, s.sent)}</span>
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {s.clicked.toLocaleString('en-US')} <span className="text-xs text-muted-foreground">{pct(s.clicked, s.sent)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-sm">
        <span className="font-semibold tabular-nums">{data.registeredAfter.toLocaleString('en-US')}</span> of {data.recipients.toLocaleString('en-US')} people who got a sequence email
        have since registered.
      </p>
    </section>
  )
}
