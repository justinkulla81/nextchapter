import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { qrSvg } from '@/lib/qr/qr-svg'
import { KIT_SOURCES, hrBlurb, kitStats, kitUrl, parseKitLabel, welcomeCopy } from '@/lib/cohorts/launch-kit'
import { Card, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { createCohortKit } from '../../actions'

export const maxDuration = 30

export default async function CohortKitPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const cohort = await prisma.layoffCohort.findUnique({ where: { id } })
  if (!cohort) notFound()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
  const links = await prisma.referralLink.findMany({ where: { label: { startsWith: `lc:${id}:` } }, select: { code: true, label: true } })
  const stats = await kitStats(id)
  const welcome = welcomeCopy(cohort.companyName)
  const urlFor = (source: string) => {
    const link = links.find((l) => parseKitLabel(l.label)?.source === source)
    return link ? kitUrl(appUrl, link.code, source) : null
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <Link href="/support/admin/layoff-cohorts" className="text-sm text-primary underline underline-offset-4 print:hidden">Layoff cohorts</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{cohort.companyName}: launch kit</h1>
        <p className="mt-1 text-muted-foreground">
          One link per source. Anyone who signs up through a link joins this cohort&apos;s group, and the source tells you which handout or email worked.
        </p>
      </div>

      {links.length === 0 ? (
        <form action={createCohortKit.bind(null, id)} className="print:hidden">
          <SubmitButton>Create the kit links</SubmitButton>
        </form>
      ) : (
        <>
          <Card className="print:hidden">
            <CardContent className="space-y-2 pt-6">
              <p className="text-sm font-medium">
                Joined: {stats.totalJoined === null ? `fewer than 10 so far` : stats.totalJoined}
              </p>
              <ul className="text-sm text-muted-foreground">
                {stats.sources.map((s) => (
                  <li key={s.source}>{s.label}: {s.clicks} clicks{s.joined === null ? '' : `, ${s.joined} joined`}</li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">Counts under 10 are withheld so a small group cannot be read person by person.</p>
            </CardContent>
          </Card>

          {KIT_SOURCES.map(({ source, label, note }) => {
            const url = urlFor(source)
            if (!url) return null
            return (
              <Card key={source}>
                <CardContent className="flex flex-wrap items-start gap-6 pt-6">
                  <div className="w-40 shrink-0" dangerouslySetInnerHTML={{ __html: qrSvg(url, { size: 160, label: `Scan to join the ${cohort.companyName} group` }) }} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="font-medium">{label}</p>
                    <p className="text-sm text-muted-foreground">{note}</p>
                    <p className="break-all rounded-md border border-border px-3 py-2 text-xs">{url}</p>
                    {source === 'hr' && <pre className="whitespace-pre-wrap rounded-md border border-border px-3 py-2 text-sm">{hrBlurb(cohort.companyName, url)}</pre>}
                  </div>
                </CardContent>
              </Card>
            )
          })}

          <Card>
            <CardContent className="space-y-1 pt-6">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Welcome message shown in the group</p>
              <p className="font-medium">{welcome.title}</p>
              <p className="text-sm text-muted-foreground">{welcome.body}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
