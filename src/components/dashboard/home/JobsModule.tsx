import Link from 'next/link'
import { HomeModule } from './HomeModule'

// A quiet summary of the job search with one way in. The fresh-jobs prompt
// (a real, live signal) renders inside it when there is one.
export function JobsModule({
  saved,
  applied,
  interviews,
  children,
}: {
  saved: number
  applied: number
  interviews: number
  children?: React.ReactNode
}) {
  return (
    <HomeModule
      title="Jobs"
      action={
        <Link href="/dashboard/find-my-job" className="text-sm font-medium text-brand underline underline-offset-4">
          Open Jobs
        </Link>
      }
    >
      <dl className="grid grid-cols-3 gap-3 text-center">
        {[
          ['Saved', saved],
          ['Applied', applied],
          ['Interviews', interviews],
        ].map(([label, n]) => (
          <div key={label as string}>
            <dd className="text-2xl font-semibold tabular-nums">{n}</dd>
            <dt className="text-xs text-muted-foreground">{label}</dt>
          </div>
        ))}
      </dl>
      {children}
    </HomeModule>
  )
}
