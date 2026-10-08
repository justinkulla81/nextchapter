import type { RapSheetContent } from '@/lib/crm/rap-sheet/types'

const safe = (u: string | null) => (u && /^https?:\/\//.test(u) ? u : null)
function Src({ url }: { url: string | null }) {
  const href = safe(url)
  return href ? <> · <a href={href} target="_blank" rel="noreferrer" className="underline">source</a></> : null
}
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-1"><h3 className="text-sm font-semibold">{title}</h3>{children}</section>
}
const Empty = () => <p className="text-sm text-muted-foreground">Nothing found.</p>

export function RapSheetView({ c }: { c: RapSheetContent }) {
  return (
    <div className="space-y-5 text-sm">
      <div><p className="font-medium">{c.headline}</p><p className="mt-1">{c.whoTheyAre}</p></div>
      <Block title="The pitch">
        <p className="font-medium">{c.pitch.angle}</p>
        <ul className="list-disc space-y-1 pl-5">{c.pitch.howItHelps.map((x, i) => <li key={i}>{x}</li>)}</ul>
        {c.pitch.openingLine && <p><b>Open with:</b> {c.pitch.openingLine}</p>}
        {c.pitch.ask && <p><b>The ask:</b> {c.pitch.ask}</p>}
        {c.pitch.objections.length > 0 && (
          <ul className="list-disc space-y-1 pl-5">{c.pitch.objections.map((o, i) => <li key={i}><i>{o.objection}</i> {o.response}</li>)}</ul>
        )}
      </Block>
      <Block title="Our history with them">
        {c.relationship.length ? <ul className="list-disc space-y-1 pl-5">{c.relationship.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="text-muted-foreground">No logged history.</p>}
      </Block>
      <Block title="Local picture"><p>{c.local.summary}</p><ul className="list-disc space-y-1 pl-5">{c.local.points.map((x, i) => <li key={i}>{x}</li>)}</ul></Block>
      <Block title="Layoffs">
        <p>{c.layoffs.summary}</p>
        {c.layoffs.items.length ? <ul className="list-disc space-y-1 pl-5">{c.layoffs.items.map((x, i) => <li key={i}><b>{x.employer}</b>{x.date ? ` (${x.date})` : ''}: {x.detail}<Src url={x.sourceUrl} /></li>)}</ul> : <Empty />}
      </Block>
      <Block title="Initiatives">
        {c.initiatives.length ? <ul className="list-disc space-y-1 pl-5">{c.initiatives.map((x, i) => <li key={i}><b>{x.name}:</b> {x.detail}<Src url={x.sourceUrl} /></li>)}</ul> : <Empty />}
      </Block>
      <Block title="White-collar metrics">
        {c.whiteCollar.length ? <ul className="list-disc space-y-1 pl-5">{c.whiteCollar.map((x, i) => <li key={i}><b>{x.metric}:</b> {x.value} — {x.context}<Src url={x.sourceUrl} /></li>)}</ul> : <Empty />}
      </Block>
      {c.caveats.length > 0 && <Block title="Could not confirm"><ul className="list-disc space-y-1 pl-5">{c.caveats.map((x, i) => <li key={i}>{x}</li>)}</ul></Block>}
      {c.sources.length > 0 && (
        <Block title="Sources"><ul className="list-disc space-y-1 pl-5">{c.sources.map((s, i) => <li key={i}>{safe(s.url) ? <a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.title || s.url}</a> : s.title}</li>)}</ul></Block>
      )}
    </div>
  )
}
