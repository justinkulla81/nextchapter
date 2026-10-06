import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { BoardContact } from '@/components/admin/WarnWorkforceBoard'
import { WorkforceBoardOpenedTracker } from '@/components/admin/WorkforceBoardsViewTracker'
import { buildBoardReport, isCompanyWide } from '@/lib/workforce/board-report'
import { boardCountyKeys, COLLEGE_SECTORS, COLLEGE_SIZES } from '@/lib/workforce/board-area'
import { jobCentersUrl, STATE_NAMES } from '@/lib/workforce/directory'
import { boardLabor } from '@/lib/workforce/labor'
import { SECTOR_LABELS } from '@/lib/workforce/sector'
import { getNationalLaborData, monthLabel } from '@/lib/market/bls-national'
import { formatDate } from '@/lib/crm/labels'

export const maxDuration = 60

const LIST = '/support/admin/crm/workforce-boards'
const WINDOWS = [
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: '12m', label: 'Last 12 months', days: 365 },
  { key: 'all', label: 'Everything on file', days: null },
] as const

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000)
}

function Tile({ label, value, note }: { label: string; value: string; note?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

function Section({ title, summary, children }: { title: string; summary?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">
        {title}
        {summary && <span className="ml-2 text-sm font-normal text-muted-foreground">{summary}</span>}
      </h2>
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{children}</p>
}

export default async function WorkforceBoardPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdmin()
  const { id: rawId } = await params
  const sp = await searchParams
  const id = decodeURIComponent(rawId)
  const board = await prisma.workforceBoard.findUnique({ where: { id } })
  if (!board) notFound()

  const windowKey = WINDOWS.some((w) => w.key === sp.window) ? sp.window! : '12m'
  const windowDef = WINDOWS.find((w) => w.key === windowKey)!
  const keys = boardCountyKeys(board)
  const inArea = keys === 'all' ? {} : { in: keys }

  const [notices, labor, partners, colleges, news, national] = await Promise.all([
    prisma.warnNotice.findMany({
      where: {
        workforceBoardId: board.id, dismissedAt: null,
        ...(windowDef.days ? { noticeDate: { gte: daysAgo(windowDef.days) } } : {}),
      },
      select: {
        id: true, workforceBoardId: true, employer: true, normalizedEmployer: true, employees: true,
        noticeDate: true, effectiveDate: true, companyId: true, sourceUrl: true, source: true, industry: true,
      },
    }),
    prisma.countyLabor.findMany({
      where: { state: board.state, ...(keys === 'all' ? {} : { nameKey: inArea }) },
      select: { name: true, nameKey: true, laborForce: true, unemployed: true, rate: true, rateYearAgo: true, period: true },
      orderBy: { laborForce: { sort: 'desc', nulls: 'last' } },
    }),
    prisma.workforceBoardPartner.findMany({
      where: { boardId: board.id },
      orderBy: [{ kind: 'asc' }, { distanceMiles: { sort: 'asc', nulls: 'last' } }],
    }),
    prisma.localCollege.findMany({
      where: { state: board.state, ...(keys === 'all' ? {} : { countyKey: inArea }) },
      orderBy: [{ size: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
    }),
    prisma.workforceBoardNews.findMany({
      where: { boardId: board.id },
      orderBy: { publishedAt: { sort: 'desc', nulls: 'last' } },
      take: 60,
    }),
    getNationalLaborData(),
  ])

  const [report] = buildBoardReport([board], notices.map((n) => ({ ...n, companyWide: isCompanyWide(n) })), { includeEmpty: true })
  const area = boardLabor(labor)
  const change = area?.rateYearAgo != null ? Math.round((area.rate - area.rateYearAgo) * 10) / 10 : null
  const longShare = national?.longTermShare?.latest
  const longCount = national?.longTerm?.latest
  const stateName = STATE_NAMES[board.state] ?? board.state
  const site = board.website ?? board.detailsUrl
  const layoffNews = news.filter((n) => n.topic === 'layoffs')
  const aiNews = news.filter((n) => n.topic === 'ai')
  const windowLabel = windowDef.label.toLowerCase()

  return (
    <div className="space-y-6">
      <WorkforceBoardOpenedTracker boardId={board.id} state={board.state} window={windowKey} />
      <nav className="text-sm">
        <Link href={LIST} className="text-muted-foreground hover:underline">← Workforce boards</Link>
      </nav>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{board.name}</h1>
        <p className="text-sm text-muted-foreground">
          {stateName}
          {board.serviceArea && <> · {board.statewide ? 'Statewide' : board.serviceArea}</>}
        </p>
        <p className="flex flex-wrap gap-x-4 text-sm">
          {site && <a href={site} target="_blank" rel="noreferrer" className="text-primary hover:underline">Website</a>}
          {board.detailsUrl && <a href={board.detailsUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">Directory listing</a>}
          {board.address && <span className="text-muted-foreground">{board.address}</span>}
        </p>
        <div className="space-y-0.5 text-sm">
          <BoardContact role={board.directorTitle ?? 'Director'} name={board.directorName} email={board.directorEmail} phone={board.directorPhone} />
          <BoardContact role="Board chair" name={board.chairName} email={board.chairEmail} phone={board.chairPhone} />
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label={`Jobs lost, ${windowLabel}`}
          value={report.jobs.toLocaleString()}
          note={<>{report.companies.length} {report.companies.length === 1 ? 'company' : 'companies'} · state WARN filings{report.reportedJobs > 0 && <> · {report.reportedJobs.toLocaleString()} more reported company-wide</>}</>}
        />
        <Tile
          label="White collar"
          value={report.sectorJobs > 0 ? `${Math.round((report.knowledgeJobs / report.sectorJobs) * 100)}%` : '—'}
          note={report.sectorJobs > 0
            ? `${report.knowledgeJobs.toLocaleString()} of ${report.sectorJobs.toLocaleString()} jobs with a published sector`
            : `${stateName} does not publish an industry with its filings`}
        />
        <Tile
          label="Unemployment"
          value={area ? `${area.rate.toFixed(1)}%` : '—'}
          note={area
            ? <>{area.period}{change != null && <>, {change === 0 ? 'same as' : `${change > 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(1)} pts from`} a year earlier</>} · {area.unemployed.toLocaleString()} of {area.laborForce.toLocaleString()}</>
            : 'No county figures for this area'}
        />
        <Tile
          label="Long-term unemployment (national)"
          value={longShare ? `${longShare.value.toFixed(1)}%` : '—'}
          note={longShare && longCount
            ? <>of the unemployed, 27+ weeks ({(longCount.value / 1000).toFixed(2)}M) · {monthLabel(longShare)}. BLS does not publish this for counties or states monthly.</>
            : 'BLS national figure unavailable right now'}
        />
      </section>

      <div className="flex flex-wrap items-center gap-1 text-xs" role="group" aria-label="Filed">
        <span className="mr-1 text-muted-foreground">Filed</span>
        {WINDOWS.map((w) => (
          <Link
            key={w.key}
            href={`${LIST}/${encodeURIComponent(board.id)}?window=${w.key}`}
            aria-current={w.key === windowKey ? 'true' : undefined}
            className={`rounded-md border px-2.5 py-1 ${w.key === windowKey ? 'border-brand bg-brand/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}
          >
            {w.label}
          </Link>
        ))}
      </div>

      <Section title="Layoffs" summary={`${report.companies.length} companies, ${windowLabel}`}>
        {report.companies.length === 0 ? (
          <Empty>No layoffs filed in this area {windowDef.days ? `in the ${windowLabel}` : 'on file'}.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="px-3 py-1.5 font-medium">Company</th>
                  <th className="px-2 py-1.5 font-medium">Sector</th>
                  <th className="px-2 py-1.5 text-right font-medium">Jobs</th>
                  <th className="px-2 py-1.5 font-medium">Filed</th>
                  <th className="px-2 py-1.5 font-medium">Effective</th>
                </tr>
              </thead>
              <tbody>
                {report.companies.map((c) => (
                  <tr key={c.key} className="border-b border-border last:border-0">
                    <td className="px-3 py-1.5">
                      {c.companyId ? <Link href={`/support/admin/companies/${c.companyId}`} className="hover:underline">{c.employer}</Link> : c.employer}
                      {c.notices > 1 && <span className="text-xs text-muted-foreground"> · {c.notices} notices</span>}
                      {c.companyWide && (
                        <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground" title="A company-wide count reported for this headquarters, not a state filing for local jobs">company-wide</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">{c.sector ? SECTOR_LABELS[c.sector] : '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{c.jobs ? `${c.jobs.toLocaleString()}${c.jobsUnknown ? '+' : ''}` : '—'}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-xs">
                      {c.sourceUrl ? <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">{formatDate(c.latestFiled)}</a> : formatDate(c.latestFiled)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-xs">
                      {formatDate(c.firstEffective)}
                      {c.lastEffective && c.firstEffective && c.lastEffective.getTime() !== c.firstEffective.getTime() && ` – ${formatDate(c.lastEffective)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Local news" summary="Searched daily; stories that name a place this board serves">
        <div className="grid gap-4 lg:grid-cols-2">
          {([['Layoffs', layoffNews], ['AI and jobs', aiNews]] as const).map(([label, items]) => (
            <div key={label} className="space-y-1.5">
              <h3 className="text-sm font-medium">{label}</h3>
              {items.length === 0 ? (
                <Empty>{report.notices > 0 || board.newsCheckedAt ? 'No local stories found yet.' : 'News is searched for boards with layoffs on file.'}</Empty>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {items.map((n) => (
                    <li key={n.id}>
                      <a href={n.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{n.title}</a>
                      <span className="block text-xs text-muted-foreground">{[n.publisher, n.publishedAt ? formatDate(n.publishedAt) : null].filter(Boolean).join(' · ')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Job centers (partners)" summary={partners.length ? `${partners.length} American Job Centers` : undefined}>
        {partners.length === 0 ? (
          <Empty>
            {board.partnersCheckedAt ? 'CareerOneStop lists no job centers for this area.' : 'Not read yet: job centers are read a few dozen boards a day.'}{' '}
            <a href={jobCentersUrl(board.zip, board.state)} target="_blank" rel="noreferrer" className="text-primary hover:underline">Search CareerOneStop</a>
          </Empty>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="px-3 py-1.5 font-medium">Center</th>
                  <th className="px-2 py-1.5 font-medium">Address</th>
                  <th className="px-2 py-1.5 font-medium">Phone</th>
                  <th className="px-2 py-1.5 font-medium" title="The center's business services contact — the one to reach about a layoff">Business services</th>
                  <th className="px-2 py-1.5 font-medium">General email</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id} className="border-b border-border align-top last:border-0">
                    <td className="px-3 py-1.5">
                      {p.website ? <a href={p.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{p.name}</a> : p.name}
                      <span className="block text-xs text-muted-foreground">{[p.kind, p.hours].filter(Boolean).join(' · ')}</span>
                    </td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">{p.address ?? '—'}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-xs">{p.phone ? <a href={`tel:${p.phone}`} className="hover:underline">{p.phone}</a> : '—'}</td>
                    <td className="px-2 py-1.5 text-xs">{p.businessEmail ? <a href={`mailto:${p.businessEmail}`} className="hover:underline">{p.businessEmail}</a> : '—'}</td>
                    <td className="px-2 py-1.5 text-xs">{p.email ? <a href={`mailto:${p.email}`} className="hover:underline">{p.email}</a> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Colleges" summary={`${colleges.length} degree-granting colleges in the area`}>
        <p className="text-xs text-muted-foreground">
          From the Department of Education&apos;s IPEDS directory, which lists each college&apos;s chief executive and main line.
          Department heads (career services, alumni relations, development, executive education) are not in any public directory.
        </p>
        {colleges.length === 0 ? (
          <Empty>No degree-granting colleges are listed in this board&apos;s counties.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="px-3 py-1.5 font-medium">College</th>
                  <th className="px-2 py-1.5 font-medium">Type</th>
                  <th className="px-2 py-1.5 font-medium">Students</th>
                  <th className="px-2 py-1.5 font-medium">Chief executive</th>
                  <th className="px-2 py-1.5 font-medium">Main phone</th>
                </tr>
              </thead>
              <tbody>
                {colleges.map((c) => (
                  <tr key={c.id} className="border-b border-border align-top last:border-0">
                    <td className="px-3 py-1.5">
                      {c.website ? <a href={c.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{c.name}</a> : c.name}
                      <span className="block text-xs text-muted-foreground">{c.city}</span>
                    </td>
                    <td className="px-2 py-1.5 text-xs text-muted-foreground">{c.sector ? COLLEGE_SECTORS[c.sector] : '—'}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-xs text-muted-foreground">{c.size ? COLLEGE_SIZES[c.size] : '—'}</td>
                    <td className="px-2 py-1.5 text-xs">{c.chiefName ?? '—'}{c.chiefTitle && <span className="block text-muted-foreground">{c.chiefTitle}</span>}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-xs">{c.phone ? <a href={`tel:${c.phone}`} className="hover:underline">{c.phone}</a> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {labor.length > 1 && (
        <Section title="Unemployment by county" summary={area ? `${area.period}, BLS, not seasonally adjusted` : undefined}>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="px-3 py-1.5 font-medium">County</th>
                  <th className="px-2 py-1.5 text-right font-medium">Rate</th>
                  <th className="px-2 py-1.5 text-right font-medium">A year earlier</th>
                  <th className="px-2 py-1.5 text-right font-medium">Unemployed</th>
                  <th className="px-2 py-1.5 text-right font-medium">Labor force</th>
                </tr>
              </thead>
              <tbody>
                {labor.filter((l) => l.rate != null).map((l) => (
                  <tr key={l.nameKey} className="border-b border-border last:border-0">
                    <td className="px-3 py-1.5">{l.name}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{l.rate!.toFixed(1)}%</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{l.rateYearAgo != null ? `${l.rateYearAgo.toFixed(1)}%` : '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{l.unemployed?.toLocaleString() ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{l.laborForce?.toLocaleString() ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  )
}
