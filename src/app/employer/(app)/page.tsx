import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getCurrentOutplacementOrgUser } from '@/lib/employer/outplacement-auth'
import { getSeatUtilization } from '@/lib/employer/outplacement-reporting'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PROGRAM_TYPE_LABEL, PROGRAM_TYPE_HOME } from '@/lib/employer/program-type'
import { PRIVACY_NOTE, PROGRAM_KIND_BLURB, programKindOf } from '@/lib/employer/program-wording'

const TIER_LABEL: Record<string, string> = { CORE: 'Core', PLUS: 'Plus', PREMIUM: 'Premium' }

export default async function EmployerOverviewPage() {
  const orgUser = await getCurrentOutplacementOrgUser()

  const contracts = await prisma.outplacementContract.findMany({
    where: { orgId: orgUser.orgId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  })

  const utilizations =
    orgUser.role === 'ADMIN' || orgUser.role === 'VIEWER'
      ? await Promise.all(contracts.map((c) => getSeatUtilization(orgUser, c.id)))
      : []

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">NextChapter for Employers</p>
        <h1 className="text-2xl font-semibold tracking-tight">{orgUser.orgName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as {orgUser.fullName ?? orgUser.email} —{' '}
          {orgUser.role === 'ADMIN' && 'admin (enrollment, billing, and reporting).'}
          {orgUser.role === 'VIEWER' && 'viewer (reporting only).'}
          {orgUser.role === 'LEGAL' && 'legal (compliance pack only).'}
          {orgUser.role === 'FINANCE' && 'finance (invoices only).'}
        </p>
      </div>

      {orgUser.role === 'ADMIN' && contracts.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/employer/enroll" className={cn(buttonVariants())}>
            Enroll people
          </Link>
          <Link href="/employer/program" className="text-sm text-muted-foreground underline underline-offset-4">
            Set up what your program offers
          </Link>
        </div>
      )}

      {(orgUser.role === 'ADMIN' || orgUser.role === 'VIEWER') && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Contracts</h2>
          {contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active contract yet. Your NextChapter contact sets it up; once it’s in place you can enroll people here. Questions:{' '}
              <a className="underline underline-offset-4" href="mailto:support@launchyournextchapter.com">
                support@launchyournextchapter.com
              </a>
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {contracts.map((c, i) => {
                const util = utilizations[i]
                return (
                  <Card key={c.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{c.cohortLabel ?? TIER_LABEL[c.tier]}</CardTitle>
                      <CardDescription>
                        {PROGRAM_TYPE_LABEL[c.programType]} · {TIER_LABEL[c.tier]} · {c.seatCount} seats
                      </CardDescription>
                      <p className="text-xs text-muted-foreground">{PROGRAM_KIND_BLURB[programKindOf(c.journey)]}</p>
                    </CardHeader>
                    <CardContent>
                      {util && !util.suppressed ? (
                        <p className="text-2xl font-semibold tabular-nums">
                          {util.activatedSeats ?? '—'}
                          <span className="text-sm font-normal text-muted-foreground"> / {util.totalSeats} activated</span>
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Too few seats to report without risking re-identification.</p>
                      )}
                      {c.programType !== 'OUTPLACEMENT' && (
                        <Link href={PROGRAM_TYPE_HOME[c.programType]} className="mt-2 inline-block text-sm underline underline-offset-4">
                          Open {PROGRAM_TYPE_LABEL[c.programType]} →
                        </Link>
                      )}
                      {util && util.scope.granularity === 'quarterly' && (
                        <p className="mt-1 text-xs text-muted-foreground">Reports quarterly — under 20 seats.</p>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
          <p className="max-w-2xl text-xs text-muted-foreground">{PRIVACY_NOTE}</p>
          <Link href="/employer/reporting" className="text-sm text-muted-foreground underline underline-offset-4">
            Full reporting →
          </Link>
        </section>
      )}

      {orgUser.role === 'LEGAL' && (
        <Card>
          <CardHeader>
            <CardTitle>Compliance pack</CardTitle>
            <CardDescription>Look up a specific person&apos;s enrollment record for compliance purposes.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/employer/compliance" className={cn(buttonVariants({ variant: 'default' }))}>
              Look up a compliance record
            </Link>
          </CardContent>
        </Card>
      )}

      {orgUser.role === 'FINANCE' && (
        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>Contract totals, PO references, and invoice references.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/employer/invoices" className={cn(buttonVariants({ variant: 'default' }))}>
              View invoices
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
