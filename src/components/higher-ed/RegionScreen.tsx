// "Local market" (Alumni Relations and Career Services): the college's
// region, from two kinds of source, both labeled:
//   - live: WARN notices and the WIOA board directory NextChapter already
//     syncs (WarnNotice, WorkforceBoard), when they cover these counties;
//   - profile: public figures stored on Institution.profile, each with its
//     source and period.
// No member data on this screen.

import { ExternalLink, Landmark, MapPin, Newspaper, TrendingDown } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { regionAreas, type InstitutionProfile, type Sourced } from '@/lib/higher-ed/profile'

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function SourceNote({ s }: { s: { source: string; sourceUrl?: string | null; asOf?: string | null } }) {
  return (
    <p className="mt-2 text-[11px] text-muted-foreground">
      Source:{' '}
      {s.sourceUrl ? (
        <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
          {s.source}
        </a>
      ) : (
        s.source
      )}
      {s.asOf ? ` · ${s.asOf}` : ''}
    </p>
  )
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Trend({ trend }: { trend: Sourced<{ area: string; points: { period: string; rate: number }[] }> }) {
  const pts = trend.points
  if (pts.length < 2) return null
  const w = 320
  const h = 80
  const rates = pts.map((p) => p.rate)
  const min = Math.min(...rates) - 0.2
  const max = Math.max(...rates) + 0.2
  const x = (i: number) => (i / (pts.length - 1)) * (w - 8) + 4
  const y = (r: number) => h - 6 - ((r - min) / (max - min)) * (h - 12)
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.rate).toFixed(1)}`).join(' ')
  const first = pts[0]
  const last = pts[pts.length - 1]
  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full" role="img" aria-label={`${trend.area} unemployment rate from ${first.rate}% (${first.period}) to ${last.rate}% (${last.period})`}>
        <path d={d} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx={x(pts.length - 1)} cy={y(last.rate)} r="3" fill="var(--primary)" />
      </svg>
      <figcaption className="flex justify-between text-[11px] text-muted-foreground">
        <span>
          {first.period}: {first.rate}%
        </span>
        <span>
          {last.period}: {last.rate}%
        </span>
      </figcaption>
      <SourceNote s={trend} />
    </figure>
  )
}

// Outside the component: React's purity lint rejects Date.now() in render.
function oneYearAgo(): Date {
  return new Date(Date.now() - 365 * 86_400_000)
}

export async function RegionScreen({ profile }: { profile: InstitutionProfile }) {
  const region = profile.region
  if (!region) {
    return <p className="text-sm text-muted-foreground">Your local market isn’t set up yet. Tell NextChapter your state and counties (support@launchyournextchapter.com) and this fills in with local employers, openings and layoffs.</p>
  }

  const since = oneYearAgo()
  const areas = regionAreas(region)
  const [warn, boards] = await Promise.all([
    prisma.warnNotice.findMany({
      where: {
        dismissedAt: null,
        noticeDate: { gte: since },
        OR: areas.flatMap((a) =>
          a.counties.length ? a.counties.map((c) => ({ state: a.state, county: { contains: c, mode: 'insensitive' as const } })) : [{ state: a.state }],
        ),
      },
      orderBy: { noticeDate: 'desc' },
      take: 10,
      select: { id: true, employer: true, county: true, noticeDate: true, employees: true, sourceUrl: true },
    }),
    prisma.workforceBoard.findMany({
      where: { OR: areas.map((a) => ({ state: a.state, counties: { hasSome: a.counties } })) },
      select: { id: true, name: true, website: true, directorName: true, directorTitle: true, detailsUrl: true },
    }),
  ])

  const board = profile.workforce?.board
  // Many filings name no county: fall back to the region's states, and only
  // blame coverage when a state has no filings on file at all.
  const states = [...new Set(areas.map((a) => a.state))]
  const stateWarn = warn.length
    ? []
    : await prisma.warnNotice.findMany({
        where: { dismissedAt: null, noticeDate: { gte: since }, state: { in: states } },
        orderBy: { noticeDate: 'desc' },
        take: 10,
        select: { id: true, employer: true, county: true, noticeDate: true, employees: true, sourceUrl: true },
      })
  const covered = warn.length || stateWarn.length ? true : (await prisma.warnNotice.count({ where: { state: { in: states } } })) > 0
  const shownWarn = warn.length ? warn : stateWarn

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {region.name}. Public figures with their sources; nothing here is about any one person.
      </p>

      {region.unemployment?.length ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {region.unemployment.map((u) => (
            <div key={u.area} className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">Unemployment · {u.area}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{u.rate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">
                {u.period}
                {u.laborForce ? ` · labor force ${u.laborForce.toLocaleString()}` : ''}
              </p>
              <SourceNote s={u} />
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {region.unemploymentTrend && (
          <Panel title={`${region.unemploymentTrend.area}: monthly unemployment`} icon={TrendingDown}>
            <Trend trend={region.unemploymentTrend} />
          </Panel>
        )}

        {(region.topEmployers || region.industries || region.medianHouseholdIncome) && (
          <Panel title="Local economy" icon={MapPin}>
            {region.topEmployers && (
              <>
                <p className="text-xs font-medium text-muted-foreground">Largest employers</p>
                <ul className="mt-1 grid grid-cols-1 gap-x-4 text-sm sm:grid-cols-2">
                  {region.topEmployers.names.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
                <SourceNote s={region.topEmployers} />
              </>
            )}
            {region.industries && (
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground">Major industries</p>
                <p className="mt-1 text-sm">{region.industries.names.join(' · ')}</p>
                <SourceNote s={region.industries} />
              </div>
            )}
            {region.medianHouseholdIncome && (
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground">Median household income · {region.medianHouseholdIncome.area}</p>
                <p className="mt-1 text-sm font-semibold">
                  {region.medianHouseholdIncome.value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
                </p>
                <SourceNote s={region.medianHouseholdIncome} />
              </div>
            )}
          </Panel>
        )}

        <Panel title="Workforce system (WIOA)" icon={Landmark}>
          {boards.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {boards.map((b) => (
                <li key={b.id}>
                  <span className="font-medium">{b.name}</span>
                  {b.directorName && (
                    <span className="text-muted-foreground">
                      {' '}
                      · {b.directorName}
                      {b.directorTitle ? `, ${b.directorTitle}` : ''}
                    </span>
                  )}
                  {b.website && (
                    <a href={b.website} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-0.5 text-primary hover:underline">
                      Website <ExternalLink className="size-3" aria-hidden="true" />
                    </a>
                  )}
                </li>
              ))}
              <li className="text-[11px] text-muted-foreground">Source: CareerOneStop directory, synced by NextChapter</li>
            </ul>
          ) : board ? (
            <div className="text-sm">
              <p className="font-medium">{board.name}</p>
              {board.counties?.length ? <p className="text-muted-foreground">Covers {board.counties.join(', ')}</p> : null}
              {board.website && (
                <a href={board.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
                  Website <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              )}
              <SourceNote s={board} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No workforce board on file for these counties yet.</p>
          )}
          {profile.workforce?.careerLinks?.length ? (
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">American Job Centers nearby</p>
              <ul className="mt-1 space-y-2 text-sm">
                {profile.workforce.careerLinks.map((c) => (
                  <li key={c.name}>
                    <span className="font-medium">{c.name}</span>
                    {c.address && <span className="block text-muted-foreground">{c.address}</span>}
                    {c.phone && <span className="block text-muted-foreground">{c.phone}</span>}
                  </li>
                ))}
              </ul>
              <SourceNote s={profile.workforce.careerLinks[0]} />
            </div>
          ) : null}
        </Panel>

        <Panel title="WARN layoff notices (last 12 months)" icon={TrendingDown}>
          {shownWarn.length > 0 ? (
            <ul className="divide-y divide-border text-sm">
              {!warn.length && <li className="py-1.5 text-muted-foreground">None name your counties; these are the latest across {states.join(' and ')}.</li>}
              {shownWarn.map((w) => (
                <li key={w.id} className="flex justify-between gap-3 py-1.5">
                  <span>
                    <span className="font-medium">{w.employer}</span>
                    {w.county && <span className="text-muted-foreground"> · {w.county}</span>}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {w.employees ? `${w.employees} jobs · ` : ''}
                    {w.noticeDate ? dateFmt.format(w.noticeDate) : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {covered
                ? 'No WARN filings in the last 12 months.'
                : `None on file. NextChapter’s WARN sync doesn’t cover ${states.join(' or ')} filings yet; once it does, notices for these counties appear here automatically.`}
            </p>
          )}
        </Panel>
      </div>

      {profile.news?.length ? (
        <Panel title="Local news" icon={Newspaper}>
          <ul className="space-y-3">
            {profile.news.map((n) => (
              <li key={n.url} className="text-sm">
                <a href={n.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                  {n.headline}
                </a>
                <span className="block text-xs text-muted-foreground">
                  {n.outlet} · {n.date}
                </span>
                <span className="block text-muted-foreground">{n.summary}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  )
}
