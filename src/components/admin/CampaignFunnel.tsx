import type { CampaignFunnelData, ProfileCutRow } from '@/lib/admin/campaign-funnel'
import { SEGMENTS } from '@/lib/marketing/campaign-tag'

function pct(part: number, whole: number): string {
  if (whole <= 0) return '–'
  const p = (part / whole) * 100
  return `${p >= 10 ? Math.round(p) : p.toFixed(1)}%`
}

const n = (value: number) => value.toLocaleString('en-US')

function Head({ first, visitors }: { first: string; visitors: boolean }) {
  return (
    <thead>
      <tr className="text-left text-xs text-muted-foreground">
        <th className="pb-1 font-normal">{first}</th>
        {visitors && <th className="pb-1 text-right font-normal">Visitors</th>}
        <th className="pb-1 text-right font-normal">Registered</th>
        <th className="pb-1 text-right font-normal">Activated in 7 days</th>
        <th className="pb-1 text-right font-normal">Rate</th>
      </tr>
    </thead>
  )
}

function Cells({ row, visitors }: { row: { registered: number; matured: number; activated: number; visitors?: number }; visitors: boolean }) {
  return (
    <>
      {visitors && <td className="py-1.5 text-right tabular-nums">{n(row.visitors ?? 0)}</td>}
      <td className="py-1.5 text-right tabular-nums">{n(row.registered)}</td>
      <td className="py-1.5 text-right tabular-nums">{n(row.activated)} of {n(row.matured)}</td>
      <td className="py-1.5 text-right tabular-nums">{pct(row.activated, row.matured)}</td>
    </>
  )
}

function ProfileCut({ title, rows }: { title: string; rows: ProfileCutRow[] }) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium">{title}</h3>
      <table className="w-full text-sm">
        <Head first="Answer" visitors={false} />
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t">
              <td className="py-1.5">{r.label}</td>
              <Cells row={r} visitors={false} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CampaignFunnel({ data }: { data: CampaignFunnelData }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Campaigns and segments</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Who engages most. A campaign is credited to a person by their first tagged visit before they registered. Activated means
          onboarded, a résumé in, and a job saved or opened within 7 days of registering; the rate counts only people who registered at
          least 7 days ago. With a handful of people per row, read the counts before the rates.
        </p>
      </div>

      {data.campaigns.length === 0 ? (
        <p className="rounded-md border p-3 text-sm text-muted-foreground">
          No tagged visits in this window. Build every campaign link on the Tagged links page, as utm_campaign=&lt;segment&gt;-&lt;channel&gt;,
          for example laid-off-recent-google. Segments: {SEGMENTS.map((s) => s.key).join(', ')}.
        </p>
      ) : (
        <>
          <div className="space-y-1">
            <h3 className="text-sm font-medium">By segment tag</h3>
            <table className="w-full text-sm">
              <Head first="Segment" visitors />
              <tbody>
                {data.segments.map((s) => (
                  <tr key={s.segment} className="border-t">
                    <td className="py-1.5">{s.label}</td>
                    <Cells row={s} visitors />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-medium">By campaign</h3>
            <table className="w-full text-sm">
              <Head first="Campaign" visitors />
              <tbody>
                {data.campaigns.map((c) => (
                  <tr key={c.campaign} className="border-t">
                    <td className="py-1.5">
                      <div className="font-medium">{c.campaign}</div>
                      <div className="text-xs text-muted-foreground">{c.segmentLabel}{c.channel ? ` · ${c.channel}` : ''}</div>
                    </td>
                    <Cells row={c} visitors />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          The same people by what they told us in their profile, for everyone who registered in this window ({n(data.registeredTotal)}),
          however they arrived.
        </p>
        <ProfileCut title="By job status" rows={data.byStatus} />
        <ProfileCut title="By level" rows={data.byLevel} />
      </div>
    </section>
  )
}
