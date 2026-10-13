import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { getMentorStats } from '@/lib/higher-ed/views'
import { StatTile } from './StatTile'

// Alumni Relations > Mentors. Counts only, with no names or notes. Mentoring is
// the alumni's own offer; the college sees how much of it is happening.
export async function MentorStatsScreen({ ctx }: { ctx: WorkspaceContext }) {
  const s = await getMentorStats(ctx)
  return (
    <div className="max-w-3xl space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Alumni offering calls" value={s.activeMentors} />
        <StatTile label="Requests this month" value={s.requestsThisMonth} />
        <StatTile label="Accepted this month" value={s.acceptedThisMonth} />
        <StatTile label="Calls completed" value={s.completedThisMonth} note={`${s.completedAllTime} all time`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TagList title="Industries alumni can speak to" items={s.topIndustries} />
        <TagList title="Functions alumni can speak to" items={s.topFunctions} />
      </div>
      <p className="text-xs text-muted-foreground">
        Alumni choose to offer calls and see only each other&apos;s first name and last initial. This view shows counts only, with no names or notes, and
        lists a topic only when at least three alumni cover it.
      </p>
    </div>
  )
}

function TagList({ title, items }: { title: string; items: { tag: string; mentors: number }[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Appears once at least three alumni cover the same topic.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {items.map((i) => (
            <li key={i.tag} className="flex justify-between">
              <span>{i.tag}</span>
              <span className="tabular-nums text-muted-foreground">{i.mentors}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
