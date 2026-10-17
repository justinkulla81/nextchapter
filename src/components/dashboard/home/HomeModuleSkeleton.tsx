import { HomeModule } from './HomeModule'

// What a Home module shows while its data streams in: the same card, with the
// real title, so the page keeps its shape and nothing jumps when the data lands.
export function HomeModuleSkeleton({ title, rows = 2 }: { title: string; rows?: number }) {
  return (
    <HomeModule title={title}>
      <div role="status" aria-busy="true" className="space-y-3">
        <span className="sr-only">Loading {title.toLowerCase()}…</span>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-muted" style={{ width: `${90 - i * 20}%` }} />
        ))}
      </div>
    </HomeModule>
  )
}
