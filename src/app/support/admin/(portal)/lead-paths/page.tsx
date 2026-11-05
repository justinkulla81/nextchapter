import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { computeLeadPaths, type Nudges } from '@/lib/admin/lead-paths'

export const metadata = { title: 'Registration and lead paths' }
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const RANGES = [7, 30, 90, 365]
const SITE = 'https://launchyournextchapter.com'
const TIME_ZONE = 'America/New_York'
const LIST_LIMIT = 500

const STEP_LABEL: Record<string, string> = {
  welcome: 'Welcome',
  nudge1: 'Reminder 1',
  nudge2: 'Reminder 2',
  next_step: 'Day 3',
  data_point: 'Day 7',
  assessment: 'Day 14',
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return '–'
  const p = (part / whole) * 100
  return `${p >= 10 ? Math.round(p) : p.toFixed(1)}%`
}

function day(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TIME_ZONE })
}

function PageLink({ path }: { path: string | null }) {
  if (!path) return <span className="text-muted-foreground">Unknown</span>
  return (
    <a href={`${SITE}${path}`} target="_blank" rel="noreferrer" className="break-all hover:underline">
      {path}
    </a>
  )
}

function nudgeText(n: Nudges | null): string {
  if (!n || n.steps.length === 0) return 'None sent'
  const steps = n.steps.map((s) => STEP_LABEL[s] ?? s).join(', ')
  return `${steps}${n.opened ? ' · opened' : ''}${n.clicked ? ' · clicked' : ''}`
}

export default async function LeadPathsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireAdmin()
  const sp = await searchParams
  const requested = Number(sp.days)
  const days = RANGES.includes(requested) ? requested : 30
  const data = await computeLeadPaths(days)

  const { starters, givers, stops } = data
  const startersRegistered = starters.filter((s) => s.registered).length
  const startersWithEmail = starters.filter((s) => s.email).length
  const giversNudged = givers.filter((g) => g.nudges.steps.length > 0).length
  const giversClicked = givers.filter((g) => g.nudges.clicked).length
  const giversRegistered = givers.filter((g) => g.registered).length
  const biggestLeak = stops
    .filter((r) => r.stop.path && r.stoppedHere > 0)
    .sort((a, b) => b.stoppedHere - a.stoppedHere)[0]

  return (
    <div className="mx-auto max-w-6xl space-y-10 p-6">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Registration and lead paths</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone who started the registration path, everyone who gave an email, the nudges we sent them, whether
            they registered, and the page they fell off at. Last {days} days.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/support/admin/lead-paths?days=${r}`}
              aria-current={r === days ? 'true' : undefined}
              className={`rounded-md border px-3 py-1.5 text-sm ${r === days ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              {r === 365 ? 'Year' : `${r} days`}
            </Link>
          ))}
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li className="rounded-lg border p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Started the registration path</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{starters.length.toLocaleString('en-US')}</p>
            <p className="text-sm text-muted-foreground">
              {startersRegistered} registered ({pct(startersRegistered, starters.length)}), {startersWithEmail} left an email
              {biggestLeak && (
                <>
                  . Most stop at <PageLink path={biggestLeak.stop.path} /> ({biggestLeak.stoppedHere}).
                </>
              )}
            </p>
          </li>
          <li className="rounded-lg border p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Gave an email</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{givers.length.toLocaleString('en-US')}</p>
            <p className="text-sm text-muted-foreground">
              {giversNudged} nudged, {giversClicked} clicked a nudge, {giversRegistered} registered ({pct(giversRegistered, givers.length)})
            </p>
          </li>
        </ul>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">1 · Registration path: where people stop</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A profile exists the moment someone answers the first question, so this counts everyone who started. Each row is the
            page people are on now; &ldquo;Got past&rdquo; is the share of those who reached the step that went further.
          </p>
        </div>
        {starters.length === 0 ? (
          <p className="rounded-md border p-6 text-sm text-muted-foreground">Nobody started the registration path in this window. Try a longer range.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-normal">Step</th>
                  <th className="px-3 py-2 font-normal">Page they fall off at</th>
                  <th className="px-3 py-2 text-right font-normal">Reached</th>
                  <th className="px-3 py-2 text-right font-normal">Stopped here</th>
                  <th className="px-3 py-2 text-right font-normal">Got past</th>
                  <th className="px-3 py-2 text-right font-normal">Of all starters</th>
                </tr>
              </thead>
              <tbody>
                {stops.map((r) => (
                  <tr key={r.stop.rank} className="border-t">
                    <td className="px-3 py-2">{r.stop.label}</td>
                    <td className="px-3 py-2">
                      <PageLink path={r.stop.path} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.reached}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.stop.path ? r.stoppedHere : '–'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.stop.path ? pct(r.reached - r.stoppedHere, r.reached) : '–'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct(r.reached, starters.length)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">2 · Email givers: nudges and conversion</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            By the first form each address used. Nudged is any welcome, reminder or follow-up email we sent. Clicked means a link
            in one of them was clicked. Registered counts accounts made at any time since.
          </p>
        </div>
        {data.bySource.length === 0 ? (
          <p className="rounded-md border p-6 text-sm text-muted-foreground">No emails captured in this window. Try a longer range.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-normal">First form</th>
                  <th className="px-3 py-2 text-right font-normal">Gave email</th>
                  <th className="px-3 py-2 text-right font-normal">Nudged</th>
                  <th className="px-3 py-2 text-right font-normal">Clicked</th>
                  <th className="px-3 py-2 text-right font-normal">Registered</th>
                  <th className="px-3 py-2 text-right font-normal">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {data.bySource.map((r) => (
                  <tr key={r.source} className="border-t">
                    <td className="px-3 py-2">{r.source}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.captured}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.nudged}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.clicked}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.registered}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct(r.registered, r.captured)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {data.fallOff.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">3 · Pages email givers were last seen on, before registering</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The last page viewed from the network each address was given from, for the people who have not registered. An
              address on a shared network can show another person&apos;s page.
            </p>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-normal">Page</th>
                  <th className="px-3 py-2 text-right font-normal">People</th>
                  <th className="px-3 py-2 text-right font-normal">Of those not registered</th>
                </tr>
              </thead>
              <tbody>
                {data.fallOff.map((r) => (
                  <tr key={r.path} className="border-t">
                    <td className="px-3 py-2">
                      <PageLink path={r.path} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.people}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct(r.people, givers.length - giversRegistered)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">4 · Everyone who started the registration path</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Newest first{data.startersTruncated ? `, the first ${starters.length} of more` : ''}. &ldquo;Stopped at&rdquo; is the page they would be sent to next.
            {starters.length > LIST_LIMIT && ` Showing ${LIST_LIMIT} of ${starters.length}; pick a shorter range to see the rest.`}
          </p>
        </div>
        {starters.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-normal">Started</th>
                  <th className="px-3 py-2 font-normal">Person</th>
                  <th className="px-3 py-2 font-normal">Came in on</th>
                  <th className="px-3 py-2 font-normal">Stopped at</th>
                  <th className="px-3 py-2 font-normal">Nudges</th>
                  <th className="px-3 py-2 font-normal">Registered</th>
                </tr>
              </thead>
              <tbody>
                {starters.slice(0, LIST_LIMIT).map((s) => (
                  <tr key={s.id} className="border-t align-top">
                    <td className="whitespace-nowrap px-3 py-2">{day(s.startedAt)}</td>
                    <td className="px-3 py-2">
                      <Link href={`/support/admin/candidates/${s.id}`} className="hover:underline">
                        {s.name ?? s.email ?? 'No name or email yet'}
                      </Link>
                      {s.name && s.email && <div className="text-xs text-muted-foreground">{s.email}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <PageLink path={s.entryPath} />
                      {s.entryFrom && <div className="text-xs text-muted-foreground">{s.entryFrom}</div>}
                    </td>
                    <td className="px-3 py-2">
                      {s.stop.label}
                      {s.stop.path && (
                        <div className="text-xs">
                          <PageLink path={s.stop.path} />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">{s.email ? nudgeText(s.nudges) : 'No email'}</td>
                    <td className="px-3 py-2">{s.registered ? 'Yes' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">5 · Everyone who gave an email</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One row per address, newest first.
            {givers.length > LIST_LIMIT && ` Showing ${LIST_LIMIT} of ${givers.length}; pick a shorter range to see the rest.`}
          </p>
        </div>
        {givers.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-normal">Given</th>
                  <th className="px-3 py-2 font-normal">Email</th>
                  <th className="px-3 py-2 font-normal">First form</th>
                  <th className="px-3 py-2 font-normal">Nudges</th>
                  <th className="px-3 py-2 font-normal">Last page seen</th>
                  <th className="px-3 py-2 font-normal">Registered</th>
                </tr>
              </thead>
              <tbody>
                {givers.slice(0, LIST_LIMIT).map((g) => (
                  <tr key={g.email} className="border-t align-top">
                    <td className="whitespace-nowrap px-3 py-2">{day(g.firstSeen)}</td>
                    <td className="px-3 py-2">
                      {g.nudges.personId ? (
                        <a href={`https://admin.launchyournextchapter.com/support/admin/crm/people/${g.nudges.personId}`} className="hover:underline">
                          {g.email}
                        </a>
                      ) : (
                        g.email
                      )}
                      {g.name && <div className="text-xs text-muted-foreground">{g.name}</div>}
                      {g.unsubscribed && <div className="text-xs text-muted-foreground">unsubscribed</div>}
                    </td>
                    <td className="px-3 py-2">{g.firstWhere}</td>
                    <td className="px-3 py-2">{nudgeText(g.nudges)}</td>
                    <td className="px-3 py-2">{g.registered ? '' : <PageLink path={g.lastPath} />}</td>
                    <td className="px-3 py-2">{g.registered ? 'Yes' : ''}</td>
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
