import { describeAuditAction } from '@/lib/partners/audit-labels'

export interface DownloadItem {
  label: string
  href: string
  note: string
  /** Link text; defaults to "Download CSV". */
  action?: string
}

export interface ActivityRow {
  id: string
  action: string
  actor: string | null
  at: Date
}

// "Downloads and activity", the same page in every partner portal: what they can
// export, and a plain record of who did what in their workspace.
export function PartnerActivity({ downloads, events }: { downloads: DownloadItem[]; events: ActivityRow[] }) {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Downloads and activity</h1>
        <p className="max-w-2xl text-muted-foreground">Export your data as a spreadsheet, and see who did what in your workspace. Every download is recorded here.</p>
      </div>

      <section className="space-y-3" aria-labelledby="dl">
        <h2 id="dl" className="text-lg font-semibold">Downloads</h2>
        {downloads.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to download from your role.</p>
        ) : (
          <ul className="space-y-2">
            {downloads.map((d) => (
              <li key={d.href} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4 text-sm">
                <span>
                  <span className="font-medium">{d.label}</span>
                  <span className="block text-muted-foreground">{d.note}</span>
                </span>
                {/* A plain link: the route sends the file, so the browser downloads it. */}
                <a href={d.href} className="rounded-full border border-border px-4 py-1.5 font-semibold hover:bg-muted">
                  {d.action ?? 'Download CSV'}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="act">
        <h2 id="act" className="text-lg font-semibold">Recent activity</h2>
        {events.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Nothing yet. Downloads, brand changes and team changes show up here.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Who</th>
                  <th className="px-4 py-2">What</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">{e.at.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                    <td className="px-4 py-2">{e.actor ?? 'System'}</td>
                    <td className="px-4 py-2">{describeAuditAction(e.action)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
